"""場面を撮って一覧画像を作る。比較のときは、いまの画像と以前の画像を左右に並べる。"""
import asyncio, json, os, sys, shutil
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
G = os.path.join(ROOT, 'build', 'gallery')
FONT = next((f for f in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc'] if os.path.exists(f)), None)

async def shoot(scenes):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for s in scenes:
            vp, dpr = ({"width": 390, "height": 844}, 2) if s['device'] == 'phone' else ({"width": 1000, "height": 640}, 1)
            ctx = await b.new_context(viewport=vp, device_scale_factor=dpr)
            data = open(os.path.join(ROOT, s['file'])).read()
            await ctx.add_init_script(f"localStorage.setItem('dungeon-aquarium-v2', {json.dumps(data)});")
            page = await ctx.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            await page.goto('file://' + os.path.join(ROOT, 'dist', 'index.html') + ('' if s['device'] == 'phone' else '#clean'))
            await page.wait_for_timeout(2500)
            await page.screenshot(path=os.path.join(G, s['name'] + '.png'))
            if errs: print(s['name'], errs)
            await ctx.close()
        await b.close()

def font(n):
    return ImageFont.truetype(FONT, n) if FONT else ImageFont.load_default()

def sheet(scenes, dirs, out):
    """dirs：並べるフォルダ（1つなら一覧、2つなら左右の比較）"""
    tw = 480
    rows = []
    for s in scenes:
        ims = []
        for d in dirs:
            f = os.path.join(d, s['name'] + '.png')
            if os.path.exists(f):
                im = Image.open(f).convert('RGB'); im = im.resize((tw, int(im.height * tw / im.width)))
            else:
                im = Image.new('RGB', (tw, 300), (40, 40, 40))
            ims.append(im)
        h = max(i.height for i in ims)
        row = Image.new('RGB', (tw * len(ims) + 10 * (len(ims) - 1), h + 34), (16, 15, 20))
        dr = ImageDraw.Draw(row)
        dr.text((6, 6), s['title'] + ('　（左：以前　右：いま）' if len(dirs) == 2 else ''), fill=(230, 224, 210), font=font(18))
        for i, im in enumerate(ims): row.paste(im, (i * (tw + 10), 34))
        rows.append(row)
    cols = 1 if len(dirs) == 2 else 2
    W = max(r.width for r in rows) * cols + 10 * (cols - 1)
    hs = [max(r.height for r in rows[i:i + cols]) for i in range(0, len(rows), cols)]
    S = Image.new('RGB', (W, sum(hs) + 10 * len(hs)), (8, 8, 10))
    y = 0
    for ri, i in enumerate(range(0, len(rows), cols)):
        for j, r in enumerate(rows[i:i + cols]): S.paste(r, (j * (rows[0].width + 10), y))
        y += hs[ri] + 10
    S.save(out)
    print('一覧：', out)

if __name__ == '__main__':
    args = sys.argv[1:]
    scenes = json.load(open(os.path.join(G, 'scenes.json')))
    if '--only' in args:
        keep = args[args.index('--only') + 1].split(','); scenes = [s for s in scenes if s['name'] in keep]
    if '--no-shoot' not in args: asyncio.run(shoot(scenes))
    if '--label' in args:
        lab = args[args.index('--label') + 1]; d = os.path.join(G, lab); os.makedirs(d, exist_ok=True)
        for s in scenes: shutil.copy(os.path.join(G, s['name'] + '.png'), d)
    if '--compare' in args:
        lab = args[args.index('--compare') + 1]
        sheet(scenes, [os.path.join(G, lab), G], os.path.join(G, f'compare-{lab}.png'))
    else:
        sheet(scenes, [G], os.path.join(G, 'sheet.png'))
