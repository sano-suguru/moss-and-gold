import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    sd = json.load(open('build/save.json'))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        for name, cam in json.loads(sys.argv[1]):
            ctx = await b.new_context(viewport={"width":1000,"height":640}, device_scale_factor=1)
            sd2 = dict(sd); sd2['cam'] = cam
            await ctx.add_init_script(f"localStorage.setItem('dungeon-aquarium-v2', {json.dumps(json.dumps(sd2))});")
            page = await ctx.new_page()
            logs=[]
            page.on("pageerror", lambda e: logs.append(str(e)))
            await page.goto("file:///home/claude/da/dist/index.html" + cam.get("q", ""))
            await page.wait_for_timeout(3000)
            print(name, await page.evaluate("document.getElementById('clock').textContent"), logs)
            await page.screenshot(path=f"build/{name}.png")
            await ctx.close()
        await b.close()
asyncio.run(main())
