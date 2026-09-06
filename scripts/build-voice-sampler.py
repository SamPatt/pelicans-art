#!/usr/bin/env python3
"""Generate static auditions from the running pinned Pocket service (no LLM calls)."""
import hashlib, json, pathlib, subprocess, tempfile, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'scripts/theater/pocket-voices.json').read_text())
profile=json.loads((ROOT/'scripts/theater/pocket-profile.json').read_text())
endpoint='http://127.0.0.1:8001'
health=json.load(urllib.request.urlopen(endpoint+'/health'))
if health.get('profile') != profile or set(health.get('voicePresets',[])) != set(catalog['voices']):
    raise SystemExit('Running Pocket profile or voice catalog does not match the pinned runtime.')
line="Good evening. I was told this was a perfectly ordinary job. Why is there a pelican in my office?"
out=ROOT/'src/media/voice-samples';out.mkdir(parents=True,exist_ok=True)
rows=[]
for voice in catalog['voices']:
    request=urllib.request.Request(endpoint+'/tts',data=urllib.parse.urlencode({'text':line,'voice_url':voice}).encode())
    with tempfile.TemporaryDirectory() as tmp:
        wav=pathlib.Path(tmp)/'sample.wav';wav.write_bytes(urllib.request.urlopen(request,timeout=180).read())
        target=out/(voice+'.mp3')
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-af','loudnorm=I=-18:TP=-2:LRA=11','-codec:a','libmp3lame','-q:a','4',str(target)],check=True)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
    rows.append({'id':voice,'audio':f'media/voice-samples/{voice}.mp3','duration':duration,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    print(voice,duration,flush=True)
(ROOT/'src/voice-samples.json').write_text(json.dumps({'schemaVersion':1,'sampleText':line,'profile':profile,'voiceCatalog':catalog,'processing':'Loudness normalized to -18 LUFS; original tempo and pitch.','voices':rows},indent=2)+'\n')
