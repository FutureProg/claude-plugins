import numpy as np, glob, os, sys, base64
from PIL import Image
LEVELS=np.array([85,170,255])
def build(srcdir, out, dec, ms, ncolors, size=128, loop=0):
    fs=sorted(glob.glob(srcdir+'/*.png'))[::dec]
    ims=[Image.open(f).convert('RGBA') for f in fs]
    if size!=ims[0].size[0]: ims=[i.resize((size,size),Image.LANCZOS) for i in ims]
    arrs=[np.asarray(i) for i in ims]
    # colour palette from every opaque-ish pixel (alpha handled separately)
    px=np.concatenate([a.reshape(-1,4)[a.reshape(-1,4)[:,3]>128][::7,:3] for a in arrs])
    side=int(np.ceil(np.sqrt(len(px)))); buf=np.zeros((side*side,3),np.uint8); buf[:len(px)]=px; buf[len(px):]=px[0]
    qimg=Image.fromarray(buf.reshape(side,side,3),'RGB').quantize(colors=ncolors,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
    cols=np.array(qimg.getpalette()[:ncolors*3]).reshape(-1,3).astype(np.int32)
    # palette: index 0 transparent, then ncolors x 3 alpha levels
    entries=[(0,0,0,0)]+[(int(c[0]),int(c[1]),int(c[2]),int(l)) for c in cols for l in LEVELS]
    pl=[v for e in entries for v in e[:3]]; pl+= [0]*(768-len(pl)); tr=bytes(e[3] for e in entries)
    P=[]
    for a in arrs:
        flat=a.reshape(-1,4).astype(np.int32)
        d=((flat[:,None,:3]-cols[None])**2).sum(2); ci=d.argmin(1)
        al=flat[:,3]; ai=np.abs(al[:,None]-LEVELS[None]).argmin(1)
        idx=np.where(al<43,0,1+ci*3+ai).astype(np.uint8).reshape(a.shape[:2])
        im=Image.fromarray(idx,'P'); im.putpalette(pl); im.info['transparency']=tr; P.append(im)
    P[0].save(out,save_all=True,append_images=P[1:],duration=ms,loop=loop,optimize=False,disposal=0,blend=0)
    return len(P),round(os.path.getsize(out)/1024)
if __name__=='__main__':
    n=int(sys.argv[1]); print(build('proc/stand','proc/stand.shared.png',1,50,n))
    uri='data:image/png;base64,'+base64.b64encode(open('proc/stand.shared.png','rb').read()).decode()
    open('t2.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><image href="{uri}" x="0" y="0" width="128" height="128"/></svg>')
