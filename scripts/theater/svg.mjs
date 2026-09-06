import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSvg} from '../../worker/community-worker.js';
import {validateSpriteSvg} from '../../server/middleware/validate.js';
import {hash,run} from './project.mjs';

export async function deliverSvg(directory,{source,kind='artwork',model='Unknown',title='Untitled SVG'}) {
  if (!source) throw new Error('svg requires --source /path/to/agent-authored.svg');
  if (!['artwork','character','background','prop'].includes(kind)) throw new Error('--kind must be artwork, character, background, or prop');
  if (!model.trim() || model.length>200 || !title.trim() || title.length>300) throw new Error('Provide a nonempty model (up to 200 characters) and title (up to 300 characters)');
  const output=path.resolve(directory);
  if (await fs.lstat(output).then(()=>true).catch(e=>{if(e.code==='ENOENT')return false;throw e;})) throw new Error('Choose a new output directory; existing SVG deliveries are never overwritten.');
  const input=path.resolve(source);
  if ((await fs.stat(input)).size>2*1024*1024) throw new Error('SVG exceeds the 2 MB limit');
  const bytes=await fs.readFile(input), svg=bytes.toString('utf8');
  const unsafe=validateSvg(svg); if (unsafe) throw new Error(unsafe);
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(svg)) throw new Error('SVG document declarations and external stylesheets are not supported');
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({headless:true});
  let png,dimensions,warnings=[];
  try {
    const context=await browser.newContext({deviceScaleFactor:1,serviceWorkers:'block'});
    await context.route('**/*',route=>route.abort());
    const page=await context.newPage();
    await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh;object-fit:contain}</style><img alt="SVG preview">`);
    const parsed=await page.evaluate(text=>{
      const doc=new DOMParser().parseFromString(text,'image/svg+xml');
      const root=doc.documentElement;
      if(doc.querySelector('parsererror')||root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg') throw new Error('Expected well-formed SVG with the SVG namespace');
      for(const element of doc.querySelectorAll('*')) {
        if(element.namespaceURI!=='http://www.w3.org/2000/svg'||['script','foreignObject','iframe','embed','object','animate','animateMotion','animateTransform','set','discard'].includes(element.localName)) throw new Error('Only static SVG artwork is supported');
        for(const attr of element.attributes) {
          if(/^on/i.test(attr.localName)||attr.localName==='base') throw new Error('Executable attributes and base URLs are not supported');
          if(attr.localName==='style' && /[\\@]/.test(attr.value)) throw new Error('Escaped CSS and at-rules are not supported');
        }
        if(element.localName==='style' && /[\\@]/.test(element.textContent)) throw new Error('Escaped CSS and at-rules are not supported');
      }
      const box=root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
      if(!box||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0) throw new Error('SVG requires a finite viewBox with positive width and height');
      return {serialized:new XMLSerializer().serializeToString(doc),box};
    },svg);
    const decodedUnsafe=validateSvg(parsed.serialized);if(decodedUnsafe)throw new Error(decodedUnsafe);
    if(kind==='character') {
      const validation=validateSpriteSvg(parsed.serialized);
      if(!validation.valid)throw new Error(validation.errors.join('; '));
      warnings=validation.warnings;
    }
    const [, ,w,h]=parsed.box,scale=1024/Math.max(w,h);
    dimensions={width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};
    await page.setViewportSize(dimensions);
    await page.locator('img').evaluate(async(img,src)=>{img.src=src;await img.decode();},`data:image/svg+xml;base64,${bytes.toString('base64')}`);
    png=await page.screenshot({type:'png',omitBackground:true,animations:'disabled',timeout:15000});
  } finally {await browser.close();}
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const revision=await run('git',['rev-parse','HEAD'],{cwd:root}).then(b=>b.toString().trim()).catch(()=> 'Unknown');
  const workingTreeDirty=await run('git',['status','--porcelain'],{cwd:root}).then(b=>Boolean(b.toString().trim())).catch(()=>null);
  const files=[{path:'asset.svg',mimeType:'image/svg+xml',size:bytes.length,sha256:hash(bytes)},{path:'preview.png',mimeType:'image/png',size:png.length,sha256:hash(png),...dimensions}];
  const manifest={version:1,title,model,kind,pathBase:'manifest',runtime:{source:'SamPatt/pelicans-art',revision,workingTreeDirty},files,warnings};
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.mkdir(output); // Exclusive creation; never replace a previous delivery or source.
  try {
    await fs.writeFile(path.join(output,'asset.svg'),bytes,{flag:'wx'});
    await fs.writeFile(path.join(output,'preview.png'),png,{flag:'wx'});
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  } catch(error) {await fs.rm(output,{recursive:true,force:true});throw error;}
  return {ok:true,title,model,kind,svg:path.join(output,'asset.svg'),preview:path.join(output,'preview.png'),manifest:path.join(output,'manifest.json'),files:files.map(f=>({...f,path:path.join(output,f.path)})),warnings};
}
