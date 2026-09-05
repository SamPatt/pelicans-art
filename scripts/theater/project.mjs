import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSkit, validateSpriteSvg } from '../../server/middleware/validate.js';
import { validateSvg } from '../../worker/community-worker.js';
export const hash = value => createHash('sha256').update(value).digest('hex');
export async function json(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n'); }
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = []; child.stdout.on('data', x => out.push(x)); child.stderr.on('data', x => err.push(x));
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${command} exited ${code}: ${(Buffer.concat(err).toString() || Buffer.concat(out).toString()).slice(-1600)}`)));
    child.stdin.on('error', () => {}); child.stdin.end(options.input);
  });
}
async function localFile(root, file) {
  if (typeof file !== 'string') throw new Error('Asset source must be a relative file path or data URL');
  const base = await fs.realpath(root), actual = await fs.realpath(path.resolve(root, file));
  if (!actual.startsWith(base + path.sep)) throw new Error(`Asset escapes project directory: ${file}`);
  return actual;
}
export async function readAsset(root, source, kind) {
  if (typeof source === 'string' && source.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(source);
    if (!match || !(kind === 'svg' ? match[1] === 'image/svg+xml' : /^audio\/(wav|x-wav|mpeg|mp3|ogg)$/.test(match[1]))) throw new Error('Unsupported embedded media');
    return { data: Buffer.from(match[2], 'base64'), mime: match[1] };
  }
  const file = await localFile(root, source);
  const mime = kind === 'svg' ? 'image/svg+xml' : ({ '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg' })[path.extname(file)];
  if (!mime) throw new Error(`Unsupported audio file: ${source}`);
  return { data: await fs.readFile(file), mime };
}
const dataUrl = ({ data, mime }) => `data:${mime};base64,${data.toString('base64')}`;
function recordingMatches(skit, id, beat, voice) {
  const binding = skit.audioBindings?.[id];
  return !binding || (binding.line === beat.line && binding.who === beat.who && binding.voice === voice);
}
export async function loadProject(directory) {
  const root = path.resolve(directory), skit = await json(path.join(root, 'skit.json'));
  const config = await json(path.join(root, 'project.json'));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(skit) || !Array.isArray(skit.script) || skit.script.some(beat => !object(beat))) throw new Error('skit.json: script must be an array of action objects');
  for (const group of ['cast', 'props']) if (skit[group] !== undefined && (!object(skit[group]) || Object.values(skit[group]).some(value => !object(value)))) throw new Error(`skit.json: ${group} must map names to objects`);
  if (!object(config)) throw new Error('project.json: expected a configuration object');
  if (config.version !== 1) throw new Error('project.json: expected version 1');
  const validation = validateSkit(skit);
  const errors = [...validation.errors, ...validation.warnings.filter(w => w.includes('unknown'))];
  const assets = structuredClone(skit.assets || {}), hashes = {};
  for (const group of ['sprites', 'backgrounds', 'props']) {
    assets[group] ||= {};
    for (const [id, source] of Object.entries(assets[group])) {
      try {
        const media = await readAsset(root, source, 'svg'), svg = media.data.toString();
        const unsafe = validateSvg(svg); if (unsafe) throw new Error(unsafe);
        if (group === 'sprites' && id.endsWith('-front')) { const result = validateSpriteSvg(svg); if (!result.valid) throw new Error(result.errors.join('; ')); }
        hashes[`${group}/${id}`] = hash(media.data); assets[group][id] = dataUrl(media);
      } catch (error) { errors.push(`assets.${group}.${id}: ${error.message}`); }
    }
  }
  for (const [id, cast] of Object.entries(skit.cast || {})) {
    if (!assets.sprites[`${cast.sprite}-front`]) errors.push(`cast.${id}: missing sprite ${cast.sprite}-front`);
    if (config.tts?.engine !== 'none' && !cast.voice && skit.script.filter(b => b.do === 'say').some((beat, i) => beat.who === id && (!assets.audio?.[`line-${i}`] || !recordingMatches(skit, `line-${i}`, beat, cast.voice)))) errors.push(`cast.${id}: assign voice or supply audio for the current dialogue`);
  }
  const backgrounds = [skit.stage?.background, ...(skit.script || []).filter(b => b.do === 'background').map(b => b.name)];
  for (const id of backgrounds) if (id && !assets.backgrounds[id]) errors.push(`Missing background: ${id}`);
  for (const [id, prop] of Object.entries(skit.props || {})) if (!assets.props[prop.prop]) errors.push(`props.${id}: missing asset ${prop.prop}`);
  for (const [i, beat] of (skit.script || []).entries()) {
    if (beat.do === 'say' && (!skit.cast?.[beat.who] || typeof beat.line !== 'string')) errors.push(`script[${i}]: say requires valid who and text line`);
    if (beat.duration !== undefined && (!Number.isFinite(beat.duration) || beat.duration < 0)) errors.push(`script[${i}]: duration must be nonnegative`);
    if (beat.do === 'turn' && !Object.hasOwn(assets.sprites,`${skit.cast?.[beat.who]?.sprite}-${beat.to}`)) errors.push(`script[${i}]: missing turn variant ${beat.to}`);
    if (beat.do === 'face' && !['left','right'].includes(beat.dir)) errors.push(`script[${i}]: face.dir must be left or right`);
    if (beat.show !== undefined && (!Array.isArray(beat.show) || beat.show.some(id => !skit.cast?.[id]))) errors.push(`script[${i}]: unknown character in show`);
  }
  if (!['pocket', 'openai-compatible', 'piper', 'none'].includes(config.tts?.engine)) errors.push('project.json: tts.engine must be pocket, openai-compatible, piper, or none');
  for (const [id, source] of Object.entries(assets.audio || {})) {
    try { await readAsset(root,source,'audio'); } catch(error) { errors.push(`assets.audio.${id}: ${error.message}`); }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { root, skit, config, assets, hashes, warnings: validation.warnings };
}
async function audioProbe(buffer) {
  await run('ffprobe', ['-v','error','-i','pipe:0','-show_entries','stream=codec_type','-of','json'], { input: buffer }).then(raw => {
    if (!JSON.parse(raw).streams?.some(s => s.codec_type === 'audio')) throw new Error('Speech response contains no decodable audio');
  });
}
export async function synthesize(tts, text, voice) {
  const endpoint = new URL(tts.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Use an HTTP(S) speech endpoint without URL credentials');
  let body, headers = {};
  if (tts.tokenEnv) {
    const token = process.env[tts.tokenEnv]; if (!token) throw new Error(`Missing credential environment variable ${tts.tokenEnv}`);
    headers[tts.authHeader || 'Authorization'] = `${tts.authPrefix ?? 'Bearer '}${token}`;
  }
  if (tts.engine === 'pocket') { body = new FormData(); body.append('text', `, ${text}`); body.append('voice_url', voice); }
  else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(tts.engine === 'piper' ? { text, voice, rate:16000, depth:16, format:'linear' } : { input:text,voice,model:tts.model,response_format:'wav',speed:tts.speed || 1 }); }
  const response = await fetch(endpoint, { method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Speech endpoint returned ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 20*1024*1024) throw new Error('Speech response exceeds 20 MB'); chunks.push(Buffer.from(chunk)); }
  const buffer = Buffer.concat(chunks); await audioProbe(buffer); return buffer;
}
export async function buildProject(directory) {
  const project = await loadProject(directory), { root, skit, config, assets, hashes } = project;
  const out = path.join(root, 'output'), cache = path.join(root, '.cache'); await fs.mkdir(cache,{recursive:true});
  const lines = []; let generated = 0, reused = 0;
  const supplied = assets.audio || {}; assets.audio = {};
  for (const [i, beat] of skit.script.filter(b=>b.do==='say').entries()) {
    const id = `line-${i}`, voice = skit.cast[beat.who].voice;
    if (supplied[id] && recordingMatches(skit, id, beat, voice)) {
      const media = await readAsset(root,supplied[id],'audio'); await audioProbe(media.data); assets.audio[id] = dataUrl(media); lines.push({id,text:beat.line,voice,source:'supplied',hash:hash(media.data)}); continue;
    }
    if (config.tts.engine === 'none') { lines.push({id,text:beat.line,source:'captions'}); continue; }
    const key = hash(JSON.stringify({ text:beat.line,voice,tts:config.tts }));
    const file = path.join(cache,`${key}.mp3`); let audio;
    try { audio = await fs.readFile(file); await audioProbe(audio); reused++; }
    catch { const raw = await synthesize(config.tts,beat.line,voice); audio = await run('ffmpeg',['-v','error','-i','pipe:0','-f','mp3','-ac','1','-b:a','96k','pipe:1'],{input:raw}); await fs.writeFile(file,audio); generated++; }
    assets.audio[id] = dataUrl({data:audio,mime:'audio/mpeg'}); lines.push({id,text:beat.line,voice,source:config.tts.engine,model:config.tts.model || 'Unknown',hash:hash(audio),cacheKey:key});
  }
  const bundle = {...skit,captionOnly:config.tts.engine === 'none',meta:{...skit.meta,model:skit.meta?.model || 'Unknown'},assets,publishedAt:new Date().toISOString()};
  const bundlePath = path.join(out,'project.json');
  await writeJson(bundlePath,bundle);
  const revision = await run('git',['rev-parse','HEAD'],{cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')}).then(b=>b.toString().trim()).catch(()=> 'Unknown');
  const workingTreeDirty = await run('git',['status','--porcelain'],{cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')}).then(b=>Boolean(b.toString().trim())).catch(()=>null);
  const manifest = {version:1,revision,workingTreeDirty,model:bundle.meta.model,assets:hashes,lines,generated,reused,bundle:bundlePath};
  await writeJson(path.join(out,'build-manifest.json'),manifest);
  return manifest;
}
