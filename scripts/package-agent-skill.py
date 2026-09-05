#!/usr/bin/env python3
"""Build a deterministic portable skill ZIP and SHA-256 receipt for the static site."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib, json
root = Path(__file__).resolve().parent.parent
source = root / 'skills/pelican-theater'
out = root / 'src/downloads'
out.mkdir(exist_ok=True)
target = out / 'pelican-theater-1.0.0.zip'
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            info = ZipInfo('pelican-theater/' + file.relative_to(source).as_posix(), (2026, 9, 5, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
(out / 'pelican-theater-1.0.0.json').write_text(json.dumps({'version':'1.0.0','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':'SamPatt/pelicans-art','ref':'codex/release-prep'}, indent=2)+'\n')
print(target)
