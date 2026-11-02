import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    shots = json.load(open('build/shots.json')); save = open('build/save.json').read()
    want = sys.argv[1].split(',') if len(sys.argv) > 1 else list(shots.keys())
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader"])
        for name in want:
            if name not in shots: continue
            cam = shots[name]
            s = json.loads(save); s['cam'] = cam
            page = await b.new_page(viewport={"width": 1000, "height": 640})
            await page.add_init_script("localStorage.setItem('dungeon-aquarium-v2', %s);" % json.dumps(json.dumps(s)))
            await page.goto("file:///home/claude/da/dist/index.html")
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"build/{name}.png")
            await page.close()
        await b.close()
asyncio.run(main())
