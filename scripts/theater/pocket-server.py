#!/usr/bin/env python3
"""Pinned, preset-only Pocket service. No aliases, fallback downloads, or voice cloning."""
import argparse
import hashlib
import importlib.metadata
import io
import json
from pathlib import Path
import random
import threading

PROFILE_FILE = Path(__file__).with_name('pocket-profile.json')
PROFILE = json.loads(PROFILE_FILE.read_text())
PROFILE_HASH = hashlib.sha256(json.dumps(PROFILE, separators=(',', ':')).encode()).hexdigest()
VOICE_CATALOG = json.loads(Path(__file__).with_name('pocket-voices.json').read_text())
ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / '.runtime' / 'pocket-april-presets'


def prepare():
    from huggingface_hub import hf_hub_download
    import yaml
    from pocket_tts.utils.config import CONFIGS_DIR
    if importlib.metadata.version('pocket-tts') != '2.1.0':
        raise RuntimeError('This profile requires pocket-tts==2.1.0')
    model = hf_hub_download(PROFILE['model_repository'], PROFILE['model_file'], revision=PROFILE['model_revision'])
    digest = hashlib.sha256()
    with open(model, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != PROFILE['model_sha256']:
        raise RuntimeError('Pinned model SHA-256 mismatch; refusing to load')
    tokenizer = hf_hub_download(PROFILE['model_repository'], PROFILE['tokenizer_file'], revision=PROFILE['tokenizer_revision'])
    if (VOICE_CATALOG['repository'], VOICE_CATALOG['revision'], VOICE_CATALOG['directory']) != (PROFILE['voice_repository'], PROFILE['voice_revision'], PROFILE['voice_directory']):
        raise RuntimeError('Voice catalog does not match the pinned profile')
    voices = {name: hf_hub_download(VOICE_CATALOG['repository'], f"{VOICE_CATALOG['directory']}/{name}.safetensors", revision=VOICE_CATALOG['revision']) for name in VOICE_CATALOG['voices']}
    config = yaml.safe_load((CONFIGS_DIR / f"{PROFILE['language_config']}.yaml").read_text())
    config['weights_path'] = model
    # Both paths point at the verified local file. There is no remote fallback.
    config['weights_path_without_voice_cloning'] = model
    config['flow_lm']['lookup_table']['tokenizer_path'] = tokenizer
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    config_path = ARTIFACTS / 'config.yaml'
    config_path.write_text(yaml.safe_dump(config))
    receipt = {'profile': PROFILE, 'profileHash': PROFILE_HASH, 'config': str(config_path), 'voices': voices, 'voiceCatalog': VOICE_CATALOG}
    (ARTIFACTS / 'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


def serve(port):
    import numpy as np
    import torch
    from pocket_tts import TTSModel
    from fastapi import FastAPI, Form, Header, HTTPException
    from fastapi.responses import Response
    import scipy.io.wavfile
    import uvicorn
    if torch.__version__.split('+')[0] != PROFILE['torch']:
        raise RuntimeError('This profile requires Torch 2.8.0')
    receipt = prepare()
    torch.set_num_threads(PROFILE['threads'])
    model = TTSModel.load_model(config=receipt['config'], temp=PROFILE['temperature'], lsd_decode_steps=PROFILE['decode_steps'], eos_threshold=float(PROFILE['eos_threshold']), quantize=False)
    model.has_voice_cloning = False
    model.to('cpu')
    states = {}  # Load preset states on demand to keep idle memory bounded.
    lock = threading.Lock()
    app = FastAPI()

    @app.get('/health')
    def health():
        return {'ok': True, 'profile': PROFILE, 'profileHash': PROFILE_HASH, 'torch': torch.__version__, 'threads': torch.get_num_threads(), 'voicePresets': list(receipt['voices'])}

    @app.post('/tts')
    def tts(text: str = Form(...), voice_url: str = Form('alba'), x_pelican_pocket_profile: str | None = Header(None)):
        if x_pelican_pocket_profile and x_pelican_pocket_profile != PROFILE_HASH:
            raise HTTPException(409, 'Pocket profile mismatch; use the runtime matching project.json')
        if voice_url not in receipt['voices']:
            raise HTTPException(400, 'Unknown preset voice. Use a name from /health voicePresets. Voice cloning is not enabled.')
        if not text.strip() or len(text) > 4000:
            raise HTTPException(400, 'Text must contain 1–4000 characters')
        with lock:
            if voice_url not in states:
                states[voice_url] = model.get_state_for_audio_prompt(receipt['voices'][voice_url])
            random.seed(PROFILE['seed'])
            np.random.seed(PROFILE['seed'])
            torch.manual_seed(PROFILE['seed'])
            audio = model.generate_audio(states[voice_url], text)
            output = io.BytesIO()
            scipy.io.wavfile.write(output, model.sample_rate, audio.detach().cpu().numpy())
        return Response(output.getvalue(), media_type='audio/wav', headers={'X-Pelican-Pocket-Profile': PROFILE_HASH})

    uvicorn.run(app, host='127.0.0.1', port=port, workers=1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'serve'])
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    if args.command == 'prepare':
        print(json.dumps(prepare()))
    else:
        serve(args.port)
