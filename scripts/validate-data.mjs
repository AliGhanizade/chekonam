import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('data.json');
const persian = await readJson('data/catalog.json');
const english = await readJson('data/catalog.en.json');

if (persian.length !== manifest.categories.length || english.length !== manifest.categories.length) {
  throw new Error('Catalog and manifest category counts do not match.');
}

const ids = new Set();
for (let index = 0; index < persian.length; index += 1) {
  const fa = persian[index];
  const en = english[index];
  if (fa.id !== en.id) throw new Error(`Category ID mismatch at index ${index}.`);
  if (fa.items.length < 1) throw new Error(`${fa.id} has no options.`);
  if (fa.items.length !== en.items.length) throw new Error(`Item count mismatch for ${fa.id}.`);
  fa.items.forEach((item, itemIndex) => {
    const translated = en.items[itemIndex];
    if (!item.id || item.id !== translated.id) throw new Error(`Option ID mismatch at ${fa.id}-${itemIndex}.`);
    if (ids.has(item.id)) throw new Error(`Duplicate option ID: ${item.id}`);
    ids.add(item.id);
  });
}

console.log(`Validated ${persian.length} categories and ${ids.size} option IDs.`);
