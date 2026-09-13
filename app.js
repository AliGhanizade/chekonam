const STORAGE = {settings:'chekonam-settings', appearance:'chekonam-appearance', custom:'chekonam-custom', stats:'chekonam-stats', last:'chekonam-last'};
const fallbackManifest = {app:{name:'چه کنم؟',defaultCategory:'food',maxCustomOptions:12},categories:[],sounds:[]};
const fallbackData = {title:'انتخاب امروز',items:[{title:'یک گزینه‌ی تازه امتحان کن',description:'تصمیم را کوچک بگیر و همین حالا شروع کن.'},{title:'کمی صبر کن',description:'گاهی بهترین پاسخ بعد از یک نفس عمیق می‌رسد.'}]};
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const fa = value => new Intl.NumberFormat('fa-IR').format(value);
const state = {manifest:null, catalog:[], datasets:{}, activeCategory:null, activeItems:[], activeCategoryId:null, lastSelections:{}, currentIndex:0, mode:'cards', quickTimer:null, activeSounds:new Map(), appearance:{theme:'neon',scheme:'dark',depth:'2d',accent:'#d8f36b',secondary:'#72d8d2',radius:18}, settings:{effects:true,surprise:true,sounds:true,volume:35}, stats:{visits:0,choices:0,custom:0,byDay:{}}};
let audioContext = null;
let masterGain = null;
const colors = ['#d8f36b','#72d8d2','#8d7dff','#ffab73','#ff8fa3','#9fe3ff','#c8bfff','#ffce73'];

async function loadJSON(path, fallback){
  try { const response = await fetch(path); if(!response.ok) throw new Error('data unavailable'); return await response.json(); }
  catch { return fallback; }
}

async function init(){
  state.manifest = await loadJSON('data.json', fallbackManifest);
  state.catalog = await loadJSON(state.manifest.app?.catalog || 'data/catalog.json', []);
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}');
  state.settings = {...state.settings, ...savedSettings};
  state.appearance = {...state.appearance, ...JSON.parse(localStorage.getItem(STORAGE.appearance) || '{}')};
  state.lastSelections = JSON.parse(localStorage.getItem(STORAGE.last) || '{}');
  state.stats = {...state.stats, ...JSON.parse(localStorage.getItem(STORAGE.stats) || '{}')};
  state.stats.byDay = state.stats.byDay || {};
  const custom = JSON.parse(localStorage.getItem(STORAGE.custom) || 'null');
  if(custom?.items?.length){ state.manifest.categories.push({...custom, custom:true, icon:'＋', color:'#d8f36b', description:'بوم ذخیره‌شده‌ی تو'}); state.datasets[custom.id] = custom; }
  renderCategories(); renderSounds(); bindEvents(); applyAppearance(); if(window.matchMedia&&!state.systemMedia){state.systemMedia=window.matchMedia('(prefers-color-scheme:light)');state.systemMedia.addEventListener('change',()=>{if(state.appearance.scheme==='system')applyAppearance();});} updateAdmin();
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
  $('#spinButton').addEventListener('click', runMode);
  $('#rerollButton').addEventListener('click', runMode);
  $('#modeSwitcher').addEventListener('click', event => { const button=event.target.closest('[data-mode]'); if(button) setMode(button.dataset.mode); });
  $('#surpriseButton').addEventListener('click', surprise);
  $('#howButton').addEventListener('click', () => $('#howSection').scrollIntoView({behavior:'smooth'}));
  $('#customForm').addEventListener('submit', saveCustom);
  $('#soundToggle').addEventListener('click', () => { state.settings.sounds = !state.settings.sounds; saveSettings(); if(!state.settings.sounds) stopAudio(); $('#soundToggle').classList.toggle('muted', !state.settings.sounds); showToast(state.settings.sounds ? 'صدا روشن شد' : 'صدا خاموش شد'); });
  $('#soundList').addEventListener('click', event => { const button = event.target.closest('[data-sound]'); if(button) toggleSound(button.dataset.sound, button); });
  $('#soundList').addEventListener('dragstart', event => { const button = event.target.closest('[data-sound]'); if(button) event.dataTransfer.setData('text/plain', button.dataset.sound); });
  $('#soundboard').addEventListener('dragover', event => event.preventDefault());
  $('#soundboard').addEventListener('drop', event => { event.preventDefault(); const id=event.dataTransfer.getData('text/plain'); const button=$(`#soundList [data-sound="${id}"]`); if(id && button) toggleSound(id,button,true); });
  $('#volumeControl').addEventListener('input', event => { state.settings.volume=Number(event.target.value); saveSettings(); setMasterVolume(); });
  $('#cardCount').addEventListener('input', event => { $('#cardCountValue').textContent=fa(Number(event.target.value)); if(state.mode==='cards'&&!state.cardsLocked)renderMysteryCards(); });
  $('#glowBox').addEventListener('click', () => openBox(false));
  $('#appearanceToggle').addEventListener('click', openAppearance); $('#closeAppearance').addEventListener('click', closeAppearance);
  $$('.theme-choice').forEach(button => button.addEventListener('click', () => { state.appearance.theme=button.dataset.theme; saveAppearance(); applyAppearance(); showToast(`تم ${button.querySelector('strong').textContent} فعال شد`); }));
  $$('#schemeSwitcher button').forEach(button => button.addEventListener('click', () => { state.appearance.scheme=button.dataset.scheme; saveAppearance(); applyAppearance(); }));
  $$('#depthSwitcher button').forEach(button => button.addEventListener('click', () => { state.appearance.depth=button.dataset.depth; saveAppearance(); applyAppearance(); }));
  $('#accentColor').addEventListener('input', event => { state.appearance.accent=event.target.value; saveAppearance(); applyAppearance(); });
  $('#secondaryColor').addEventListener('input', event => { state.appearance.secondary=event.target.value; saveAppearance(); applyAppearance(); });
  $('#radiusControl').addEventListener('input', event => { state.appearance.radius=Number(event.target.value); saveAppearance(); applyAppearance(); });
  $('#resetAppearance').addEventListener('click', () => { state.appearance={theme:'neon',scheme:'dark',depth:'2d',accent:'#d8f36b',secondary:'#72d8d2',radius:18}; saveAppearance(); applyAppearance(); showToast('ظاهر به حالت اولیه برگشت'); });
  $('#adminToggle').addEventListener('click', openAdmin); $('#closeAdmin').addEventListener('click', closeAdmin); $('#drawerBackdrop').addEventListener('click', closeAdmin); $('#drawerBackdrop').addEventListener('click', closeAppearance);
  $$('[data-setting]').forEach(input => { input.checked = state.settings[input.dataset.setting] !== false; input.addEventListener('change', () => { state.settings[input.dataset.setting] = input.checked; saveSettings(); }); });
  $('#clearLocalData').addEventListener('click', clearLocalData);
}

async function openCategory(id){
  const category = state.manifest.categories.find(item => item.id === id); if(!category) return;
  if(!state.datasets[id]) state.datasets[id] = category.file ? await loadJSON(category.file, {...fallbackData,title:category.title}) : (state.catalog[category.index] || {...fallbackData,title:category.title});
  state.activeCategory = category; state.activeItems = state.datasets[id].items || fallbackData.items; state.currentIndex = 0;
  state.activeCategoryId = id;
  $('#decisionEyebrow').textContent = category.title; $('#decisionTitle').textContent = category.custom ? 'بوم خودت' : 'آماده‌ای؟'; $('#decisionPanel').hidden = false; $('#decisionPanel').scrollIntoView({behavior:'smooth',block:'center'});
  $('#resultTitle').textContent = 'یک گزینه را انتخاب کن'; $('#resultDescription').textContent = 'تعداد کارت‌ها را انتخاب کن و یکی را لمس کن؛ بعد از انتخاب، همان دور قفل می‌شود.'; $('#resultKicker').textContent = 'سه کارت ناشناس';
  renderOptionCards(); setMode(state.mode); const previous=state.lastSelections[id]; if(previous){$('#resultKicker').textContent='آخرین انتخاب تو';$('#resultTitle').textContent=previous.title;$('#resultDescription').textContent=previous.description||'این انتخاب از دفعه‌ی قبل حفظ شده است.';}
}

function closeDecision(){ $('#decisionPanel').hidden = true; state.activeCategory = null; }

function renderOptionCards(){
  $('#optionCards').innerHTML = `<div class="list-heading"><span>لیست گزینه‌ها</span><small>برای خط‌زدن لمس کن</small></div>${state.activeItems.map((item,index) => `<button class="option-card" data-option-index="${index}" type="button"><span class="option-check">✓</span><span>${item.title}</span></button>`).join('')}`;
  $$('#optionCards .option-card').forEach(card => card.addEventListener('click', () => markListOption(Number(card.dataset.optionIndex),card)));
}
function markListOption(index,card){if(state.mode==='cards'&&state.cardsLocked)return showToast('این دور قفل شده؛ برای انتخاب دوباره «کارت‌های تازه» را بزن');card.classList.toggle('done');if(card.classList.contains('done'))choose(index);}

function setMode(mode){
  state.mode=mode; state.cardsLocked=false; $$('.mode-button').forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));
  const cards=mode==='cards', scratch=mode==='scratch', box=mode==='box';
  $('#mysteryStage').hidden=!cards; $('#scratchStage').hidden=!scratch; $('#boxStage').hidden=!box; $('#optionCards').hidden=false;
  const copy={cards:['سه کارت ناشناس','تعداد کارت‌ها را انتخاب کن و یکی را لمس کن؛ بعد از انتخاب، همان دور قفل می‌شود.','کارت‌های تازه ↻'],scratch:['بخت‌آزمایی دستی','خانه‌ها را با انگشت یا ماوس خراش بده تا گزینه‌ها یکی‌یکی نمایان شوند.','شروع صفحه‌ی تازه ⌁'],box:['جعبه‌ی نورانی','چهار ضربه بزن، جعبه باز می‌شود و یک انتخاب از داخلش بیرون می‌آید.','باز کردن جعبه □']}[mode];
  $('#resultKicker').textContent=copy[0]; $('#resultDescription').textContent=copy[1]; $('#spinButton').innerHTML=copy[2];
  if(cards) renderMysteryCards(); if(scratch) renderScratchGrid(); if(box) resetBox();
}
function runMode(){ if(state.mode==='cards') return renderMysteryCards(); if(state.mode==='scratch') return renderScratchGrid(); return openBox(true); }
function distinctIndexes(count){ const indexes=[]; while(indexes.length<Math.min(count,state.activeItems.length)){const index=Math.floor(Math.random()*state.activeItems.length);if(!indexes.includes(index))indexes.push(index);}return indexes; }
function renderMysteryCards(){ const holder=$('#mysteryCards'); state.cardsLocked=false; const count=Number($('#cardCount').value||3); $('#cardCountValue').textContent=fa(count); $('#cardCount').disabled=false; const indexes=distinctIndexes(count); holder.innerHTML=indexes.map(index=>`<button class="mystery-card" data-mystery-index="${index}" type="button" aria-label="کارت ناشناس"><span>✦</span></button>`).join(''); $$('#mysteryCards .mystery-card').forEach(card=>card.addEventListener('click',()=>{if(state.cardsLocked)return;state.cardsLocked=true;$$('#mysteryCards .mystery-card').forEach(other=>{other.disabled=true;other.classList.toggle('revealed',other===card);});$('#cardCount').disabled=true;choose(Number(card.dataset.mysteryIndex));})); }
function renderScratchGrid(){ const holder=$('#scratchGrid'); state.scratchLocked=false; const indexes=distinctIndexes(9); holder.innerHTML=indexes.map(index=>`<button class="scratch-tile" data-scratch-index="${index}" type="button"><span class="scratch-cover">پاک کن</span><strong>${state.activeItems[index]?.title || '...'}</strong></button>`).join(''); $$('#scratchGrid .scratch-tile').forEach(tile=>{tile.addEventListener('pointerdown',()=>{state.scratching=true;revealScratch(tile);});tile.addEventListener('pointerenter',()=>{if(state.scratching)revealScratch(tile);});tile.addEventListener('click',()=>revealScratch(tile));}); document.onpointerup=()=>{state.scratching=false;}; }
function revealScratch(tile){if(state.scratchLocked||tile.classList.contains('scratched'))return;tile.classList.add('scratched');state.scratchLocked=true;$$('#scratchGrid .scratch-tile').forEach(other=>{if(other!==tile)other.disabled=true;});choose(Number(tile.dataset.scratchIndex));}
function resetBox(){state.boxClicks=0;state.boxLocked=false;$('#glowBox').style.setProperty('--box-progress','0%');$('#glowBox').style.setProperty('--box-opacity','0');$('#glowBox').classList.remove('opened');$('#boxClicks').textContent='۴ کلیک تا باز شدن';}
function openBox(fromButton=false){if(state.boxLocked)return;if(state.boxClicks===undefined||fromButton&&state.mode!=='box')resetBox();state.boxClicks++;$('#glowBox').style.setProperty('--box-progress',`${state.boxClicks*25}%`);$('#glowBox').style.setProperty('--box-opacity',`${state.boxClicks/4}`);$('#boxClicks').textContent=state.boxClicks>=4?'باز شد!':`${fa(4-state.boxClicks)} کلیک تا باز شدن`;if(state.boxClicks>=4){state.boxLocked=true;$('#glowBox').classList.add('opened');playTone(620,'sine',.35);choose(Math.floor(Math.random()*state.activeItems.length));}}

function choose(index){
  if(!state.activeItems[index]) return; state.currentIndex=index; const item=state.activeItems[index]; $('#resultKicker').textContent='پیشنهاد امروز'; $('#resultTitle').textContent=item.title; $('#resultDescription').textContent=item.description || 'این انتخاب را امتحان کن و ببین امروز به کجا می‌رسد.'; $$('#optionCards .option-card').forEach((card,i)=>{card.classList.toggle('selected',i===index);card.classList.toggle('done',i===index);}); state.lastSelections[state.activeCategoryId]={index,title:item.title,description:item.description}; localStorage.setItem(STORAGE.last,JSON.stringify(state.lastSelections)); track('choice'); $('#resultCount').textContent=`${fa(state.stats.choices)} انتخاب امروز`; playTone(520,'sine',.14); if(state.settings.effects) confetti(); }

async function surprise(){
  if(state.settings.surprise===false) return showToast('پیشنهاد غافلگیرکننده خاموش است'); const categories = state.manifest.categories.filter(item=>!item.custom); const chosen=categories[Math.floor(Math.random()*categories.length)]; await openCategory(chosen.id); setTimeout(spin,350);
}

function saveCustom(event){
  event.preventDefault(); const title=$('#customTitle').value.trim(); const items=$('#customOptions').value.split('\n').map(item=>item.trim()).filter(Boolean).slice(0,state.manifest.app.maxCustomOptions || 12); if(!title||items.length<2) return showToast('حداقل دو گزینه وارد کن');
  const custom={id:'custom',title,description:`${fa(items.length)} گزینه‌ی شخصی`,icon:'＋',items:items.map(item=>({title:item,description:'انتخاب ساخته‌شده توسط خودت.'}))}; localStorage.setItem(STORAGE.custom,JSON.stringify(custom)); state.datasets.custom=custom; const existing=state.manifest.categories.findIndex(item=>item.id==='custom'); if(existing>=0) state.manifest.categories[existing]={...custom,custom:true,color:'#d8f36b'}; else state.manifest.categories.push({...custom,custom:true,color:'#d8f36b'}); renderCategories(); track('custom'); showToast('بوم شخصی تو ذخیره شد'); event.target.reset(); openCategory('custom'); }

function saveSettings(){ localStorage.setItem(STORAGE.settings,JSON.stringify(state.settings)); }
function saveAppearance(){ localStorage.setItem(STORAGE.appearance,JSON.stringify(state.appearance)); }
function applyAppearance(){ const scheme=state.appearance.scheme==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'):state.appearance.scheme; document.body.classList.remove('theme-neon','theme-matte','theme-colorful','theme-glass','theme-aurora','scheme-light','scheme-dark','depth-2d','depth-3d'); document.body.classList.add(`theme-${state.appearance.theme}`,`scheme-${scheme}`,`depth-${state.appearance.depth||'2d'}`); document.body.style.setProperty('--lime',state.appearance.accent); document.body.style.setProperty('--cyan',state.appearance.secondary); document.body.style.setProperty('--user-radius',`${state.appearance.radius}px`); $('#accentColor').value=state.appearance.accent; $('#secondaryColor').value=state.appearance.secondary; $('#radiusControl').value=state.appearance.radius; $('#radiusValue').textContent=fa(state.appearance.radius); $$('.theme-choice').forEach(button=>button.classList.toggle('active',button.dataset.theme===state.appearance.theme)); $$('#schemeSwitcher button').forEach(button=>button.classList.toggle('active',button.dataset.scheme===state.appearance.scheme)); $$('#depthSwitcher button').forEach(button=>button.classList.toggle('active',button.dataset.depth===state.appearance.depth)); $('#volumeControl').value=state.settings.volume??35; setMasterVolume(); }
function openAppearance(){ $('#appearanceDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); $('#appearanceDrawer').setAttribute('aria-hidden','false'); }
function closeAppearance(){ $('#appearanceDrawer').classList.remove('open'); if(!$('#adminDrawer').classList.contains('open'))$('#drawerBackdrop').classList.remove('open'); $('#appearanceDrawer').setAttribute('aria-hidden','true'); }
function track(type){ const today=new Date().toISOString().slice(0,10); state.stats.visits=state.stats.visits||0; state.stats.choices=state.stats.choices||0; state.stats.custom=state.stats.custom||0; if(type==='visit') state.stats.visits++; if(type==='choice') {state.stats.choices++; state.stats.byDay[today]=(state.stats.byDay[today]||0)+1;} if(type==='custom') state.stats.custom++; localStorage.setItem(STORAGE.stats,JSON.stringify(state.stats)); updateAdmin(); }

function updateAdmin(){ const stats=$('#statsGrid'); if(!stats) return; stats.innerHTML=[['بازدید محلی',state.stats.visits||0],['انتخاب‌ها',state.stats.choices||0],['بوم‌های شخصی',state.stats.custom||0],['دسته‌ها',state.manifest?.categories?.length||0]].map(([label,value])=>`<div class="stat-card"><small>${label}</small><strong>${fa(value)}</strong></div>`).join(''); const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i); const key=d.toISOString().slice(0,10); days.push({day:['ی','د','س','چ','پ','ج','ش'][d.getDay()],value:state.stats.byDay?.[key]||0});} const max=Math.max(...days.map(item=>item.value),1); $('#miniChart').innerHTML=days.map(item=>`<span class="chart-bar" data-day="${item.day}" style="height:${Math.max(5,item.value/max*100)}%"></span>`).join(''); $('#chartTotal').textContent=fa(days.reduce((sum,item)=>sum+item.value,0)); }

function openAdmin(){ $('#adminDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); $('#adminDrawer').setAttribute('aria-hidden','false'); updateAdmin(); }
function closeAdmin(){ $('#adminDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open'); $('#adminDrawer').setAttribute('aria-hidden','true'); }
function clearLocalData(){ if(!confirm('همه‌ی انتخاب‌ها، تنظیمات و بوم شخصی پاک شود؟')) return; Object.values(STORAGE).forEach(key=>localStorage.removeItem(key)); location.reload(); }
function showToast(message){ const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600); }
function confetti(){ const layer=$('#confettiLayer'); layer.innerHTML=''; for(let i=0;i<34;i++){const piece=document.createElement('i');piece.className='confetti';piece.style.left=`${Math.random()*100}%`;piece.style.background=colors[i%colors.length];piece.style.setProperty('--drift',`${(Math.random()-.5)*220}px`);piece.style.animationDelay=`${Math.random()*.25}s`;piece.style.transform=`rotate(${Math.random()*90}deg)`;layer.appendChild(piece);} setTimeout(()=>layer.innerHTML='',2200); }

function ensureAudio(){ if(!state.settings.sounds) return null; if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)(); masterGain=audioContext.createGain(); masterGain.connect(audioContext.destination);} setMasterVolume(); if(audioContext.state==='suspended') audioContext.resume(); return audioContext; }
function setMasterVolume(){ if(masterGain)masterGain.gain.value=(state.settings.volume??35)/100*.12; }
function playTone(frequency,wave='sine',duration=.1){ const context=ensureAudio(); if(!context) return; const oscillator=context.createOscillator(); const gain=context.createGain(); oscillator.type=wave; oscillator.frequency.value=frequency; gain.gain.setValueAtTime(.0001,context.currentTime); gain.gain.exponentialRampToValueAtTime(.17,context.currentTime+.01); gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration); oscillator.connect(gain).connect(masterGain); oscillator.start(); oscillator.stop(context.currentTime+duration+.02); }
function toggleSound(id,button,forceOn=false){ if(!state.settings.sounds) return showToast('اول صدا را از بالا روشن کن'); const sound=state.manifest.sounds.find(item=>item.id===id); if(!sound) return; const currentlyActive=state.activeSounds.has(id); const active=forceOn ? true : !currentlyActive; if(active && !currentlyActive){ state.activeSounds.set(id,startAmbient(sound)); button.classList.add('active'); playTone(sound.frequency,'sine',.16); showToast(`${sound.title} به میکسر اضافه شد`); } else if(!active && currentlyActive){ stopAmbient(id); button.classList.remove('active'); showToast(`${sound.title} از میکسر حذف شد`); } $('#playingBars').classList.toggle('active',state.activeSounds.size>0); }
function createNoise(context){ const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate); const output=buffer.getChannelData(0); for(let i=0;i<output.length;i++)output[i]=(Math.random()*2-1)*.55; const source=context.createBufferSource(); source.buffer=buffer; source.loop=true; return source; }
function startAmbient(sound){ const context=ensureAudio(); if(!context)return null; const mixGain=context.createGain();mixGain.gain.setValueAtTime(.0001,context.currentTime);mixGain.gain.exponentialRampToValueAtTime(sound.volume||.1,context.currentTime+.55);mixGain.connect(masterGain);const nodes=[mixGain];const addNoise=(type,frequency,q=.7)=>{const source=createNoise(context);const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;source.connect(filter).connect(mixGain);source.start();nodes.push(source,filter);};
  if(sound.type==='rain'){addNoise('lowpass',sound.filter||1150,.4);} else if(sound.type==='cafe'){addNoise('bandpass',sound.filter||1450,.55);const tone=context.createOscillator();tone.type='sine';tone.frequency.value=196;const toneGain=context.createGain();toneGain.gain.value=.02;tone.connect(toneGain).connect(mixGain);tone.start();nodes.push(tone,toneGain);} else if(sound.type==='forest'){addNoise('lowpass',sound.filter||700,.7);const wind=context.createOscillator();wind.type='sine';wind.frequency.value=92;const windGain=context.createGain();windGain.gain.value=.018;wind.connect(windGain).connect(mixGain);wind.start();nodes.push(wind,windGain);} else {const one=context.createOscillator();const two=context.createOscillator();one.type='sine';two.type='triangle';one.frequency.value=sound.frequency||110;two.frequency.value=(sound.frequency||110)*1.51;const oneGain=context.createGain();const twoGain=context.createGain();oneGain.gain.value=.035;twoGain.gain.value=.022;one.connect(oneGain).connect(mixGain);two.connect(twoGain).connect(mixGain);one.start();two.start();nodes.push(one,two,oneGain,twoGain);}
  return {nodes,gain:mixGain}; }
function stopAmbient(id){ const node=state.activeSounds.get(id);if(!node)return;const context=audioContext;node.gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.3);node.nodes.forEach(item=>{if(typeof item.stop==='function'){try{item.stop(context.currentTime+.34);}catch{}}});state.activeSounds.delete(id); }
function stopAudio(){ state.activeSounds.forEach((node,id)=>stopAmbient(id)); $$('.sound-card').forEach(card=>card.classList.remove('active')); $('#playingBars')?.classList.remove('active'); }

init();
