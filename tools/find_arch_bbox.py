from PIL import Image
from pathlib import Path
import sys

p = Path(r'D:/EidA/assets/EidT.png')
if not p.exists():
    print('ERROR: missing', p)
    sys.exit(1)
img = Image.open(str(p)).convert('RGBA')
W,H = img.size
px = img.load()

# Consider pixels in left 60% of image only
max_x = int(W*0.6)

white_coords = []
for y in range(H):
    for x in range(max_x):
        r,g,b,a = px[x,y]
        # brightness
        lum = (r*0.2126 + g*0.7152 + b*0.0722)
        if a>200 and lum>240:
            white_coords.append((x,y))

if not white_coords:
    print('NO_WHITE_PIXELS_FOUND')
    sys.exit(2)

xs = [c[0] for c in white_coords]
ys = [c[1] for c in white_coords]
minx,miny,maxx,maxy = min(xs), min(ys), max(xs), max(ys)
print('SRC_BBOX', (minx,miny,maxx,maxy))
# convert to canvas 1080x1080
scale = 1080.0 / W
cminx = int(minx*scale)
cminy = int(miny*scale)
cmaxx = int(maxx*scale)
cmaxy = int(maxy*scale)
print('CANVAS_BBOX', (cminx,cminy,cmaxx,cmaxy))
# also center point
print('CANVAS_CENTER', ((cminx+cmaxx)//2, (cminy+cmaxy)//2))
