#!/usr/bin/env node

const { chromium } = require('@playwright/test');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    baseUrl: 'http://127.0.0.1:4173',
    output: path.join(ROOT, 'artifacts', 'captures'),
    captions: true,
    timeout: 180_000,
    skits: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skit') options.skits.push(argv[++i]);
    else if (arg === '--all') options.all = true;
    else if (arg === '--base-url') options.baseUrl = argv[++i].replace(/\/$/, '');
    else if (arg === '--output') options.output = path.resolve(argv[++i]);
    else if (arg === '--no-captions') options.captions = false;
    else if (arg === '--timeout') options.timeout = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  console.log(`Usage:
  npm run capture -- --skit theBox
  npm run capture -- --all

Options:
  --base-url URL      Player server (default: http://127.0.0.1:4173)
  --output DIR        Artifact directory (default: artifacts/captures)
  --no-captions       Hide burned-in player captions
  --timeout MS        Per-skit playback timeout (default: 180000)`);
}

async function isServerReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/skit-player.html`);
    return response.ok && (await response.text()).includes('AI Improv Theater');
  } catch {
    return false;
  }
}

async function ensureServer(baseUrl) {
  if (await isServerReady(baseUrl)) return null;

  const url = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(`Capture server is unavailable: ${baseUrl}`);
  }

  const child = spawn('npm', ['--prefix', 'server', 'run', 'start'], {
    cwd: ROOT,
    env: { ...process.env, PORT: url.port || '80' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isServerReady(baseUrl)) return child;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  child.kill('SIGTERM');
  throw new Error(`Timed out starting capture server at ${baseUrl}`);
}

function listBundledSkits() {
  return fs.readdirSync(path.join(ROOT, 'src', 'published'))
    .filter(name => name.endsWith('.json') && !name.endsWith('-published.json'))
    .map(name => name.replace(/\.json$/, ''))
    .sort();
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function runBuffer(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr?.toString() || result.stdout?.toString()}`);
  }
  return result.stdout;
}

function mediaExtension(mime) {
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  return 'mp3';
}

async function extractAudioFiles(skit, timeline, tempDir) {
  const sayActions = skit.script.filter(beat => beat.do === 'say');
  const files = [];

  for (const event of timeline) {
    const index = Number(event.lineIndex);
    if (!Number.isInteger(index) || index < 0 || index >= sayActions.length) continue;

    const dataUrl = skit.assets?.audio?.[`line-${index}`];
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl || '');
    if (!match) continue;
    const extension = mediaExtension(match[1]);
    const file = path.join(tempDir, `line-${String(index).padStart(3, '0')}.${extension}`);
    await fsp.writeFile(file, Buffer.from(match[2], 'base64'));
    files.push({
      file,
      delayMs: Math.max(0, Math.round(event.offsetMs)),
      effectivePlaybackRate: Number(event.effectivePlaybackRate) || 1,
      volume: Number.isFinite(Number(event.volume)) ? Number(event.volume) : 1,
      index,
      text: event.text
    });
  }
  return files;
}

function detectSyncMarker(rawVideo) {
  const probe = JSON.parse(run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=avg_frame_rate', '-of', 'json', rawVideo
  ]));
  const [numerator, denominator] = probe.streams[0].avg_frame_rate.split('/').map(Number);
  const frameRate = numerator / denominator;
  const pixels = runBuffer('ffmpeg', [
    '-v', 'error', '-i', rawVideo,
    '-vf', 'format=rgb24,crop=1:1:16:16',
    '-f', 'rawvideo', 'pipe:1'
  ]);

  for (let offset = 0; offset + 2 < pixels.length; offset += 3) {
    const [red, green, blue] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    // Leave tolerance for the chroma loss introduced by Playwright's WebM encoder.
    if (red > 150 && green < 120 && blue > 150) {
      return { frame: offset / 3, frameRate, trimStart: (offset / 3) / frameRate };
    }
  }
  throw new Error('Capture synchronization marker was not found in the raw video.');
}

function createMp4({ rawVideo, output, trimStart, duration, audioFiles }) {
  const args = ['-y', '-ss', trimStart.toFixed(3), '-i', rawVideo];
  for (const audio of audioFiles) args.push('-i', audio.file);

  if (audioFiles.length) {
    const delayed = audioFiles.map((audio, i) => {
      const adjustedSampleRate = Math.max(1, Math.round(48000 * audio.effectivePlaybackRate));
      return `[${i + 1}:a]aresample=48000,asetrate=${adjustedSampleRate},aresample=48000,volume=${audio.volume},adelay=${audio.delayMs}|${audio.delayMs}[a${i}]`;
    });
    const inputs = audioFiles.map((_, i) => `[a${i}]`).join('');
    args.push(
      '-filter_complex', `[0:v]setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=3:h=3:color=black:t=fill[vout];${delayed.join(';')};${inputs}amix=inputs=${audioFiles.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${duration.toFixed(3)}[aout]`,
      '-map', '[vout]', '-map', '[aout]'
    );
  } else {
    args.push(
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', '[0:v]setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=3:h=3:color=black:t=fill[vout]',
      '-map', '[vout]', '-map', '1:a:0'
    );
  }

  args.push(
    '-t', duration.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', output
  );
  run('ffmpeg', args);
}

async function captureSkit(browser, skitId, options) {
  const response = await fetch(`${options.baseUrl}/published/${encodeURIComponent(skitId)}.json`);
  if (!response.ok) throw new Error(`Published skit not found: ${skitId} (${response.status})`);
  const skit = await response.json();
  const portrait = skit.stage?.orientation === 'portrait';
  const viewport = portrait ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
  const outputDir = path.join(options.output, skitId);
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `ai-improv-${skitId}-`));
  await fsp.mkdir(outputDir, { recursive: true });

  const context = await browser.newContext({ viewport, recordVideo: { dir: tempDir, size: viewport } });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) diagnostics.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => diagnostics.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => diagnostics.push(`requestfailed: ${request.url()} (${request.failure()?.errorText})`));

  await page.goto(`${options.baseUrl}/skit-player.html?embed=1&skit=${encodeURIComponent(skitId)}`, { waitUntil: 'load' });
  await page.locator('#playBtn:not([disabled])').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.body.dataset.playbackState === 'ready');
  await page.addStyleTag({ content: '#controls { display: none !important; }' });
  await page.evaluate(captions => {
    document.body.classList.toggle('captions-off', !captions);
    window.__captureTimeline = [];
    window.__captureStart = 0;
    const marker = document.createElement('div');
    marker.id = 'capture-sync-marker';
    marker.style.cssText = 'position:fixed;left:0;top:0;width:32px;height:32px;background:transparent;z-index:2147483647;pointer-events:none';
    document.body.appendChild(marker);
    window.addEventListener('ai-improv:audio-start', event => {
      window.__captureTimeline.push({ ...event.detail, at: performance.now() });
    });
  }, options.captions);

  const coverPath = path.join(outputDir, 'cover.png');
  await page.screenshot({ path: coverPath });
  const startedAt = Date.now();
  await page.evaluate(() => {
    window.__captureStart = performance.now();
    const marker = document.getElementById('capture-sync-marker');
    marker.style.background = 'rgb(255, 0, 255)';
    document.getElementById('playBtn').click();
    setTimeout(() => { marker.style.background = 'transparent'; }, 200);
  });
  await page.waitForFunction(() => document.body.dataset.playbackState === 'playing');

  const caption = page.locator('#caption.visible');
  if (options.captions) {
    await caption.waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(350);
  } else {
    await page.waitForTimeout(1_500);
  }
  const stillPath = path.join(outputDir, 'still.png');
  await page.screenshot({ path: stillPath });

  await page.waitForFunction(() => document.body.dataset.playbackState === 'complete', null, { timeout: options.timeout });
  const completedAt = Date.now();
  await page.waitForTimeout(1_000);
  const timeline = await page.evaluate(() => window.__captureTimeline.map(({ at, ...event }) => ({
    ...event,
    offsetMs: at - window.__captureStart
  })));
  const video = page.video();
  await page.close();
  const rawVideo = await video.path();
  await context.close();

  const playbackSeconds = (completedAt - startedAt) / 1000;
  const targetDuration = playbackSeconds + 1;
  const rawDuration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', rawVideo]));
  const syncMarker = detectSyncMarker(rawVideo);
  const trimStart = syncMarker.trimStart;
  const audioFiles = await extractAudioFiles(skit, timeline, tempDir);
  const mp4Path = path.join(outputDir, `${skitId}.mp4`);
  createMp4({ rawVideo, output: mp4Path, trimStart, duration: targetDuration, audioFiles });

  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4Path]));
  const manifest = {
    skit: skitId,
    title: skit.meta?.title || skitId,
    orientation: portrait ? 'portrait' : 'landscape',
    capturedAt: new Date().toISOString(),
    playbackSeconds,
    capturedDialogueLines: timeline.length,
    expectedDialogueLines: skit.script.filter(beat => beat.do === 'say').length,
    audioLinesMuxed: audioFiles.length,
    dialogueTiming: audioFiles.map(audio => ({
      lineIndex: audio.index,
      offsetMs: audio.delayMs,
      effectivePlaybackRate: audio.effectivePlaybackRate,
      volume: audio.volume
    })),
    synchronization: {
      method: 'visual-marker',
      rawVideoDuration: rawDuration,
      trimStart,
      markerFrame: syncMarker.frame,
      frameRate: syncMarker.frameRate
    },
    diagnostics: [...new Set(diagnostics)],
    media: {
      video: path.basename(mp4Path),
      cover: path.basename(coverPath),
      still: path.basename(stillPath),
      duration: Number(probe.format.duration),
      size: Number(probe.format.size),
      streams: probe.streams.map(stream => ({ codec: stream.codec_name, type: stream.codec_type, width: stream.width, height: stream.height }))
    }
  };
  await fsp.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fsp.rm(tempDir, { recursive: true, force: true });
  console.log(`Captured ${manifest.title}: ${path.relative(ROOT, mp4Path)} (${playbackSeconds.toFixed(1)}s)`);
  return manifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();
  if (options.all) options.skits = listBundledSkits();
  if (!options.skits.length) throw new Error('Choose --skit NAME or --all.');

  for (const binary of ['ffmpeg', 'ffprobe']) {
    if (spawnSync(binary, ['-version']).status !== 0) throw new Error(`${binary} is required.`);
  }

  const server = await ensureServer(options.baseUrl);
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const manifests = [];
    for (const skit of options.skits) manifests.push(await captureSkit(browser, skit, options));
    const failures = manifests.filter(item => item.diagnostics.length || item.capturedDialogueLines !== item.expectedDialogueLines || item.audioLinesMuxed !== item.expectedDialogueLines);
    if (failures.length) {
      console.error(`Capture completed with review warnings in ${failures.length} skit(s).`);
      process.exitCode = 2;
    }
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
