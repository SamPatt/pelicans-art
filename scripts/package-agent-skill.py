#!/usr/bin/env python3
"""Build a deterministic portable skill ZIP and SHA-256 receipt for the static site."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib, json
root = Path(__file__).resolve().parent.parent
source = root / 'skills/pelican-theater'
# Publish the same immutable catalog used by the speech service.
(root / 'src/pocket-voices.json').write_bytes((root / 'scripts/theater/pocket-voices.json').read_bytes())
out = root / 'src/downloads'
out.mkdir(exist_ok=True)
version = '1.0.15'
# Runtime verified by the full CLI rehearsal; packaging edits do not advance it.
runtime_ref = '236e8a0f78b58cd62e20aa0d15d4db3cb1a37c53'
target = out / f'pelican-theater-{version}.zip'
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            info = ZipInfo('pelican-theater/' + file.relative_to(source).as_posix(), (2026, 9, 5, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
(out / f'pelican-theater-{version}.json').write_text(json.dumps({'version':version,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':'SamPatt/pelicans-art','ref':runtime_ref}, indent=2)+'\n')
print(target)
