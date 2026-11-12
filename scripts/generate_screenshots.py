"""
Pipra Platform - Automated Full-Page Screenshot Generator
Captures high-resolution, pixel-perfect screenshots of all platform pages
across both Dark and Light themes and stores them into docs/screenshot/.
"""

import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_SCREENSHOT_DIR = BASE_DIR / "docs" / "screenshot"
DOCS_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 4200
BASE_URL = f"http://localhost:{PORT}"

PAGES = [
    {
        "id": "01_login",
        "route": "#/login",
        "name": "Login Screen",
        "wait_selector": "#login-form, .lc",
        "auth_required": False
    },
    {
        "id": "02_overview",
        "route": "#/overview",
        "name": "Overview Dashboard",
        "wait_selector": ".strip, .stats-grid, .pn",
        "auth_required": True
    },
    {
        "id": "03_applications",
        "route": "#/applications",
        "name": "Applications Registry",
        "wait_selector": ".pn, .card",
        "auth_required": True
    },
    {
        "id": "04_environments",
        "route": "#/environments",
        "name": "Environments & Health",
        "wait_selector": ".pn, .card",
        "auth_required": True
    },
    {
        "id": "05_deploy_wizard",
        "route": "#/deploy",
        "name": "Deployment Wizard",
        "wait_selector": ".wz, .stp, #wizard-form",
        "auth_required": True
    },
    {
        "id": "06_deployment_detail",
        "route": "#/deployments/pipra-deploy-20261028-104838-87ee",
        "name": "Deployment Detail & Log Viewer",
        "wait_selector": ".cols, .tl, .bar",
        "auth_required": True
    },
    {
        "id": "07_history",
        "route": "#/history",
        "name": "Deployment History",
        "wait_selector": ".tw, table",
        "auth_required": True
    },
    {
        "id": "08_infrastructure",
        "route": "#/infrastructure",
        "name": "Infrastructure Nodes",
        "wait_selector": ".tw, table",
        "auth_required": True
    },
    {
        "id": "09_admin",
        "route": "#/admin",
        "name": "Administration & Audit Logs",
        "wait_selector": ".tw, table",
        "auth_required": True
    }
]

def wait_for_server(timeout=15):
    start = time.time()
    print(f"Waiting for Pipra server at {BASE_URL}...")
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f"{BASE_URL}/")
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status == 200:
                    print("Pipra server is live and ready.")
                    return True
        except Exception:
            time.sleep(0.5)
    raise TimeoutError("Server failed to respond within timeout.")

def login_and_get_token():
    url = f"{BASE_URL}/api/auth/login"
    payload = json.dumps({"username": "admin", "password": "pipra-admin-2026"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"Authenticated as {data['user']['username']} ({data['user']['role']})")
        return data["token"]

def capture_all():
    # 1. Start server process
    print("Starting Pipra Server...")
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    server_proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=str(BASE_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    driver = None
    try:
        wait_for_server()
        token = login_and_get_token()

        # Dynamically discover an active/seeded deployment ID for detail view
        try:
            dep_req = urllib.request.Request(f"{BASE_URL}/api/deployments", headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(dep_req) as dep_resp:
                deps = json.loads(dep_resp.read().decode("utf-8"))
                if deps and len(deps) > 0:
                    real_dep_id = deps[0]["id"]
                    for p in PAGES:
                        if p["id"] == "06_deployment_detail":
                            p["route"] = f"#/deployments/{real_dep_id}"
                            print(f"Detail screenshot routed to live deployment: {real_dep_id}")
        except Exception as e:
            print(f"Could not query dynamic deployment ID: {e}")

        # 2. Configure Selenium Headless Chrome
        print("Initializing Headless Chrome driver...")
        opts = Options()
        opts.binary_location = CHROME_BIN
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1440,960")
        opts.add_argument("--hide-scrollbars")

        driver = webdriver.Chrome(options=opts)
        driver.set_window_size(1440, 960)

        # Pre-seed token and setup storage
        driver.get(f"{BASE_URL}/")
        time.sleep(0.5)
        driver.execute_script(f"""
            localStorage.setItem('pipra_token', '{token}');
            localStorage.setItem('pipra-theme', 'dark');
            document.cookie = 'pipra_token={token}; path=/; max-age=86400';
        """)
        time.sleep(0.5)

        # Capture both themes for every page
        themes = ["dark", "light"]
        captured_files = []

        for theme in themes:
            print(f"\n==========================================")
            print(f"--- CAPTURING THEME: {theme.upper()} ---")
            print(f"==========================================")

            for page in PAGES:
                filename = f"{page['id']}_{theme}.png"
                out_path = DOCS_SCREENSHOT_DIR / filename
                print(f"Capturing [{theme.upper()}] {page['name']} -> {filename}...")

                # Construct direct URL
                target_url = f"{BASE_URL}/{page['route']}"
                driver.get(target_url)

                # Set session token and theme in localStorage synchronously
                if page["auth_required"]:
                    driver.execute_script(f"""
                        localStorage.setItem('pipra_token', '{token}');
                        localStorage.setItem('pipra-theme', '{theme}');
                        document.documentElement.setAttribute('data-theme', '{theme}');
                    """)
                else:
                    driver.execute_script(f"""
                        localStorage.setItem('pipra-theme', '{theme}');
                        document.documentElement.setAttribute('data-theme', '{theme}');
                    """)

                # Trigger route re-evaluation if needed
                driver.get(target_url)
                
                # Wait for content
                try:
                    WebDriverWait(driver, 6).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, page["wait_selector"]))
                    )
                except Exception as e:
                    print(f"  Note: Wait timeout on {page['wait_selector']} for {page['name']}, proceeding with current paint.")

                # Wait 1.2s for animations, SVG icons, and state transitions to settle
                time.sleep(1.2)

                # Optional: Adjust window height to full page height if content overflows
                try:
                    total_height = driver.execute_script("return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 900);")
                    if total_height > 960:
                        driver.set_window_size(1440, min(total_height + 40, 2200))
                        time.sleep(0.3)
                except Exception:
                    pass

                # Save screenshot
                driver.save_screenshot(str(out_path))
                file_size = out_path.stat().st_size
                print(f"  [OK] Saved: {filename} ({file_size:,} bytes)")
                captured_files.append((filename, file_size))

                # Reset window size for next page
                driver.set_window_size(1440, 960)

        print("\n==========================================")
        print(f"Successfully generated {len(captured_files)} screenshots in {DOCS_SCREENSHOT_DIR}:")
        print("==========================================")
        for fname, sz in captured_files:
            print(f"  - docs/screenshot/{fname} ({sz / 1024:.1f} KB)")

    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        if server_proc:
            print("\nShutting down Pipra server process...")
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except Exception:
                server_proc.kill()
            print("Server process stopped.")

if __name__ == "__main__":
    capture_all()
