import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('assets/starter-library');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json')));
const receipts=JSON.parse(await fs.readFile('data/starter-library/upload-receipts.json'));
const rows=[];
for(const item of manifest.items){
 const r=receipts[item.category+'/'+item.id];if(!r?.verified)throw Error('Unverified asset '+item.id);
 item.pouch={slug:r.slug,url:`https://pelicans.art/community.html?type=${item.category}&id=${r.slug}`};
 rows.push(`| [${item.name}](${item.pouch.url}) | ${item.category} | ${item.description} |`);
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(root,'pouch-receipts.json'),JSON.stringify(receipts,null,2)+'\n');
await fs.writeFile(path.join(root,'README.md'),`# Sandbox starter library\n\n100 original GPT-6 Astra SVG assets: 40 characters, 30 settings, and 30 props. Every setting includes separately composed landscape and portrait artwork (130 SVG files total).\n\n![Characters](previews/characters.png)\n\n![Props](previews/props.png)\n\n![Landscape settings](previews/backgrounds-landscape.png)\n\n[Portrait settings contact sheet](previews/backgrounds-portrait.png)\n\nBrowse the linked Pouch entries below or search the installed runtime:\n\n\`node scripts/theater.mjs assets search --source local --query "teacher classroom book"\`\n\nImport a result with \`assets add\`, using its category and \`starter-\` ID. Original artwork and metadata are retained here; identical runtime copies live under src/sprites, src/backgrounds, and src/props. Characters include the facial animation groups and IDs. Upload receipts record byte-verified remote copies.\n\nThese assets may be reused and adapted in skits, and the resulting skits and editable projects may be shared. See ASSET-LICENSE.md for the scoped starter-library permission. Model attribution is GPT-6 Astra; no external generation API was used.\n\n| Asset | Category | Search description |\n| --- | --- | --- |\n${rows.join('\n')}\n`);
console.log('Catalog and verified Pouch receipts saved');
