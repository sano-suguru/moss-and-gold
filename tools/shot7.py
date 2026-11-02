import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        for name, cam, tick in json.loads(sys.argv[1]):
            ctx = await b.new_context(viewport={"width":1000,"height":640}, device_scale_factor=1)
            sd = {"v":2,"seed":"かしたれ","tick":tick,"cam":cam,"speed":30,"seen":""}
            await ctx.add_init_script(f"localStorage.setItem('dungeon-aquarium-v2', {json.dumps(json.dumps(sd))});")
            page = await ctx.new_page()
            logs=[]
            page.on("pageerror", lambda e: logs.append(str(e)))
            await page.goto("file:///home/claude/da/dist/index.html")
            await page.wait_for_timeout(9000)
            await page.click("[data-speed='0']"); await page.wait_for_timeout(600)
            err = await page.evaluate("document.getElementById('error').hidden ? '' : document.getElementById('error').textContent")
            print(name, await page.evaluate("document.getElementById('clock').textContent"), err, logs)
            await page.screenshot(path=f"build/{name}.png")
            await ctx.close()
        await b.close()
asyncio.run(main())
