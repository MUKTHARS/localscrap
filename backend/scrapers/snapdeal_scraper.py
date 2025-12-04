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

def scrape_snapdeal(brand, product, oem_number=None, asin_number=None):
    # 1. Create Proxy Extension
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
    options.add_argument("--no-sandbox")            # Mandatory for VPS Root
    options.add_argument("--disable-dev-shm-usage") # Mandatory for VPS Memory
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

        # ---- Build dynamic search query ----
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "%20".join([k for k in keywords if k])
        url = f"https://www.snapdeal.com/search?keyword={query}"

        driver.get(url)

        # Wait for dynamic content
        # time.sleep(random.uniform(2, 5))

        soup = BeautifulSoup(driver.page_source, "html.parser")
        product_cards = soup.select(".product-tuple-listing")

        scraped_data = []

        # ---- Parse product listings ----
        for card in product_cards:
            # Product URL
            url_tag = card.select_one("a.dp-widget-link, a.dp-widget-link.noUdLine")
            product_url = url_tag["href"] if url_tag else "N/A"

            # Product Name
            name_tag = card.select_one(".product-title")
            name = name_tag.get_text(strip=True) if name_tag else "N/A"
            if not name or name.lower() in ["sponsored", "advertisement"]:
                continue

            # ---- Price ----
            price_tag = (
                card.select_one("span.lfloat.product-price") or
                card.select_one("span[id^='display-price']") or
                card.select_one(".product-price > span")
            )

            if price_tag:
                if price_tag.has_attr("data-price"):
                    price_text = price_tag["data-price"].strip()
                else:
                    price_text = re.sub(r"[^\d.]", "", price_tag.get_text(strip=True))
            else:
                price_text = "0"

            try:
                price_value = float(price_text)
            except ValueError:
                continue

            # ---- Currency ----
            currency_match = re.search(r"(Rs\.?|₹|[$€£])", price_tag.text if price_tag else "")
            currency = currency_match.group(0) if currency_match else "₹"

            # ---- Rating ----
            rating_tag = card.select_one(".filled-stars")
            if rating_tag and "width" in rating_tag.attrs.get("style", ""):
                try:
                    width = float(rating_tag["style"].split(":")[1].replace("%", "").strip())
                    rating = f"{round(width / 20, 1)}"
                except Exception:
                    rating = "N/A"
            else:
                rating = "N/A"

            # ---- Append structured data ----
            scraped_data.append({
                "BRAND": brand,
                "PRODUCT": product,
                "OEM NUMBER": oem_number or "NA",
                "ASIN NUMBER": asin_number or "NA",
                "WEBSITE": "Snapdeal",
                "PRODUCT NAME": name,
                "PRICE": price_value,
                "CURRENCY": currency,
                "SELLER RATING": rating,
                "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "SOURCE URL": product_url,
            })

        # ---- Validation ----
        if not scraped_data:
            return {"error": "No products found. Please search for other available products"}

        # ---- Save and Return ----
        try:
            save_to_excel("Snapdeal", scraped_data)
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

