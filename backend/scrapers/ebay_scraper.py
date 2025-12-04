import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, os, zipfile, random, string
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel
import gc

# --- PROXY CONFIGURATION ---
PROXY_HOST = "gate.decodo.com"  # Check your dashboard
PROXY_PORT = "10001"             # Check your dashboard
PROXY_USER = "sp7oukpich"    # REPLACE WITH ACTUAL USER
PROXY_PASS = "oHz7RSjbv1W7cafe+7"    # REPLACE WITH ACTUAL PASS

def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
    if plugin_path is None:
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        plugin_path = os.path.join(os.getcwd(), f'proxy_auth_plugin_{random_suffix}.zip')

    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": [
            "proxy",
            "tabs",
            "unlimitedStorage",
            "storage",
            "<all_urls>",
            "webRequest",
            "webRequestBlocking"
        ],
        "background": {
            "scripts": ["background.js"]
        },
        "minimum_chrome_version":"22.0.0"
    }
    """

    background_js = f"""
    var config = {{
            mode: "fixed_servers",
            rules: {{
              singleProxy: {{
                scheme: "{scheme}",
                host: "{host}",
                port: parseInt({port})
              }},
              bypassList: ["localhost"]
            }}
          }};

    chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});

    function callbackFn(details) {{
        return {{
            authCredentials: {{
                username: "{user}",
                password: "{password}"
            }}
        }};
    }}

    chrome.webRequest.onAuthRequired.addListener(
                callbackFn,
                {{urls: ["<all_urls>"]}},
                ['blocking']
    );
    """

    with zipfile.ZipFile(plugin_path, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)

    return plugin_path

def scrape_ebay(brand, product, oem_number=None, asin_number=None):
    # 1. Create Proxy Extension
    session_id = random.randint(100000, 999999)
    session_user = f"{PROXY_USER}-session-{session_id}"
    proxy_plugin = create_proxy_auth_extension(
        host=PROXY_HOST,
        port=PROXY_PORT,
        user=session_user,
        password=PROXY_PASS
    )
    # 2. Configure Chrome Options (VPS Optimized)
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")            # <--- MANDATORY FOR ROOT USER
    options.add_argument("--disable-dev-shm-usage") # <--- MANDATORY FOR VPS MEMORY
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # Load Proxy
    options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

    # Random User Agent
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    ]
    options.add_argument(f"--user-agent={random.choice(user_agents)}")

    driver = None

    try:
        driver = uc.Chrome(options=options)
        # polite_delay()

        # Build dynamic search query
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])
        url = f"https://www.ebay.com/sch/i.html?_nkw={query}"

        driver.get(url)

        time.sleep(random.uniform(3, 6))

        soup = BeautifulSoup(driver.page_source, "html.parser")
        product_cards = soup.select("li.s-card")

        scraped_data = []

        for card in product_cards:
            url_tag = card.select_one("a.s-card__link")
            product_url = url_tag['href'] if url_tag else "N/A"

            name_tag = (
                card.select_one(".s-item__title") or
                card.select_one(".s-card__title") or
                card.select_one("h3.s-item__title")
            )
            
            if name_tag:
                name = name_tag.get_text(" ", strip=True)
            else:
                name = "N/A"
            
            # Remove unwanted text fragments
            junk_words = [
                r"shop on ebay",
                r"open in new tab",
                r"click to see price",
                r"see price",
                r"ships\s*(today|free|in\s*\d+\s*days)",
                r"free shipping",
                r"sponsored",
                r"opens in a new window or tab",
                r"new window or tab",
                r"^new\s*",
                r"\bfree\b",
            ]
            
            for junk in junk_words:
                name = re.sub(junk, "", name, flags=re.IGNORECASE)

            name = name.strip()
            if not name:
                continue
            
            price_tag = (
                card.select_one(".s-card__price")
            )
            price_text_raw = price_tag.get_text(" ", strip=True) if price_tag else "NA"

            price_nums = re.findall(r'[\d,]+(?:\.\d+)?', price_text_raw)
            if not price_nums:
                continue
            
            try:
                price_value = float(price_nums[0].replace(",", ""))
            except:
                price_value = 0

            currency_match = re.search(r'([$€£₹])|([A-Z]{3})', price_text_raw)
            currency = currency_match.group(0) if currency_match else "NA" 

            card_text = card.get_text(" ", strip=True)
            rating_match = re.search(r'\d{1,3}(?:\.\d+)?%\s*positive(?:\s*\(\d+\))?', card_text, re.IGNORECASE)
            rating_text = rating_match.group(0) if rating_match else "N/A"

            scraped_data.append({
                "BRAND": brand,
                "PRODUCT": product,
                "OEM NUMBER": oem_number or "NA",
                "ASIN NUMBER": asin_number or "NA",
                "WEBSITE": "eBay",
                "PRODUCT NAME": name,
                "PRICE": price_value,
                "CURRENCY": currency,
                "SELLER RATING": rating_text,
                "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "SOURCE URL": product_url,
            })

        if not scraped_data:
            return {"error": "No products found. Please search for other available products"}

        try:
            save_to_excel("eBay", scraped_data)
        except Exception:
            pass

        return {"data": scraped_data}

    except Exception as e:
        return {"error": str(e)}

    finally:
        # --- SAFE QUIT LOGIC ---
        if driver:
            try:
                driver.quit()
            except:
                pass
        
        # Cleanup proxy file
        if os.path.exists(proxy_plugin):
            try:
                os.remove(proxy_plugin)
            except:
                pass
        gc.collect()

