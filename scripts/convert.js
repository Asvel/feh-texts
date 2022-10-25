const fs = require('fs');
const cc = require('opencc-js').Converter({ from: 'tw', to: 'cn' });
const YAML = require('yaml');

const assetsPath = '../../feh-assets-json/files/assets/';  // from https://github.com/HertzDevil/feh-assets-json
const locales = ['JPJA', 'TWZH', 'USEN'];
const types = ['CrossLanguage', 'Data', 'Menu'];

const messages = {};
for (const locale of locales) {
  for (const type of types) {
    const messagePath = `${assetsPath}${locale}/Message/${type}/`;
    for (const filename of fs.readdirSync(messagePath)) {
      const data = JSON.parse(fs.readFileSync(messagePath + filename, 'utf8'));
      for (let { key, value } of data) {
        if (value === null) continue;
        key = key.replace(/^(.+)_(H|HONOR|ILLUST|LEGEND|SEARCH|VOICE)_(.+)$/, '$1_$3_$2');
        messages[key] ??= [];
        messages[key].push(value);
        if (locale === 'TWZH') messages[key].push(value && cc(value).replaceAll('抵销', '抵消'));
      }
    }
  }
}

const dups = {};  // too many duplications in MID_MISSION_*, dedup it
const keys = Object.keys(messages).sort().filter(key => {
  if (!key.startsWith('MID_MISSION_')) return true;
  const message = messages[key][0];
  if (message in dups) return false;
  dups[message] = true;
  return true;
});

const grouped = {};
for (const key of keys) {
  let parts = key.split('_').map(p => p + '\ue001');  // escape to avoid js object key number order
  let container = grouped;
  const last = parts.splice(parts.length - 1, 1)[0];
  for (const part of parts) {
    let c = container[part] ??= {};
    if (Array.isArray(c)) {
      c = container[part] = { '\ue002': c };
    }
    container = c;
  }
  container[last] = messages[key];
}

const annotated = {
  'MSID - Skill': 'MSID',
  'MPID - Person': 'MPID',
  'MEID - Enemy': 'MEID',
  'MDAID - Dress Accessory': 'MDAID',
  'MMVID - Move type': 'MMVID',
  'MWID - Weapon type': 'MWID',
};
for (const key of Object.keys(annotated)) {
  const originalKey = annotated[key] + '\ue001';
  annotated[key] = grouped[originalKey];
  delete grouped[originalKey];
}
for (const key of Object.keys(grouped)) {
  annotated[key] = grouped[key];
}

// fs.writeFileSync('../texts.json', JSON.stringify(annotated, null, 2)
//   .replaceAll('\ue001', '').replaceAll('\ue002', ''));
fs.writeFileSync('../texts.yaml', YAML.stringify(annotated)
  .replaceAll('\ue001', '').replaceAll('\ue002', '.'));
