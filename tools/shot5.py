import asyncio, json
from playwright.async_api import async_playwright
async def snap(b, cam, name, tick=7200, w=1000, h=640, q=""):
    ctx = await b.new_context(viewport={"width":w,"height":h}, device_scale_factor=1)
    sd = {"seed":"かしたれ","tick":tick,"cam":cam,"speed":0,"seen":""}
    await ctx.add_init_script(f"localStorage.setItem('dungeon-aquarium-v1', {json.dumps(json.dumps(sd))});")
    page = await ctx.new_page()
    await page.goto("file:///home/claude/da/dist/index.html"+q)
    await page.wait_for_timeout(2500)
    await page.screenshot(path=f"build/{name}.png")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        await snap(b, {"x":98*16+8,"y":119*16+8,"zoom":3}, "walls3x")
        await snap(b, {"x":98*16+8,"y":119*16+8,"zoom":3}, "walls3x_albedo", q="?debug=albedo")
        await b.close()
asyncio.run(main())
