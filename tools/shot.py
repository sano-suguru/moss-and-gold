import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=None, args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        for name, vw, vh, dpr in [("desktop",1280,800,1),("phone",390,844,3)]:
            ctx = await b.new_context(viewport={"width":vw,"height":vh}, device_scale_factor=dpr)
            page = await ctx.new_page()
            logs=[]
            page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
            page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
            await page.goto("file:///home/claude/da/dist/index.html")
            await page.wait_for_timeout(4000)
            await page.screenshot(path=f"build/{name}.png")
            err = await page.evaluate("document.getElementById('error').hidden ? '' : document.getElementById('error').textContent")
            print(name, "error:", err or "-", "| logs:", logs[:5])
            await ctx.close()
        await b.close()
asyncio.run(main())
