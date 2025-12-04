import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, os, zipfile, random, string
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel
import gc
from urllib.parse import urljoin

# --- PROXY CONFIGURATION ---
PROXY_HOST = "gate.decodo.com"
PROXY_PORT = "10001"
PROXY_USER = "sp7oukpich"
PROXY_PASS = "oHz7RSjbv1W7cafe+7"

def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):

    if plugin_path is None:
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        plugin_path = os.path.join(os.getcwd(), f'proxy_auth_plugin_{random_suffix}.zip')

    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": ["proxy","tabs","unlimitedStorage","storage","<all_urls>","webRequest","webRequestBlocking"],
        "background": { "scripts": ["background.js"] }
    }
    """

    background_js = f"""
    var config = {{
        mode: "fixed_servers",
        rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
    }};
    chrome.proxy.settings.set({{value: config, scope: "regular"}}, function(){{}});
    chrome.webRequest.onAuthRequired.addListener(
        function(details){{
            return {{authCredentials: {{username: "{user}", password: "{password}"}}}};
        }},
        {{urls:["<all_urls>"]}},
        ["blocking"]
    );
    """

    with zipfile.ZipFile(plugin_path, 'w') as z:
        z.writestr("manifest.json", manifest_json)
        z.writestr("background.js", background_js)

    return plugin_path


def scrape_empiremarine(brand, product, oem_number=None, asin_number=None):

    # Create proxy session for request
    session_id = random.randint(100000, 999999)
    session_user = f"{PROXY_USER}-session-{session_id}"
    proxy_plugin = create_proxy_auth_extension(
        host=PROXY_HOST,
        port=PROXY_PORT,
        user=session_user,
        password=PROXY_PASS
    )

    # Chrome Options
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

    # Random User Agent
    UA = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ]
    options.add_argument(f"--user-agent={random.choice(UA)}")

    driver = None

    try:
        driver = uc.Chrome(options=options)
        # polite_delay()

        # Build correct search URL
        query = product.replace(" ", "+")
        url = f"https://empire-marine.com/?s={query}&post_type=product&dgwt_wcas=1"
        print("Scraping:", url)

        driver.get(url)

        # # Auto-scroll to load everything
        # for _ in range(4):
        #     driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        #     time.sleep(1)

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # PRODUCT LISTING ITEMS
        product_cards = soup.select("div.box.price_div a[href]")

        scraped_data = []

        for card in product_cards:

            # Product URL (ALWAYS present)
            product_url = card.get("href", "N/A")

            # Product Name
            name_tag = card.select_one("p.p")
            name = name_tag.get_text(strip=True) if name_tag else "N/A"

            # Price
            price_tag = card.select_one("h3.price-tag b")
            raw_price = price_tag.get_text(strip=True) if price_tag else "NA"

            # Extract numeric
            nums = re.findall(r"[\d,]+(?:\.\d+)?", raw_price)
            price = float(nums[0].replace(",", "")) if nums else None

            scraped_data.append({
                "BRAND": brand,
                "PRODUCT": product,
                "OEM NUMBER": oem_number or "NA",
                "ASIN NUMBER": asin_number or "NA",
                "WEBSITE": "Empire Marine",
                "PRODUCT NAME": name,
                "PRICE": price,
                "CURRENCY": "AED",
                "SELLER RATING": "N/A",
                "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "SOURCE URL": product_url,
            })

        if not scraped_data:
            return {"error": "No products found on NTS UAE search page."}

        save_to_excel("Empire_Marine", scraped_data)
        return {"data": scraped_data}

    except Exception as e:
        return {"error": str(e)}

    finally:
        if driver:
            try: driver.quit()
            except: pass

        if os.path.exists(proxy_plugin):
            try: os.remove(proxy_plugin)
            except: pass

        gc.collect()
