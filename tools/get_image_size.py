import sys
import subprocess
from pathlib import Path

try:
    from PIL import Image
except Exception:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'Pillow'])
    from PIL import Image

p = Path(r'D:/EidA/assets/EidT.png')
if not p.exists():
    print('ERROR: not found', p)
    sys.exit(2)
im = Image.open(str(p))
print('IMAGE_SIZE', im.size)
print('MODE', im.mode)
