import os
import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time
import random
import re
import zipfile
import string
import gc
from datetime import datetime
from scrapers.utils import save_to_excel
# from pyvirtualdisplay import Display
os.environ['UC_VERSION_MAIN'] = '143'
PROXY_HOST = "gate.decodo.com"
PROXY_PORT = "10001"
PROXY_USER = "sp7oukpich"
PROXY_PASS = "oHz7RSjbv1W7cafe+7"

AMAZON_DOMAINS = [
    "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
    "amazon.es", "amazon.ca", "amazon.in", "amazon.com.mx", "amazon.com.br",
    "amazon.com.au", "amazon.ae", "amazon.sa", "amazon.sg", "amazon.nl",
    "amazon.se", "amazon.pl", "amazon.co.jp", "amazon.cn"
]

DOMAIN_CURRENCY_MAP = {
    "amazon.com": "USD", "amazon.co.uk": "GBP",
    "amazon.de": "EUR", "amazon.fr": "EUR", "amazon.it": "EUR", "amazon.es": "EUR", "amazon.nl": "EUR",
    "amazon.ca": "CAD", "amazon.in": "INR",
    "amazon.com.mx": "MXN", "amazon.com.br": "BRL",
    "amazon.com.au": "AUD", "amazon.ae": "AED", "amazon.sa": "SAR",
    "amazon.sg": "SGD", "amazon.se": "SEK", "amazon.pl": "PLN",
    "amazon.co.jp": "JPY", "amazon.cn": "CNY"
}

def clean_price(price_str):
    if not price_str or price_str == "NA":
        return "NA"

    clean = re.sub(r'[^\d.,]', '', price_str)
    
    if not clean:
        return "NA"

    try:
        if '.' in clean and ',' in clean:
            if clean.rfind('.') > clean.rfind(','):
                clean = clean.replace(',', '')
            else:
                clean = clean.replace('.', '').replace(',', '.')
                
        elif ',' in clean:
            if re.search(r',\d{2}$', clean):
                 clean = clean.replace(',', '.')
            else:
                 clean = clean.replace(',', '')
        
        return float(clean)
    except ValueError:
        return "NA"

def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
    """Creates a Chrome extension to handle proxy authentication."""
    if plugin_path is None:
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        plugin_path = os.path.join(os.getcwd(), f'proxy_auth_{random_suffix}.zip')

    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
        "background": {"scripts": ["background.js"]},
        "minimum_chrome_version":"22.0.0"
    }
    """
    background_js = f"""
    var config = {{
            mode: "fixed_servers",
            rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
          }};
    chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});
    function callbackFn(details) {{ return {{ authCredentials: {{ username: "{user}", password: "{password}" }} }}; }}
    chrome.webRequest.onAuthRequired.addListener(callbackFn, {{urls: ["<all_urls>"]}}, ['blocking']);
    """
    
    with zipfile.ZipFile(plugin_path, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)
    
    return plugin_path

def scrape_amazon(brand, product):
    # display = Display(visible=0, size=(1920, 1080))
    # display.start()

    max_retries = 3
    max_pages = 25
    all_scraped_data = []
    seen_urls = set()

    selected_domain = os.environ.get("SELECTED_AMAZON_DOMAIN", "").strip() or None
    domains_to_try = [selected_domain] if selected_domain else AMAZON_DOMAINS

    try:
        for domain in domains_to_try:
            if all_scraped_data: 
                break

            print(f"Trying domain: {domain}")
            
            current_currency = DOMAIN_CURRENCY_MAP.get(domain, "NA")
            
            for attempt in range(1, max_retries + 1):
                driver = None
                proxy_plugin = None
                
                try:
                    session_id = random.randint(100000, 999999)
                    session_user = f"{PROXY_USER}-session-{session_id}"
                    print(f"Attempt {attempt}/{max_retries} with Session ID: {session_id}")

                    proxy_plugin = create_proxy_auth_extension(
                        host=PROXY_HOST,
                        port=PROXY_PORT,
                        user=session_user,
                        password=PROXY_PASS
                    )

                    options = uc.ChromeOptions()
                    options.add_argument("--no-sandbox")
                    options.add_argument("--disable-dev-shm-usage")
                    options.add_argument("--disable-gpu")
                    options.add_argument("--start-maximized")
                    options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")
                    options.add_argument("--disable-popup-blocking")
                    driver = uc.Chrome(options=options, version_main=143, use_subprocess=False)
                    # driver = uc.Chrome(options=options)
                    driver.set_page_load_timeout(45)

                    try:
                        driver.get(f"https://www.{domain}/ref=cs_503_link")
                        
                        if current_currency != "NA":
                            driver.add_cookie({
                                'name': 'i18n-prefs',
                                'value': current_currency,
                                'domain': f'.{domain}'
                            })
                            print(f"   >>> Injected cookie: i18n-prefs={current_currency}")

                    except Exception as cookie_err:
                        print(f"   >>> Warning: Cookie injection failed: {cookie_err}")

                    base_query = "+".join([k for k in [brand, product] if k])
                    
                    for current_page in range(1, max_pages + 1):
                        print(f"Scraping Amazon ({domain}) Page {current_page}...")
                        
                        search_url = f"https://www.{domain}/s?k={base_query}&page={current_page}"
                        driver.get(search_url)

                        for _ in range(random.randint(2, 4)):
                            scroll_amount = random.randint(300, 800)
                            driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                            time.sleep(random.uniform(0.5, 1.5))
                        
                        driver.execute_script("window.scrollBy(0, -300);")

                        html = driver.page_source
                        
                        if "Enter the characters" in html or "Type the characters" in html:
                            print(f"⚠️ CAPTCHA detected on page {current_page}.")
                            time.sleep(5)
                            driver.refresh()
                            time.sleep(5)
                            if "Enter the characters" in driver.page_source:
                                print("Captcha persists. Switching session...")
                                raise Exception("Captcha persistence")

                        soup = BeautifulSoup(html, "html.parser")
                        product_cards = soup.select("div[data-component-type='s-search-result']")

                        if not product_cards:
                            print(f"❌ No products found on page {current_page}.")
                            break

                        page_new_items = 0

                        for card in product_cards:
                            url_tag = card.select_one("a.a-link-normal.s-underline-text") or \
                                      card.select_one("a.a-link-normal.s-no-outline") or \
                                      card.select_one("h2 a")
                            
                            if url_tag:
                                raw_product_url = f"https://www.{domain}" + url_tag["href"]
                                raw_product_url = raw_product_url.split('#')[0]

                            else:
                                raw_product_url = "N/A"
                            
                            clean_url_key = raw_product_url.split("?")[0]
                            
                            if clean_url_key in seen_urls: continue
                            seen_urls.add(clean_url_key)

                            name_tag = card.select_one("h2 span") or card.select_one("h2")
                            name = name_tag.get_text(strip=True) if name_tag else "N/A"

                            price_tag = card.select_one("span.a-price > span.a-offscreen") or card.select_one("span.a-color-price")
                            raw_price = price_tag.text.strip() if price_tag else "NA"

                            price_value = clean_price(raw_price)
                            
                            if price_value == "NA": continue

                            rating_tag = card.select_one("span.a-icon-alt")
                            rating = rating_tag.get_text(strip=True).split(" ")[0] if rating_tag else "N/A"

                            all_scraped_data.append({
                                "BRAND": brand,
                                "PRODUCT": product,
                                "WEBSITE": f"Amazon ({domain})",
                                "PRODUCT NAME": name,
                                "PRICE": price_value,
                                "CURRENCY": current_currency, # Forces USD/EUR/GBP label
                                "SELLER RATING": rating,
                                "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "SOURCE URL": raw_product_url,
                            })
                            page_new_items += 1
                        
                        print(f"  > Added {page_new_items} items.")
                        if page_new_items == 0: break 

                    if all_scraped_data:
                        break

                except Exception as e:
                    print(f"Error on {domain} attempt {attempt}: {e}")
                
                finally:
                    if driver:
                        try: 
                            driver.quit()
                        except Exception: 
                            pass
                    
                    if proxy_plugin and os.path.exists(proxy_plugin):
                        try:
                            os.remove(proxy_plugin)
                        except Exception:
                            pass
            
    except Exception as e:
        return {"error": str(e)}

    finally:
        try: display.stop()
        except: pass
        gc.collect()

    if all_scraped_data:
        try: save_to_excel("Amazon", all_scraped_data)
        except: pass
        return {"data": all_scraped_data}
    else:
        return {"error": "No products found across all domains."}

