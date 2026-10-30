"""Compare active lesson media with the files inside a built Android bundle."""
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
bundle = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
expected = set()
for module in ('src/constants/lessons.ts', 'src/constants/lesson-media.ts'):
    source = ROOT / module
    for ref in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", source.read_text(encoding='utf-8')):
        file = (source.parent / ref).resolve()
        if file.suffix.lower() in ('.mp4', '.png') and file.is_relative_to(ROOT / 'assets/lessons'):
            expected.add(file)
if not expected:
    raise RuntimeError('No active lesson media found')
sha = lambda data: hashlib.sha256(data).hexdigest()
def pixels(data):
    with Image.open(io.BytesIO(data)) as image:
        rgba = image.convert('RGBA')
        return (rgba.size, sha(rgba.tobytes()))

byte_map, png_entries = {}, []
records = []
with zipfile.ZipFile(bundle) as archive:
    for entry in archive.infolist():
        if entry.filename.lower().endswith(('.mp4', '.png')):
            data = archive.read(entry)
            byte_map.setdefault(sha(data), []).append(entry.filename)
            if entry.filename.lower().endswith('.png'):
                png_entries.append(entry.filename)
    pixel_map = None
    for file in sorted(expected):
        raw = file.read_bytes()
        digest = sha(raw)
        matches = byte_map.get(digest, [])
        match_type = 'byte-identical'
        if not matches and file.suffix.lower() == '.png':
            if pixel_map is None:
                pixel_map = {}
                for name in png_entries:
                    try:
                        pixel_map.setdefault(pixels(archive.read(name)), []).append(name)
                    except (OSError, ValueError):
                        pass
            matches = pixel_map.get(pixels(raw), [])
            match_type = 'pixels-identical-android-png-reencoding'
        records.append({'source': file.relative_to(ROOT).as_posix(), 'sha256': digest,
                        'bundleEntries': matches, 'status': 'PASS' if matches else 'FAIL',
                        'comparison': match_type if matches else 'missing-or-different'})
failed = [r['source'] for r in records if r['status'] == 'FAIL']
result = {'status': 'FAIL' if failed else 'PASS', 'bundle': str(bundle),
          'bundleSha256': sha(bundle.read_bytes()), 'mediaCount': len(records),
          'videos': sum(r['source'].endswith('.mp4') for r in records),
          'pngs': sum(r['source'].endswith('.png') for r in records),
          'failed': failed, 'records': records}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: result[key] for key in ('status', 'mediaCount', 'videos', 'pngs', 'failed')}, ensure_ascii=False))
sys.exit(1 if failed else 0)
