"""Export original Figma artwork as optimized WebP, without changing artwork or aspect ratios."""
import io, json, pathlib, sys, zipfile
from PIL import Image
source, decoded = map(pathlib.Path, sys.argv[1:3])
nodes = json.loads(decoded.read_text())['nodeChanges']
gid = lambda g: f"{g['sessionID']}:{g['localID']}"
children = {}
for node in nodes:
    if 'parentIndex' in node:
        children.setdefault(gid(node['parentIndex']['guid']), []).append(node)
def image(node):
    if not node.get('visible', True):
        return None
    for paint in node.get('fillPaints', []):
        if paint.get('type') == 'IMAGE' and paint.get('visible', True):
            return bytes(paint['image']['hash']).hex()
    for child in children.get(gid(node['guid']), []):
        found = image(child)
        if found:
            return found
archive = zipfile.ZipFile(source)
destination = pathlib.Path('apps/web/public/assets/figma21')
destination.mkdir(exist_ok=True)
for generated in destination.glob('*.webp'):
    generated.unlink()
manifest = {}
for node in nodes:
    if node['type'] != 'SYMBOL' or not node.get('name', '').startswith('图标/'):
        continue
    digest = image(node)
    if digest and 'images/' + digest in archive.namelist():
        name = node['name'].split('/', 1)[1]
        bitmap = Image.open(io.BytesIO(archive.read('images/' + digest)))
        source_width, source_height = bitmap.size
        if name not in {'forest-background', 'welcome-background', '日签花园'}:
            bitmap.thumbnail((640, 640), Image.Resampling.LANCZOS)
        bitmap.save(destination / (name + '.webp'), 'WEBP', quality=92, method=6, alpha_quality=100)
        optimized = bitmap.size
        manifest[name] = {'node': gid(node['guid']), 'width': source_width, 'height': source_height, 'runtimeWidth': optimized[0], 'runtimeHeight': optimized[1], 'source': digest}
watering = next(node for node in nodes if gid(node['guid']) == '30:1084')
digest = image(watering)
bitmap = Image.open(io.BytesIO(archive.read('images/' + digest)))
width, height = bitmap.size
bitmap.thumbnail((640, 640), Image.Resampling.LANCZOS)
bitmap.save(destination / 'mascot-watering.webp', 'WEBP', quality=92, method=6, alpha_quality=100)
manifest['mascot-watering'] = {'node': '30:1084', 'width': width, 'height': height, 'source': digest, 'runtimeWidth': bitmap.width, 'runtimeHeight': bitmap.height}
(destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f'Exported {len(manifest)} exact Figma assets')
