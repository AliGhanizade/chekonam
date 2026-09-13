const STORAGE = {settings:'chekonam-settings', custom:'chekonam-custom', stats:'chekonam-stats', last:'chekonam-last'};
const fallbackManifest = {app:{name:'چه کنم؟',defaultCategory:'food',maxCustomOptions:12},categories:[],sounds:[]};
const fallbackData = {title:'انتخاب امروز',items:[{title:'یک گزینه‌ی تازه امتحان کن',description:'تصمیم را کوچک بگیر و همین حالا شروع کن.'},{title:'کمی صبر کن',description:'گاهی بهترین پاسخ بعد از یک نفس عمیق می‌رسد.'}]};
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const fa = value => new Intl.NumberFormat('fa-IR').format(value);
const state = {manifest:null, datasets:{}, activeCategory:null, activeItems:[], currentIndex:0, spinning:false, activeSounds:new Map(), settings:{effects:true,surprise:true,sounds:true}, stats:{visits:0,choices:0,custom:0,byDay:{}}};
let audioContext = null;
let masterGain = null;
const colors = ['#d8f36b','#72d8d2','#8d7dff','#ffab73','#ff8fa3','#9fe3ff','#c8bfff','#ffce73'];

async function loadJSON(path, fallback){
  try { const response = await fetch(path); if(!response.ok) throw new Error('data unavailable'); return await response.json(); }
  catch { return fallback; }
}

async function init(){
  state.manifest = await loadJSON('data.json', fallbackManifest);
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}');
  state.settings = {...state.settings, ...savedSettings};
  state.stats = {...state.stats, ...JSON.parse(localStorage.getItem(STORAGE.stats) || '{}')};
  state.stats.byDay = state.stats.byDay || {};
  const custom = JSON.parse(localStorage.getItem(STORAGE.custom) || 'null');
  if(custom?.items?.length){ state.manifest.categories.push({...custom, custom:true, icon:'＋', color:'#d8f36b', description:'بوم ذخیره‌شده‌ی تو'}); state.datasets[custom.id] = custom; }
  renderCategories(); renderSounds(); bindEvents(); updateAdmin();
  track('visit');
}

function renderCategories(){
  const grid = $('#categoryGrid');
  grid.innerHTML = state.manifest.categories.map((category, index) => `<button class="category-card" data-category="${category.id}" style="--card-color:${category.color};animation-delay:${index * 45}ms"><span class="category-icon">${category.icon}</span><span class="category-arrow">←</span><h3>${category.title}</h3><p>${category.description}</p></button>`).join('');
}

function renderSounds(){
  const list = $('#soundList');
  list.innerHTML = (state.manifest.sounds || []).map(sound => `<button class="sound-card" draggable="true" data-sound="${sound.id}" style="--sound-color:${sound.color}"><span class="sound-toggle-dot">♪</span><span><strong>${sound.title}</strong><small>${sound.subtitle}</small></span></button>`).join('');
}

function bindEvents(){
  $('#categoryGrid').addEventListener('click', event => { const card = event.target.closest('[data-category]'); if(card) openCategory(card.dataset.category); });
  $('#closeDecision').addEventListener('click', closeDecision);
  $('#spinButton').addEventListener('click', spin);
  $('#rerollButton').addEventListener('click', spin);
  $('#surpriseButton').addEventListener('click', surprise);
  $('#howButton').addEventListener('click', () => $('#howSection').scrollIntoView({behavior:'smooth'}));
  $('#customForm').addEventListener('submit', saveCustom);
  $('#soundToggle').addEventListener('click', () => { state.settings.sounds = !state.settings.sounds; saveSettings(); if(!state.settings.sounds) stopAudio(); $('#soundToggle').classList.toggle('muted', !state.settings.sounds); showToast(state.settings.sounds ? 'صدا روشن شد' : 'صدا خاموش شد'); });
  $('#soundList').addEventListener('click', event => { const button = event.target.closest('[data-sound]'); if(button) toggleSound(button.dataset.sound, button); });
  $('#soundList').addEventListener('dragstart', event => { const button = event.target.closest('[data-sound]'); if(button) event.dataTransfer.setData('text/plain', button.dataset.sound); });
  $('#soundboard').addEventListener('dragover', event => event.preventDefault());
  $('#soundboard').addEventListener('drop', event => { event.preventDefault(); const id=event.dataTransfer.getData('text/plain'); const button=$(`#soundList [data-sound="${id}"]`); if(id && button) toggleSound(id,button,true); });
  $('#adminToggle').addEventListener('click', openAdmin); $('#closeAdmin').addEventListener('click', closeAdmin); $('#drawerBackdrop').addEventListener('click', closeAdmin);
  $$('[data-setting]').forEach(input => { input.checked = state.settings[input.dataset.setting] !== false; input.addEventListener('change', () => { state.settings[input.dataset.setting] = input.checked; saveSettings(); }); });
  $('#clearLocalData').addEventListener('click', clearLocalData);
}

async function openCategory(id){
  const category = state.manifest.categories.find(item => item.id === id); if(!category) return;
  if(!state.datasets[id]) state.datasets[id] = await loadJSON(category.file, {...fallbackData,title:category.title});
  state.activeCategory = category; state.activeItems = state.datasets[id].items || fallbackData.items; state.currentIndex = 0;
  $('#decisionEyebrow').textContent = category.title; $('#decisionTitle').textContent = category.custom ? 'بوم خودت' : 'آماده‌ای؟'; $('#decisionPanel').hidden = false; $('#decisionPanel').scrollIntoView({behavior:'smooth',block:'center'});
  $('#resultTitle').textContent = 'یک گزینه را انتخاب کن'; $('#resultDescription').textContent = 'می‌توانی گردونه را بچرخانی یا از بین کارت‌های پایین، شانس خودت را امتحان کنی.'; $('#resultKicker').textContent = 'تصمیمت را بسپار به لحظه'; $('#wheelCenter').textContent = 'شروع';
  renderWheel(); renderOptionCards();
}

function closeDecision(){ $('#decisionPanel').hidden = true; state.activeCategory = null; }

function renderOptionCards(){
  $('#optionCards').innerHTML = state.activeItems.map((item,index) => `<button class="option-card" data-option-index="${index}">${item.title}</button>`).join('');
  $$('#optionCards .option-card').forEach(card => card.addEventListener('click', () => choose(Number(card.dataset.optionIndex))));
}

function renderWheel(rotation=0){
  const canvas = $('#decisionCanvas'); const ctx = canvas.getContext('2d'); const cx = canvas.width/2, cy = canvas.height/2, radius = 220; const items = state.activeItems; const slice = Math.PI*2/items.length;
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.translate(cx,cy); ctx.rotate(rotation);
  items.forEach((item,index) => { const start = index*slice-Math.PI/2; const end = start+slice; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,radius,start,end); ctx.closePath(); ctx.fillStyle = colors[index%colors.length]; ctx.globalAlpha = .95; ctx.fill(); ctx.strokeStyle = 'rgba(9,11,21,.45)'; ctx.lineWidth=3; ctx.stroke(); ctx.save(); ctx.rotate(start+slice/2); ctx.translate(radius*.68,0); ctx.rotate(Math.PI/2); ctx.fillStyle='#101426'; ctx.font='700 17px Vazirmatn'; ctx.textAlign='center'; ctx.textBaseline='middle'; const label = item.title.length > 17 ? `${item.title.slice(0,16)}…` : item.title; ctx.fillText(label,0,0); ctx.restore(); });
  ctx.restore(); ctx.beginPath(); ctx.arc(cx,cy,38,0,Math.PI*2); ctx.fillStyle='#101426'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=2; ctx.stroke();
}

function spin(){
  if(state.spinning || !state.activeItems.length) return; state.spinning = true; const canvas = $('#decisionCanvas'); const index = Math.floor(Math.random()*state.activeItems.length); const slice = 360/state.activeItems.length; const target = 360*5 + (360 - index*slice - slice/2); const duration = 1750; const start = performance.now(); const base = Number(canvas.dataset.rotation || 0); const final = base + target * Math.PI/180;
  playTone(250,'triangle',.12); $('#spinButton').disabled = true; $('#wheelCenter').textContent='...';
  const tick = now => { const progress=Math.min(1,(now-start)/duration); const eased=1-Math.pow(1-progress,3); const rotation=base+(final-base)*eased; canvas.dataset.rotation=rotation; renderWheel(rotation); if(progress<1) requestAnimationFrame(tick); else { state.spinning=false; $('#spinButton').disabled=false; choose(index); } }; requestAnimationFrame(tick);
}

function choose(index){
  if(!state.activeItems[index]) return; state.currentIndex=index; const item=state.activeItems[index]; $('#resultKicker').textContent='پیشنهاد امروز'; $('#resultTitle').textContent=item.title; $('#resultDescription').textContent=item.description || 'این انتخاب را امتحان کن و ببین امروز به کجا می‌رسد.'; $('#wheelCenter').textContent='دوباره'; $$('#optionCards .option-card').forEach((card,i)=>card.classList.toggle('selected',i===index)); track('choice'); $('#resultCount').textContent=`${fa(state.stats.choices)} انتخاب امروز`; playTone(520,'sine',.14); if(state.settings.effects) confetti(); }

async function surprise(){
  if(state.settings.surprise===false) return showToast('پیشنهاد غافلگیرکننده خاموش است'); const categories = state.manifest.categories.filter(item=>!item.custom); const chosen=categories[Math.floor(Math.random()*categories.length)]; await openCategory(chosen.id); setTimeout(spin,350);
}

function saveCustom(event){
  event.preventDefault(); const title=$('#customTitle').value.trim(); const items=$('#customOptions').value.split('\n').map(item=>item.trim()).filter(Boolean).slice(0,state.manifest.app.maxCustomOptions || 12); if(!title||items.length<2) return showToast('حداقل دو گزینه وارد کن');
  const custom={id:'custom',title,description:`${fa(items.length)} گزینه‌ی شخصی`,icon:'＋',items:items.map(item=>({title:item,description:'انتخاب ساخته‌شده توسط خودت.'}))}; localStorage.setItem(STORAGE.custom,JSON.stringify(custom)); state.datasets.custom=custom; const existing=state.manifest.categories.findIndex(item=>item.id==='custom'); if(existing>=0) state.manifest.categories[existing]={...custom,custom:true,color:'#d8f36b'}; else state.manifest.categories.push({...custom,custom:true,color:'#d8f36b'}); renderCategories(); track('custom'); showToast('بوم شخصی تو ذخیره شد'); event.target.reset(); openCategory('custom'); }

function saveSettings(){ localStorage.setItem(STORAGE.settings,JSON.stringify(state.settings)); }
function track(type){ const today=new Date().toISOString().slice(0,10); state.stats.visits=state.stats.visits||0; state.stats.choices=state.stats.choices||0; state.stats.custom=state.stats.custom||0; if(type==='visit') state.stats.visits++; if(type==='choice') {state.stats.choices++; state.stats.byDay[today]=(state.stats.byDay[today]||0)+1;} if(type==='custom') state.stats.custom++; localStorage.setItem(STORAGE.stats,JSON.stringify(state.stats)); updateAdmin(); }

function updateAdmin(){ const stats=$('#statsGrid'); if(!stats) return; stats.innerHTML=[['بازدید محلی',state.stats.visits||0],['انتخاب‌ها',state.stats.choices||0],['بوم‌های شخصی',state.stats.custom||0],['دسته‌ها',state.manifest?.categories?.length||0]].map(([label,value])=>`<div class="stat-card"><small>${label}</small><strong>${fa(value)}</strong></div>`).join(''); const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); days.push({day:['ی','د','س','چ','پ','ج','ش'][d.getDay()],value:state.stats.byDay?.[key]||0});} const max=Math.max(...days.map(item=>item.value),1); $('#miniChart').innerHTML=days.map(item=>`<span class="chart-bar" data-day="${item.day}" style="height:${Math.max(5,item.value/max*100)}%"></span>`).join(''); $('#chartTotal').textContent=fa(days.reduce((sum,item)=>sum+item.value,0)); }

function openAdmin(){ $('#adminDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); $('#adminDrawer').setAttribute('aria-hidden','false'); updateAdmin(); }
function closeAdmin(){ $('#adminDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open'); $('#adminDrawer').setAttribute('aria-hidden','true'); }
function clearLocalData(){ if(!confirm('همه‌ی انتخاب‌ها، تنظیمات و بوم شخصی پاک شود؟')) return; Object.values(STORAGE).forEach(key=>localStorage.removeItem(key)); location.reload(); }
function showToast(message){ const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600); }
function confetti(){ const layer=$('#confettiLayer'); layer.innerHTML=''; for(let i=0;i<34;i++){const piece=document.createElement('i');piece.className='confetti';piece.style.left=`${Math.random()*100}%`;piece.style.background=colors[i%colors.length];piece.style.setProperty('--drift',`${(Math.random()-.5)*220}px`);piece.style.animationDelay=`${Math.random()*.25}s`;piece.style.transform=`rotate(${Math.random()*90}deg)`;layer.appendChild(piece);} setTimeout(()=>layer.innerHTML='',2200); }

function ensureAudio(){ if(!state.settings.sounds) return null; if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)(); masterGain=audioContext.createGain(); masterGain.gain.value=.035; masterGain.connect(audioContext.destination);} if(audioContext.state==='suspended') audioContext.resume(); return audioContext; }
function playTone(frequency,wave='sine',duration=.1){ const context=ensureAudio(); if(!context) return; const oscillator=context.createOscillator(); const gain=context.createGain(); oscillator.type=wave; oscillator.frequency.value=frequency; gain.gain.setValueAtTime(.0001,context.currentTime); gain.gain.exponentialRampToValueAtTime(.17,context.currentTime+.01); gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration); oscillator.connect(gain).connect(masterGain); oscillator.start(); oscillator.stop(context.currentTime+duration+.02); }
function toggleSound(id,button,forceOn=false){ if(!state.settings.sounds) return showToast('اول صدا را از بالا روشن کن'); const sound=state.manifest.sounds.find(item=>item.id===id); if(!sound) return; const currentlyActive=state.activeSounds.has(id); const active=forceOn ? true : !currentlyActive; if(active && !currentlyActive){ state.activeSounds.set(id,startAmbient(sound)); button.classList.add('active'); playTone(sound.frequency,'sine',.16); showToast(`${sound.title} به میکسر اضافه شد`); } else if(!active && currentlyActive){ stopAmbient(id); button.classList.remove('active'); showToast(`${sound.title} از میکسر حذف شد`); } $('#playingBars').classList.toggle('active',state.activeSounds.size>0); }
function startAmbient(sound){ const context=ensureAudio(); if(!context) return null; const oscillator=context.createOscillator(); const gain=context.createGain(); oscillator.type=sound.wave; oscillator.frequency.value=sound.frequency; gain.gain.setValueAtTime(.0001,context.currentTime); gain.gain.exponentialRampToValueAtTime(.08,context.currentTime+.35); oscillator.connect(gain).connect(masterGain); oscillator.start(); return {oscillator,gain}; }
function stopAmbient(id){ const node=state.activeSounds.get(id); if(!node) return; const context=audioContext; node.gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.25); node.oscillator.stop(context.currentTime+.28); state.activeSounds.delete(id); }
function stopAudio(){ state.activeSounds.forEach((node,id)=>stopAmbient(id)); $$('.sound-card').forEach(card=>card.classList.remove('active')); $('#playingBars')?.classList.remove('active'); }

init();
