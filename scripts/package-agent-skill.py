#!/usr/bin/env python3
"""Build a deterministic portable skill ZIP and SHA-256 receipt for the static site."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib, json
root = Path(__file__).resolve().parent.parent
source = root / 'skills/pelican-theater'
out = root / 'src/downloads'
out.mkdir(exist_ok=True)
version = '1.0.6'
# Runtime verified by the full CLI rehearsal; packaging edits do not advance it.
runtime_ref = '5992dc493ddad9b461cf1c76d1e20f81a30ffff1'
target = out / f'pelican-theater-{version}.zip'
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            info = ZipInfo('pelican-theater/' + file.relative_to(source).as_posix(), (2026, 9, 5, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
(out / f'pelican-theater-{version}.json').write_text(json.dumps({'version':version,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':'SamPatt/pelicans-art','ref':runtime_ref}, indent=2)+'\n')
print(target)
