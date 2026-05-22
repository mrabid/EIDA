from PIL import Image
from pathlib import Path
from collections import deque

p = Path(r'D:/EidA/assets/EidT.png')
img = Image.open(str(p)).convert('RGBA')
W,H = img.size
px = img.load()

def lum(x,y):
    r,g,b,a = px[x,y]
    return (r*0.2126 + g*0.7152 + b*0.0722), a

visited = [[False]*H for _ in range(W)]

best = None
best_count = 0

# scan seeds in left area
for sx in range(40, W//2, 60):
    for sy in range(200, H-200, 80):
        l,a = lum(sx,sy)
        if a<200 or l<200:
            continue
        # BFS flood fill for pixels with lum>180 and alpha>200
        q = deque()
        q.append((sx,sy))
        comp = []
        local_visited = set()
        while q:
            x,y = q.popleft()
            if x<0 or x>=W or y<0 or y>=H: continue
            if (x,y) in local_visited: continue
            ll,aa = lum(x,y)
            if aa<200 or ll<180: continue
            local_visited.add((x,y))
            comp.append((x,y))
            # neighbors 4-dir
            q.append((x+1,y)); q.append((x-1,y)); q.append((x,y+1)); q.append((x,y-1))
        if len(comp) > best_count:
            best_count = len(comp)
            xs = [c[0] for c in comp]
            ys = [c[1] for c in comp]
            minx,miny,maxx,maxy = min(xs), min(ys), max(xs), max(ys)
            best = (minx,miny,maxx,maxy,best_count)

if not best:
    print('NOT FOUND')
else:
    minx,miny,maxx,maxy,count = best
    print('SRC_BBOX', (minx,miny,maxx,maxy), 'PIXELS', count)
    scale = 1080.0 / W
    cminx = int(minx*scale)
    cminy = int(miny*scale)
    cmaxx = int(maxx*scale)
    cmaxy = int(maxy*scale)
    print('CANVAS_BBOX', (cminx,cminy,cmaxx,cmaxy))
    print('CANVAS_CENTER', ((cminx+cmaxx)//2, (cminy+cmaxy)//2))
