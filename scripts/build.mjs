import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const flagRegions = {
  CNY: 'cn', EUR: 'eu', USD: 'us', JPY: 'jp', TWD: 'tw', GBP: 'gb',
  HKD: 'hk', CAD: 'ca', AUD: 'au', SGD: 'sg', KRW: 'kr', CHF: 'ch',
  NZD: 'nz', INR: 'in', MYR: 'my', THB: 'th', VND: 'vn', PHP: 'ph'
};
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

async function source(name) {
  const content = await readFile(new URL('src/' + name, root), 'utf8');
  return content.replace(/\r\n/g, '\n');
}

const [template, css, core, ui, flagEntries] = await Promise.all([
  source('ledger.html'),
  source('ledger.css'),
  source('ledger-core.js'),
  source('ledger-ui.js'),
  Promise.all(Object.entries(flagRegions).map(async ([currency, region]) => {
    const image = await readFile(new URL('assets/flags/' + region + '.png', root));
    if (!image.subarray(0, pngSignature.length).equals(pngSignature)) {
      throw new Error('Invalid PNG for ' + currency);
    }
    return [currency, 'data:image/png;base64,' + image.toString('base64')];
  }))
]);

const flags = '// Flag images (public domain): https://flagpedia.net/download\n' +
  'const currencyFlags = ' + JSON.stringify(Object.fromEntries(flagEntries), null, 2) + ';';
const sections = {
  '/* LEDGER_STYLES */': css,
  '/* LEDGER_CORE */': core,
  '/* LEDGER_FLAGS */': flags,
  '/* LEDGER_UI */': ui
};
let html = template;
for (const [marker, content] of Object.entries(sections)) {
  if (!html.includes(marker)) throw new Error('Missing template marker ' + marker);
  html = html.replace(marker, () => content);
}
await writeFile(new URL('index.html', root), html, 'utf8');
console.log('Built index.html');
