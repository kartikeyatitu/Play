"""Sandbox E2E for Sprint 3: Today screen pulse (team, money, absent students)."""
from playwright.sync_api import sync_playwright
exec(open(__import__("os").path.join(__import__("os").path.dirname(__file__), "payroll.py")).read().split("results = []")[0])

results = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for mobile in (False, True):
        ctx, page = login(b, "9000000001", "/org", mobile=mobile)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        page.goto(f"{BASE}/org", wait_until="networkidle")
        page.wait_for_timeout(2000)
        for e in page.get_by_text("Skip", exact=True).all():
            if e.is_visible(): e.click(); break
        page.wait_for_timeout(800)
        tag = "mobile" if mobile else "desktop"
        page.screenshot(path=f"{OUT}/30-today-{tag}.png", full_page=True)
        body = page.inner_text("body")
        results.append((f"{tag}: absent today section", "Absent today (2)" in body))
        results.append((f"{tag}: team check-in line", "checked in" in body and "Team:" in body))
        results.append((f"{tag}: month money strip", "this month so far" in body.lower()))
        link = page.locator('a[href^="https://wa.me/"]')
        href = link.first.get_attribute("href") if link.count() else ""
        results.append((f"{tag}: WhatsApp link to parent", href.startswith("https://wa.me/") and "missed" in href))
        results.append((f"{tag}: no page errors", not errors))
        if mobile:
            results.append(("no sideways scroll on phone", not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")))
        ctx.close()
    b.close()
for n, ok in results: print(("PASS " if ok else "FAIL ") + n)
