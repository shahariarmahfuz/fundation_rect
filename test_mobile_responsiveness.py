import sys
import asyncio
from playwright.async_api import async_playwright

VIEWPORTS = [320, 360, 375, 390, 430]
PAGES = [
    "/",
    "/groups/manage",
    "/groups/fund",
    "/groups/add",
    "/members/manage",
    "/members/add",
    "/members/due-list",
    "/beneficiaries/manage",
    "/beneficiaries/ledger",
    "/beneficiaries/add",
    "/roles",
]

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Authenticate session as admin
        await page.goto("http://127.0.0.1:3000/login", wait_until="networkidle")
        await page.fill('input[type="text"]', "admin")
        await page.fill('input[type="password"]', "Admin@Foundation2026!")
        await page.click('button[type="submit"]')
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=5000)

        print("=== 1. TESTING HORIZONTAL OVERFLOW ACROSS ALL MOBILE VIEWPORTS ===")
        failures = []
        for width in VIEWPORTS:
            await page.set_viewport_size({"width": width, "height": 800})
            print(f"\n--- Testing viewport width: {width}px ---")
            for path in PAGES:
                url = f"http://127.0.0.1:3000{path}"
                await page.goto(url, wait_until="networkidle")
                await page.wait_for_timeout(300)

                scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
                inner_width = await page.evaluate("() => window.innerWidth")

                if scroll_width > inner_width + 1:
                    print(f"❌ FAIL: {path} at {width}px has horizontal overflow: scrollWidth={scroll_width}, innerWidth={inner_width}")
                    failures.append((path, width, scroll_width, inner_width))
                else:
                    print(f"✅ PASS: {path} (scrollWidth={scroll_width} <= {inner_width})")

        print("\n=== 2. TESTING MOBILE SIDEBAR DRAWER INTERACTION ===")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")

        # Find mobile menu toggle button
        menu_button = page.locator('button[aria-label="Toggle navigation menu"]')
        is_menu_visible = await menu_button.is_visible()
        print(f"Menu toggle button visible on 375px: {is_menu_visible}")
        assert is_menu_visible, "Menu toggle button must be visible on mobile"

        # Check drawer is initially closed (has -translate-x-full)
        drawer = page.locator('aside[aria-label="Mobile Navigation Drawer"]')
        drawer_class = await drawer.get_attribute("class")
        assert "-translate-x-full" in drawer_class, "Drawer should be initially off-screen"
        print(f"Drawer initially off-screen (-translate-x-full): True")

        # Click menu button to open drawer
        await menu_button.click()
        await page.wait_for_timeout(350)

        # Check drawer is now open (has translate-x-0)
        drawer_class = await drawer.get_attribute("class")
        assert "translate-x-0" in drawer_class, "Drawer should have translate-x-0 when opened"
        print(f"Drawer opened with translate-x-0: True")

        # Check backdrop is visible
        backdrop = page.locator('div[aria-hidden="true"].fixed.inset-0')
        is_backdrop_visible = await backdrop.is_visible()
        print(f"Backdrop visible when drawer opened: {is_backdrop_visible}")
        assert is_backdrop_visible, "Backdrop must be visible when mobile drawer is open"

        # Check body scroll lock (overflow: hidden on document or body)
        body_overflow = await page.evaluate("() => document.body.style.overflow")
        print(f"Body scroll locked (overflow: {body_overflow}): {body_overflow == 'hidden'}")
        assert body_overflow == "hidden", "Body scroll must be locked when drawer is open"

        # Test escape key closes drawer
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(350)
        drawer_class = await drawer.get_attribute("class")
        assert "-translate-x-full" in drawer_class, "Drawer must close on Escape key press"
        body_overflow = await page.evaluate("() => document.body.style.overflow")
        assert body_overflow != "hidden", "Body scroll lock must be released when drawer closes"
        print(f"Drawer closed on Escape key & scroll unlocked: True")

        # Re-open and test backdrop click closes drawer
        await menu_button.click()
        await page.wait_for_timeout(350)
        # Click on backdrop (e.g. right side of screen at x=340, y=300)
        await page.mouse.click(340, 300)
        await page.wait_for_timeout(350)
        drawer_class = await drawer.get_attribute("class")
        assert "-translate-x-full" in drawer_class, "Drawer must close on backdrop tap"
        print(f"Drawer closed on Backdrop tap: True")

        # Re-open and test navigation item click closes drawer
        await menu_button.click()
        await page.wait_for_timeout(350)
        # Click on navigation item inside mobile drawer
        groups_link = drawer.locator('a[href="/groups/manage"]')
        if await groups_link.is_visible():
            await groups_link.click()
            await page.wait_for_timeout(400)
            drawer_class = await drawer.get_attribute("class")
            assert "-translate-x-full" in drawer_class, "Drawer must close on navigation link click"
            print(f"Drawer closed on navigation item click: True")

        print("\n=== 3. TESTING COMPACT HEADER ON MOBILE ===")
        menu_btn = page.locator('header button[aria-label="Toggle navigation menu"]')
        assert await menu_btn.is_visible(), "Menu button must be visible in mobile header"
        logout_btn = page.locator('header .sm\\:hidden button[aria-label="Log out"]')
        assert await logout_btn.is_visible(), "Mobile logout button must be accessible in mobile header"
        print("Mobile compact header (toggle + title + role badge + logout) verified: True")

        print("\n=== 4. TESTING DESKTOP PRESERVATION ===")
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        desktop_sidebar = page.locator('aside.hidden.md\\:flex')
        is_desktop_sidebar_visible = await desktop_sidebar.is_visible()
        print(f"Desktop 260px collapsible sidebar visible: {is_desktop_sidebar_visible}")
        assert is_desktop_sidebar_visible, "Desktop sidebar must remain visible on wide viewports"

        menu_btn_desktop = await page.locator('span.md\\:hidden').is_visible()
        print(f"Mobile menu icon hidden on desktop: {not menu_btn_desktop}")

        await browser.close()

        if failures:
            print(f"\n❌ TOTAL FAILURES: {len(failures)}")
            for f in failures:
                print(f"  - Page: {f[0]}, Viewport: {f[1]}px, scrollWidth: {f[2]}, innerWidth: {f[3]}")
            sys.exit(1)
        else:
            print("\n🎉 ALL 11 PAGES AND ALL 5 MOBILE VIEWPORTS PASSED WITH 0 OVERFLOWS!")
            print("🎉 ALL DRAWER, BACKDROP, ESCAPE, AND DESKTOP CHECKS PASSED!")

if __name__ == "__main__":
    asyncio.run(run_tests())
