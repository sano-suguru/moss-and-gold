import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width":1280,"height":800}, device_scale_factor=1)
        page = await ctx.new_page()
        await page.goto("file:///home/claude/da/dist/index.html")
        await page.wait_for_timeout(2500)
        await page.screenshot(path="build/day2x.png")
        await page.click("#zoomOut"); await page.wait_for_timeout(1200)
        await page.screenshot(path="build/day1x.png")
        await page.click("[data-speed='30']")
        await page.wait_for_timeout(29000)
        await page.click("[data-speed='0']"); await page.wait_for_timeout(800)
        print(await page.evaluate("document.getElementById('clock').textContent"))
        await page.screenshot(path="build/night1x.png")
        await page.click("#zoomIn"); await page.click("#zoomIn"); await page.wait_for_timeout(800)
        await page.screenshot(path="build/night3x.png")
        await b.close()
asyncio.run(main())
