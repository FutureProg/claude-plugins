import glob, os, json, shutil
import numpy as np
from PIL import Image
from mkapng import build
MOD='/Users/nick/Dev/Claude Plugins/Fuecoco'
POKE={'778':'mimikyu','710':'pumpkaboo','425':'drifloon'}
SIZE=128; MARGIN=14; MINCROP=316; LIM=94
FPS={'standing':20,'moving':20,'damage':20,'disguise':20,'idle':10,'idlehappy':10,'idledrowse':10,'idlesleep':10,'sleep1':5,'sleep2':5,'sleep3':5}
meta={}
for pid,name in POKE.items():
    anims=sorted(d for d in os.listdir(f'out/{pid}') if os.path.isdir(f'out/{pid}/{d}'))
    boxes={}
    for a in anims:
        fs=sorted(glob.glob(f'out/{pid}/{a}/*.png'))
        x0=y0=9999;x1=y1=-1
        for f in fs:
            b=Image.open(f).convert('RGBA').getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
            if b: x0=min(x0,b[0]);y0=min(y0,b[1]);x1=max(x1,b[2]);y1=max(y1,b[3])
        boxes[a]=(x0,y0,x1,y1,len(fs))
    maxdim=max(max(b[2]-b[0],b[3]-b[1]) for b in boxes.values())
    crop=max(MINCROP,round(maxdim/0.72))  # biggest pose fills ~72% of the frame, like Fuecoco's
    print(name,'crop',crop,'(largest animation',maxdim,'px)')
    meta[name]={}
    for a in anims:
        x0,y0,x1,y1,n=boxes[a]
        cx=(x0+x1)/2; left=round(cx-crop/2); top=round(y1+MARGIN-crop)
        fs=sorted(glob.glob(f'out/{pid}/{a}/*.png'))
        pd=f'proc/{name}/{a}'; os.makedirs(pd,exist_ok=True)
        for f in glob.glob(pd+'/*.png'): os.remove(f)
        fd=f'{MOD}/frames/{name}'; os.makedirs(fd,exist_ok=True)
        for f in glob.glob(f'{fd}/{a}-*.png'): os.remove(f)
        for i,f in enumerate(fs):
            im=Image.open(f).convert('RGBA').crop((left,top,left+crop,top+crop)).resize((SIZE,SIZE),Image.LANCZOS)
            im.save(f'{pd}/{i:03d}.png',optimize=True); shutil.copy(f'{pd}/{i:03d}.png',f'{fd}/{a}-{i:03d}.png')
        ms=round(1000/FPS[a])
        # desktop: palette APNG that fits the SVG source cap; slow ones drop frames first
        ad=f'{MOD}/anim/{name}'; os.makedirs(ad,exist_ok=True)
        done=False
        for dec in ((1,) if FPS[a]>=10 else (1,2,3)):
            for nc in (84,64,48,32):
                nn,kb=build(pd,f'{ad}/{a}.png',dec,ms*dec,nc)
                if kb<=LIM: done=True;break
            if done:break
        if not done:
            print('  !! could not fit',a,kb)
        meta[name][a]={'frames':n,'ms':ms,'apngKB':kb,'apngDec':dec,'apngColors':nc}
        print(f'  {a:10s} {n:4d} frames @{ms}ms  apng {kb} KB (every {dec}, {nc} colours)')
        if a=='standing':
            build(pd,f'{ad}/happy1.png',1,ms,nc,loop=1)
json.dump(meta,open('meta.json','w'),indent=1)
