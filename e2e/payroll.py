"""Sandbox E2E for Sprint 2: payroll and expenses."""
import re, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = __import__("os").environ.get("E2E_SHOTS", "/tmp")


def login(browser, phone, expect_path, mobile=False):
    ctx = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 900})
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())
    page.goto(f"{BASE}/login", wait_until="networkidle")
    if page.locator("input[type=tel]").count() == 0:
        page.get_by_text("phone", exact=False).first.click()
    page.locator("input[type=tel]").first.fill(phone)
    page.locator("button[type=submit]").first.click()
    page.wait_for_selector("input[maxlength='6']", timeout=30000)
    page.locator("input[maxlength='6']").fill("123456")
    page.get_by_role("button", name="Verify & Login").click()
    page.wait_for_url(f"**{expect_path}**", timeout=60000)
    page.wait_for_load_state("networkidle")
    return ctx, page


def open_tab(page, name, ready_text):
    page.goto(f"{BASE}/org", wait_until="networkidle")
    page.wait_for_timeout(1500)
    for e in page.get_by_text("Skip", exact=True).all():
        if e.is_visible():
            e.click()
            break
    def visible(n):
        return [e for e in page.get_by_role("button", name=n, exact=True).all() if e.is_visible()]
    if not visible(name):
        visible("More")[0].click()
        page.wait_for_timeout(800)
    visible(name)[0].click()
    page.get_by_text(ready_text).first.wait_for(timeout=30000)
    page.wait_for_timeout(1000)


results = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, page = login(b, "9000000001", "/org")
    open_tab(page, "Payroll", "Payroll and expenses")
    page.screenshot(path=f"{OUT}/20-payroll-initial.png", full_page=True)

    arjun = page.locator("li", has_text="Arjun Mehta").first
    results.append(("per-session coach shows 11 sessions x 500 = 5,500", "11 sessions" in arjun.inner_text() and "₹5,500" in arjun.inner_text()))
    neha = page.locator("li", has_text="Neha Kapoor").first
    results.append(("monthly staff shows attendance summary", "absent" in neha.inner_text()))

    # Pay Neha with the suggested absence deduction and a bonus
    neha.get_by_role("button", name="Pay Neha").click()
    dlg = page.get_by_role("dialog")
    dlg.get_by_text("Tap to deduct", exact=False).click()
    dlg.locator("#pay-bonus").fill("1000")
    page.screenshot(path=f"{OUT}/21-pay-dialog.png")
    expected_ded = round(15000 / 31 * 2.5)
    net_text = dlg.get_by_text(re.compile(r"Mark ₹[\d,]+ paid")).inner_text()
    expected_net = 15000 + 1000 - expected_ded
    results.append((f"net = 15000 + 1000 - {expected_ded}", f"₹{expected_net:,}".replace(",", ",") in net_text or str(expected_net) in net_text.replace(",", "")))
    dlg.get_by_role("radio", name="UPI").click()
    dlg.get_by_role("button", name=re.compile("Mark .* paid")).click()
    page.wait_for_timeout(2500)
    neha = page.locator("li", has_text="Neha Kapoor").first
    results.append(("Neha shows Paid · UPI", "Paid" in neha.inner_text() and "UPI" in neha.inner_text()))

    # Save an advance for Arjun without paying
    page.locator("li", has_text="Arjun Mehta").first.get_by_role("button", name="Pay Arjun").click()
    dlg = page.get_by_role("dialog")
    dlg.locator("#pay-advance").fill("500")
    dlg.get_by_role("button", name="Save for later").click()
    page.wait_for_timeout(2500)
    arjun = page.locator("li", has_text="Arjun Mehta").first
    results.append(("Arjun saved with advance, net 5,000, still due", "₹5,000" in arjun.inner_text() and "Due" in arjun.inner_text()))

    # Payslip link
    href = page.locator("li", has_text="Neha Kapoor").first.get_by_role("link", name="Send payslip").get_attribute("href")
    results.append(("payslip goes to WhatsApp with net pay", href.startswith("https://wa.me/919000000002") and "Net%20pay" in href))

    # Expense
    page.get_by_role("button", name="Add expense").click()
    dlg = page.get_by_role("dialog")
    dlg.locator("#exp-amount").fill("8000")
    dlg.locator("#exp-category").select_option("RENT")
    dlg.locator("#exp-note").fill("Court rent October")
    dlg.get_by_role("button", name="Add expense").click()
    page.wait_for_timeout(2500)
    results.append(("expense listed", page.get_by_text("Court rent October").count() > 0))
    page.screenshot(path=f"{OUT}/22-payroll-after.png", full_page=True)

    # Undo paid
    page.locator("li", has_text="Neha Kapoor").first.get_by_role("button", name="Mark unpaid").click()
    page.wait_for_timeout(2500)
    results.append(("undo paid works", "Due" in page.locator("li", has_text="Neha Kapoor").first.inner_text()))

    # Previous month navigation
    page.get_by_role("button", name="Previous month").click()
    page.get_by_text("September 2026", exact=True).wait_for(timeout=20000)
    page.wait_for_timeout(1500)
    results.append(("previous month loads", True))
    ctx.close()

    # Phone layout
    ctx, page = login(b, "9000000001", "/org", mobile=True)
    open_tab(page, "Payroll", "Payroll and expenses")
    page.screenshot(path=f"{OUT}/23-payroll-mobile.png", full_page=True)
    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    results.append(("no sideways scroll on phone", not overflow))
    ctx.close()
    b.close()

for name, ok in results:
    print(("PASS " if ok else "FAIL ") + name)
