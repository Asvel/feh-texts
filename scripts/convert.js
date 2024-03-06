const fs = require('fs');
const cc = require('opencc-js').Converter({ from: 'tw', to: 'cn' });
const YAML = require('yaml');
const lz11 = require('./lz11');

const locales = ['JPJA', 'TWZH', 'USEN'];
const types = ['CrossLanguage', 'Data', 'Menu'];

const messageCipher = [
  0x6F, 0xB0, 0x8F, 0xD6, 0xEF, 0x6A, 0x5A, 0xEB,
  0xC6, 0x76, 0xF6, 0xE5, 0x56, 0x9D, 0xB8, 0x08,
  0xE0, 0xBD, 0x93, 0xBA, 0x05, 0xCC, 0x26, 0x56,
  0x65, 0x1E, 0xF8, 0x2B, 0xF9, 0xA1, 0x7E, 0x41,
  0x18, 0x21, 0xA4, 0x94, 0x25, 0x08, 0xB8, 0x38,
  0x2B, 0x98, 0x53, 0x76, 0xC6, 0x2E, 0x73, 0x5D,
  0x74, 0xCB, 0x02, 0xE8, 0x98, 0xAB, 0xD0, 0x36,
  0xE5, 0x37
];

function parseMessageAsset(filename) {
  const data = fs.readFileSync(filename);
  const data32 = new Uint32Array(data.buffer, data.byteOffset, data.length / Uint32Array.BYTES_PER_ELEMENT);
  let cipher = ((data.readUint32LE(0) >> 8) * 0x8083) & 0xFFFFFFFF;
  for (let i = 2; i < data32.length; i++) {
    data32[i] ^= cipher;
    cipher ^= data32[i];
  }
  const hsdarc = lz11.decompress(data.subarray(0x04));
  const hsdarcBody = hsdarc.subarray(0x20);

  const entries = [];
  const entryCount = hsdarcBody.readUint32LE(0x00);
  const readString = pointerOffset => {
    const stringOffset = hsdarcBody.readUint32LE(pointerOffset);
    if (stringOffset === 0) return '';
    const stringBuffer = hsdarcBody.subarray(stringOffset);
    let i = 0;
    while (stringBuffer[i] !== 0) {
      const cipher = messageCipher[i % messageCipher.length];
      if (stringBuffer[i] !== cipher) {
        stringBuffer[i] ^= cipher;
      }
      i++;
    }
    return stringBuffer.toString('utf-8', 0, i);
  };
  for (let i = 0; i < entryCount; i++) {
    const key = readString(i * 0x10 + 0x08);
    const value = readString(i * 0x10 + 0x10);
    if (value === '') continue;
    entries.push([key, value]);
  }
  return entries;
}

const messages = {};
for (const locale of locales) {
  for (const type of types) {
    const messagePath = `./assets/${locale}/Message/${type}/`;
    for (const filename of fs.readdirSync(messagePath)) {
      const data = parseMessageAsset(messagePath + filename);
      for (let [key, value] of data) {
        if (value === null) continue;
        if (key.endsWith('_NOSKW')) continue;  // skip skill help without keywords descriptive text
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
fs.writeFileSync('../texts.yaml', YAML.stringify(annotated, { lineWidth: 0 })
  .replaceAll('\ue001', '').replaceAll('\ue002', '.'));
