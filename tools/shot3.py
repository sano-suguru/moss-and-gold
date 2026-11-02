import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width":900,"height":600}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.goto("file:///home/claude/da/dist/index.html?debug=albedo")
        await page.wait_for_timeout(2000)
        await page.click("#zoomIn"); await page.wait_for_timeout(1000)
        await page.screenshot(path="build/albedo3x.png")
        await b.close()
asyncio.run(main())
