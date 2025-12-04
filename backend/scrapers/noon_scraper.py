import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, os, zipfile, random, string
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel
import gc

# --- CONFIGURATION (FILL THESE IN) ---
PROXY_HOST = "gate.decodo.com"  # Check your dashboard
PROXY_PORT = "10002"             # Check your dashboard
PROXY_USER = "sp7oukpich"    # Your Decodo Sub-user
PROXY_PASS = "oHz7RSjbv1W7cafe+7"    # Your Decodo Password

def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
    """
    Creates a Chrome extension (zip file) to handle proxy authentication.
    """
    if plugin_path is None:
        # Random filename to avoid conflicts
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

def scrape_noon(brand, product, oem_number=None, asin_number=None):
    # 1. Create the Proxy Extension
    session_id = random.randint(100000, 999999)
    session_user = f"{PROXY_USER}-session-{session_id}"
    proxy_plugin = create_proxy_auth_extension(
        host=PROXY_HOST,
        port=PROXY_PORT,
        user=session_user,
        password=PROXY_PASS
    )

    # 2. Configure Chrome Options
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")

    # 3. Load the Proxy Extension
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

        # Build search query
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])
        url = f"https://www.noon.com/uae-en/search/?q={query}"
        
        print(f"Scraping URL: {url}")
        driver.get(url)

        # time.sleep(5)

        # # Smooth scroll — required for Noon (Preserved from your code)
        # for _ in range(5):
        #     driver.execute_script("window.scrollBy(0, 900);")
        #     time.sleep(0.6)

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # Product cards (Preserved tags)
        product_cards = soup.select('div[class*="linkWrapper"]')

        scraped_data = []

        for card in product_cards:

            # URL
            link = card.select_one('a[class*="productBoxLink"], a[href*="/p/"]')
            product_url = "https://www.noon.com" + link["href"] if link else "N/A"

            # Name
            name_tag = card.select_one('[data-qa="plp-product-box-name"], h2[data-qa="plp-product-box-name"]')
            name = name_tag.get_text(strip=True) if name_tag else "N/A"

            # Rating
            rating_tag = card.select_one('div[class*="textCtr"]')
            rating = rating_tag.get_text(strip=True) if rating_tag else "N/A"

            # Price
            price_tag = card.select_one('strong[class*="amount"]')
            raw_price = price_tag.get_text(strip=True) if price_tag else "0"

            price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
            price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

            # Currency
            currency = "AED"

            scraped_data.append({
                "BRAND": brand,
                "PRODUCT": product,
                "OEM NUMBER": oem_number or "NA",
                "ASIN NUMBER": asin_number or "NA",
                "WEBSITE": "Noon",
                "PRODUCT NAME": name,
                "PRICE": price_value,
                "CURRENCY": currency,
                "SELLER RATING": rating,
                "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "SOURCE URL": product_url,
            })

        if not scraped_data:
            return {"error": "No products found. Please search for other available products"}

        try:
            save_to_excel("Noon", scraped_data)
        except:
            pass

        return {"data": scraped_data}

    except Exception as e:
        return {"error": str(e)}

    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
        
        # Clean up the extension file
        if os.path.exists(proxy_plugin):
            try:
                os.remove(proxy_plugin)
            except:
                pass
        gc.collect()

