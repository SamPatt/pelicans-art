import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Reject redirected installation directories, but allow the normal venv Python symlink.
export async function checkDirectories(root, relatives) {
  const canonical = await fs.realpath(root);
  for (const relative of relatives) {
    let current = canonical;
    for (const segment of relative.split('/')) {
      current = path.join(current, segment);
      const stat = await fs.lstat(current).catch(error => { if(error.code !== 'ENOENT') throw error; });
      if (!stat) break;
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Installation directory must be a real directory: ${current}`);
      if (process.getuid && stat.uid !== process.getuid()) throw new Error(`Installation directory belongs to another user: ${current}`);
    }
  }
}
export function checkPlatform({node=process.versions.node, platform=process.platform, arch=process.arch, glibc=process.report.getReport().header.glibcVersionRuntime, tts=false}={}) {
  if (Number(node.split('.')[0]) < 22) throw new Error('Install Node 22+ before setup; setup does not replace Node.');
  if (!['linux','darwin'].includes(platform)) throw new Error('Use Linux/WSL or macOS for rendering; native Windows setup is not supported.');
  if (tts && (platform !== 'linux' || arch !== 'x64' || !glibc || Number(glibc.split('.')[0]) < 2 || (Number(glibc.split('.')[0]) === 2 && Number(glibc.split('.')[1]) < 28))) throw new Error('Locked local Pocket setup currently requires Linux x64 with glibc 2.28+. Other platforms can use an existing compatible speech endpoint; their local Pocket installation is not yet verified.');
}
export async function checkVenv(env, run) {
  const stat = await fs.lstat(env).catch(error => { if(error.code !== 'ENOENT') throw error; });
  if (!stat) return false;
  const info = JSON.parse((await run(path.join(env,'bin/python'),['-I','-c','import sys,json,os;print(json.dumps({"prefix":os.path.realpath(sys.prefix),"base":os.path.realpath(sys.base_prefix),"version":list(sys.version_info[:2])}))'])).toString());
  const config = await fs.readFile(path.join(env,'pyvenv.cfg'),'utf8');
  if (info.prefix !== await fs.realpath(env) || info.prefix === info.base || !/^include-system-site-packages\s*=\s*false\s*$/mi.test(config) || info.version.join('.') !== '3.12') throw new Error('Existing Pocket environment is not an isolated Python 3.12 venv; choose a fresh checkout.');
  return true;
}
export async function preflight(root, {tts, python, run}) {
  checkPlatform({tts});
  if (process.getuid?.() === 0) throw new Error('Run setup as a regular user, not root or sudo.');
  await checkDirectories(root,['node_modules','server/node_modules','.runtime/pocket-tts-2.1.0','.runtime/pocket-april-presets']);
  for (const [command,args] of [['npm',['--version']],['ffmpeg',['-version']],['ffprobe',['-version']]]) await run(command,args);
  if (tts) {
    const version = JSON.parse((await run(python,['-I','-c','import sys,json;print(json.dumps(list(sys.version_info[:2])))'])).toString());
    if (version.join('.') !== '3.12') throw new Error('Locked Pocket setup requires installed Python 3.12; use --python python3.12.');
    const exists=await checkVenv(path.join(root,'.runtime/pocket-tts-2.1.0'),run);
    const uv=await run('uv',['--version']).then(()=>true).catch(()=>false);
    if (!uv) await run(exists?path.join(root,'.runtime/pocket-tts-2.1.0/bin/python'):python,exists?['-I','-m','pip','--version']:['-I','-c','import venv,ensurepip']);
  }
  const disk = await fs.statfs(root);
  return {platform:process.platform,architecture:process.arch,freeDiskBytes:disk.bavail*disk.bsize,totalMemoryBytes:os.totalmem(),freeMemoryBytes:os.freemem()};
}
