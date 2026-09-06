"""Copy the review to an existing private preview directory and add a source archive.
No server is started and no network or public publishing occurs.
"""
from pathlib import Path
import json
import shutil
import sys
import zipfile
here = Path(__file__).resolve().parent
run = here / 'runs' / 'astra-isolated'
destination = Path(sys.argv[1]).resolve()
if destination == here or here in destination.parents:
    raise SystemExit('Choose a delivery directory outside the study source tree.')
shutil.copytree(run / 'review', destination, dirs_exist_ok=True)
archive = destination / 'study-assets.zip'
base_files = [p for p in here.iterdir() if p.is_file()]
files = base_files + list((here / 'prompts').rglob('*')) + list(run.rglob('*'))
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
    for file in sorted(p for p in files if p.is_file()):
        out.write(file, Path('svg-prompt-study') / file.relative_to(here))
print(json.dumps({'review': str(destination / 'index.html'), 'archive': str(archive), 'archiveBytes': archive.stat().st_size}))
