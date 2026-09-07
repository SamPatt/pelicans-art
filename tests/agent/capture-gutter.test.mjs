import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from '../../scripts/theater/project.mjs';

const cli = path.resolve('scripts/theater.mjs');
async function invoke(args) {
  const stdout = await run(process.execPath, [cli, ...args]);
  return JSON.parse(stdout.toString());
}
function binary(command, args) {
  const result = spawnSync(command, args, {maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}

for (const orientation of ['landscape', 'portrait']) {
  test(`capture crops its synchronization gutter without hiding ${orientation} artwork or opening audio`, {timeout: 90000}, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-gutter-'));
    t.after(() => fs.rm(root, {recursive: true, force: true}));
    await invoke(['init', root, '--silent']);
    const skitPath = path.join(root, 'skit.json');
    const skit = JSON.parse(await fs.readFile(skitPath));
    skit.stage.orientation = orientation;
    // A solid green stage makes the old magenta marker AND black paint-over
    // detectable. No downloaded fixture or speech service is involved.
    skit.assets.backgrounds[skit.stage.background] = 'assets/green.svg';
    await fs.writeFile(path.join(root, 'assets/green.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#00cc00"/></svg>');
    skit.script = [{do: 'say', who: 'customer', line: 'The opening line.'}, {do: 'pause', duration: 0.2}];
    binary('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', path.join(root, 'assets/tone.wav')]);
    skit.assets.audio = {'line-0': 'assets/tone.wav'};
    await fs.writeFile(skitPath, JSON.stringify(skit));
    await fs.writeFile(path.join(root, 'project.json'), JSON.stringify({version: 1, tts: {engine: 'pocket'}}));
    const rendered = await invoke(['render', root]);
    const manifest = JSON.parse(await fs.readFile(rendered.manifest));
    if (orientation === 'landscape') {
      const inspection = await invoke(['inspect', root]);
      assert.equal(inspection.ok, true);
      assert.ok(Math.abs(inspection.pacing.lines[0].durationSeconds - 1) < 0.05);
      assert.deepEqual(inspection.pacing.unmeasuredLines, []);
    }
    const folder = path.dirname(rendered.manifest);
    const video = path.join(folder, manifest.media.video);
    const [width, height] = orientation === 'portrait' ? [720, 1280] : [1280, 720];
    assert.equal(manifest.synchronization.markerOutsideStage, true);
    assert.equal(manifest.synchronization.gutterPixels, 32);
    assert.equal(manifest.audioLinesMuxed, 1);
    assert.equal(manifest.capturedDialogueLines, 1);
    assert.ok(Math.abs(manifest.dialogueTiming[0].durationSeconds - 1) < 0.05, 'Capture records decoded duration for pacing without extra probes');
    assert.deepEqual(manifest.diagnostics, []);
    for (const file of [video, path.join(folder, manifest.media.cover), path.join(folder, manifest.media.still)]) {
      const probe = JSON.parse(binary('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file]));
      const stream = probe.streams.find(s => s.codec_type === 'video');
      assert.equal(stream.width, width);
      assert.equal(stream.height, height);
    }
    const pixels = binary('ffmpeg', ['-v', 'error', '-i', video, '-t', '0.32', '-vf', 'format=rgb24,crop=32:32:0:0', '-f', 'rawvideo', 'pipe:1']);
    assert.ok(pixels.length >= 32 * 32 * 3 * 5);
    for (let i = 0; i < pixels.length; i += 3) {
      assert.ok(pixels[i] < 45 && pixels[i + 1] > 160 && pixels[i + 2] < 45, `Opening pixel ${i / 3} is not scene green: ${pixels.subarray(i, i + 3)}`);
    }
    const samples = binary('ffmpeg', ['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1']);
    let onset = -1;
    for (let i = 0; i < samples.length; i += 4) if (Math.abs(samples.readFloatLE(i)) > 0.01) { onset = i / 4 / 48000; break; }
    assert.ok(onset >= 0, 'Opening audio is present');
    assert.ok(Math.abs(onset - manifest.dialogueTiming[0].offsetMs / 1000) < 0.08, 'Opening audio stays aligned with playback start');
    assert.ok(samples.length / 4 / 48000 >= onset + 0.95, 'The full opening utterance remains in the export');
  });
}
