import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width":1000,"height":640}, device_scale_factor=1)
        sd = {"seed":"かしたれ","tick":7200,"cam":{"x":98*16+8,"y":119*16+8,"zoom":3},"speed":0,"seen":""}
        await ctx.add_init_script(f"localStorage.setItem('dungeon-aquarium-v1', {json.dumps(json.dumps(sd))});")
        page = await ctx.new_page()
        await page.goto("file:///home/claude/da/dist/index.html")
        await page.wait_for_timeout(2500)
        await page.screenshot(path="build/final3x.png")
        await page.click("#seedToggle"); await page.wait_for_timeout(300)
        await page.screenshot(path="build/seedpanel.png")
        await ctx.close()
        ctx = await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        await page.goto("file:///home/claude/da/dist/index.html")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="build/phone2.png")
        await b.close()
asyncio.run(main())
