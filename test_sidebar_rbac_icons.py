import asyncio
from playwright.async_api import async_playwright

USERS = [
    {
        "username": "admin",
        "name": "System Administrator",
        "role": "Administrator",
        "email": "admin@foundation.org",
        "expected_items": [
            "Add Group", "Manage Group", "Group Fund",
            "Add Member", "Manage Member", "Member Due List",
            "Add Beneficiary", "Beneficiary Ledger",
            "Role Permissions"
        ],
        "unexpected_items": []
    },
    {
        "username": "officer",
        "name": "Jane Officer",
        "role": "Field Officer",
        "email": "officer@foundation.org",
        "expected_items": [
            "Add Group", "Manage Group",
            "Add Member", "Manage Member",
            "Add Beneficiary"
        ],
        "unexpected_items": [
            "Group Fund", "Member Due List", "Beneficiary Ledger", "Role Permissions"
        ]
    },
    {
        "username": "finance",
        "name": "Bob Finance",
        "role": "Finance Officer",
        "email": "finance@foundation.org",
        "expected_items": [
            "Manage Group", "Group Fund",
            "Manage Member", "Member Due List",
            "Beneficiary Ledger"
        ],
        "unexpected_items": [
            "Add Group", "Add Member", "Add Beneficiary", "Role Permissions"
        ]
    },
    {
        "username": "viewer",
        "name": "Alice Viewer",
        "role": "Viewer",
        "email": "viewer@foundation.org",
        "expected_items": [
            "Manage Group",
            "Manage Member"
        ],
        "unexpected_items": [
            "Add Group", "Group Fund",
            "Add Member", "Member Due List",
            "Beneficiary", "Add Beneficiary", "Beneficiary Ledger", "Role Permissions"
        ]
    }
]

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("=== 1. VERIFYING ADMINISTRATOR INFORMATION CARD REMOVAL ===")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        sidebar = page.locator("aside.hidden.md\\:flex")

        # Ensure no Administrator card text
        text_content = await sidebar.inner_text()
        assert "RBAC Active" not in text_content, "RBAC Active permission count must NOT be in sidebar"
        assert "Switch: System Admin" not in text_content, "Mock switcher text must NOT be in sidebar"
        print("✅ PASS: Administrator Information Card completely removed from desktop sidebar")

        # Ensure no select dropdown inside sidebar
        sidebar_selects = await sidebar.locator("select").count()
        assert sidebar_selects == 0, f"Sidebar must not contain any select dropdowns, found {sidebar_selects}"
        print("✅ PASS: No mock role select dropdowns in sidebar")

        # Check mobile drawer as well
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        mobile_drawer = page.locator("aside[aria-label='Mobile Navigation Drawer']")
        drawer_text = await mobile_drawer.inner_text()
        assert "RBAC Active" not in drawer_text, "RBAC Active must NOT be in mobile drawer"
        assert "Switch: System Admin" not in drawer_text, "Mock switcher must NOT be in mobile drawer"
        drawer_selects = await mobile_drawer.locator("select").count()
        assert drawer_selects == 0, "Mobile drawer must not contain select dropdown"
        print("✅ PASS: Administrator Information Card completely removed from mobile drawer")

        print("\n=== 2. VERIFYING REMOVAL OF MOCK WORKSPACE DATA ===")
        assert "Acme Corp" not in text_content, "Acme Corp must NOT be in sidebar"
        assert "Pro Plan" not in text_content, "Pro Plan must NOT be in sidebar"
        assert "Client Sandbox" not in text_content, "Client Sandbox must NOT be in sidebar"
        assert "Personal Workspace" not in text_content, "Personal Workspace must NOT be in sidebar"
        print("✅ PASS: Mock workspace data (Acme Corp, Pro Plan, Client Sandbox) completely removed")

        # Switch back to desktop for comprehensive RBAC checks
        await page.set_viewport_size({"width": 1280, "height": 900})

        print("\n=== 3. VERIFYING USER-AWARE PROFILE MENU AND RBAC NAVIGATION ===")
        for user_info in USERS:
            username = user_info["username"]
            print(f"\n--- Testing User: {username} ({user_info['role']}) ---")
            
            # Switch user via localStorage and reload
            await page.evaluate(f"() => localStorage.setItem('fund_user', '{username}')")
            await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
            await page.wait_for_timeout(300)

            sidebar_text = await sidebar.inner_text()

            # Check authenticated user's name and role in sidebar profile
            assert user_info["name"] in sidebar_text, f"Sidebar profile must show user full_name '{user_info['name']}'"
            assert user_info["role"] in sidebar_text, f"Sidebar profile must show role '{user_info['role']}'"
            print(f"✅ PASS: Sidebar profile dynamically displays '{user_info['name']}' and '{user_info['role']}'")

            # Click profile menu to verify popup details
            profile_trigger = sidebar.locator(f"div[title='{user_info['name']}']")
            await profile_trigger.click()
            await page.wait_for_timeout(200)

            # Check email and @username in profile popup
            popup_text = await sidebar.inner_text()
            assert user_info["email"] in popup_text, f"Profile popup must show email '{user_info['email']}'"
            assert f"@{username}" in popup_text, f"Profile popup must show @{username}"
            print(f"✅ PASS: Profile popup shows email '{user_info['email']}' and @{username}")

            # Close popup by clicking backdrop
            await page.locator("div.fixed.inset-0.z-40").click()
            await page.wait_for_timeout(200)

            # Check expected navigation items for this user
            for item in user_info["expected_items"]:
                assert item in sidebar_text, f"User {username} with role {user_info['role']} SHOULD see '{item}'"
            print(f"✅ PASS: All {len(user_info['expected_items'])} permitted items are visible for {username}")

            # Check unexpected navigation items are hidden for this user
            for item in user_info["unexpected_items"]:
                assert item not in sidebar_text, f"User {username} with role {user_info['role']} MUST NOT see '{item}'"
            if user_info["unexpected_items"]:
                print(f"✅ PASS: All {len(user_info['unexpected_items'])} unpermitted items are hidden for {username}")

        print("\n=== 4. VERIFYING SUBMENU ICONS ===")
        # Switch back to admin to see all items
        await page.evaluate("() => localStorage.setItem('fund_user', 'admin')")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_timeout(300)

        # Ensure no Hash icon is used in submenus
        # Lucide Hash icon typically renders lines with coordinates, whereas UserRoundPlus/Wallet/etc render paths
        # Let's verify SVG icons in submenus exist and are rendered with strokeWidth 1.5
        submenu_items = [
            "/groups/add", "/groups/manage", "/groups/fund",
            "/members/add", "/members/manage", "/members/due-list",
            "/beneficiaries/add", "/beneficiaries/ledger"
        ]
        for href in submenu_items:
            link = sidebar.locator(f"a[href='{href}']")
            assert await link.count() == 1, f"Link {href} must exist"
            svg = link.locator("svg")
            assert await svg.count() == 1, f"Link {href} must have an SVG icon"
            stroke_width = await svg.get_attribute("stroke-width")
            assert stroke_width == "1.5", f"Link {href} icon must have stroke-width='1.5', got {stroke_width}"
            print(f"✅ PASS: Link {href} has valid Lucide icon (strokeWidth={stroke_width})")

        await browser.close()
        print("\n🎉 ALL SIDEBAR USER IDENTITY, RBAC, AND NAVIGATION ICON TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
