import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, os, zipfile, random, string
from datetime import datetime
from scrapers.utils import save_to_excel
import gc

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

def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
    max_pages=50
    session_id = random.randint(100000, 999999)
    session_user = f"{PROXY_USER}-session-{session_id}"
    proxy_plugin = create_proxy_auth_extension(
        host=PROXY_HOST,
        port=PROXY_PORT,
        user=session_user,
        password=PROXY_PASS
    )

    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    ]
    options.add_argument(f"--user-agent={random.choice(user_agents)}")

    driver = None
    all_scraped_data = []
    
    seen_urls = set()

    try:
        driver = uc.Chrome(options=options)
        
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])

        for current_page in range(1, max_pages + 1):
            
            if current_page == 1:
                url = f"https://www.amitretail.com/?s={query}&post_type=product"
            else:
                url = f"https://www.amitretail.com/page/{current_page}/?s={query}&post_type=product"
            
            print(f"Scraping AmitRetail Page {current_page}...")
            
            try:
                driver.get(url)
                
                if "Page not found" in driver.title:
                    print(f"Page {current_page} not found. Ending scrape.")
                    break

                time.sleep(2)

                soup = BeautifulSoup(driver.page_source, "html.parser")
                product_cards = soup.select("li.product-col")

                if not product_cards:
                    print(f"No products found on page {current_page}. Ending scrape.")
                    break

                page_new_items = 0

                for card in product_cards:
                    url_tag = card.select_one("a.product-loop-title")
                    
                    if not url_tag or not url_tag.has_attr("href"):
                        continue

                    raw_url = url_tag["href"]
                    
                    if raw_url in seen_urls:
                        continue
                    
                    seen_urls.add(raw_url)
                    product_url = raw_url

                    name_tag = card.select_one("h3.woocommerce-loop-product__title")
                    name = name_tag.get_text(strip=True) if name_tag else "N/A"

                    price_tag = card.select_one("span.price")
                    raw_price = price_tag.get_text(strip=True) if price_tag else "0"

                    price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                    price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

                    currency = "AED"
                    if "Dhs" in raw_price:
                        currency = "Dhs"
                    elif "$" in raw_price:
                        currency = "$"

                    all_scraped_data.append({
                        "BRAND": brand,
                        "PRODUCT": product,
                        "OEM NUMBER": oem_number or "NA",
                        "ASIN NUMBER": asin_number or "NA",
                        "WEBSITE": "AmitRetail",
                        "PRODUCT NAME": name,
                        "PRICE": price_value,
                        "CURRENCY": currency,
                        "SELLER RATING": "N/A",
                        "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "SOURCE URL": product_url,
                    })
                    page_new_items += 1
                
                print(f"  > Added {page_new_items} unique items from page {current_page}.")

                if page_new_items == 0 and len(product_cards) > 0:
                     print("  > Page contained only duplicates. Stopping.")
                     break
            
            except Exception as e:
                print(f"Error on page {current_page}: {str(e)}")
                continue

        if not all_scraped_data:
            return {"error": "No products found. Please search for other available products"}

        try:
            save_to_excel("AmitRetail", all_scraped_data)
        except:
            pass

        return {"data": all_scraped_data}

    except Exception as e:
        return {"error": str(e)}

    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
        
        if os.path.exists(proxy_plugin):
            try:
                os.remove(proxy_plugin)
            except:
                pass
        gc.collect()

# import undetected_chromedriver as uc
# from bs4 import BeautifulSoup
# import time, re, os, zipfile
# from datetime import datetime
# import random
# import gc
# # --- CONFIGURATION (FILL THESE IN) ---
# PROXY_HOST = "gate.decodo.com"  # Check your dashboard (e.g., gate.smartproxy.com or similar)
# PROXY_PORT = "10001"             # Check your dashboard
# PROXY_USER = "sp7oukpich"    # Your Decodo Sub-user
# PROXY_PASS = "oHz7RSjbv1W7cafe+7"    # Your Decodo Password

# def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
#     """
#     Creates a Chrome extension (zip file) to handle proxy authentication.
#     This is required for undetected_chromedriver to use authenticated proxies.
#     """
#     if plugin_path is None:
#         plugin_path = os.path.join(os.getcwd(), 'proxy_auth_plugin.zip')

#     manifest_json = """
#     {
#         "version": "1.0.0",
#         "manifest_version": 2,
#         "name": "Chrome Proxy",
#         "permissions": [
#             "proxy",
#             "tabs",
#             "unlimitedStorage",
#             "storage",
#             "<all_urls>",
#             "webRequest",
#             "webRequestBlocking"
#         ],
#         "background": {
#             "scripts": ["background.js"]
#         },
#         "minimum_chrome_version":"22.0.0"
#     }
#     """

#     background_js = f"""
#     var config = {{
#             mode: "fixed_servers",
#             rules: {{
#               singleProxy: {{
#                 scheme: "{scheme}",
#                 host: "{host}",
#                 port: parseInt({port})
#               }},
#               bypassList: ["localhost"]
#             }}
#           }};

#     chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});

#     function callbackFn(details) {{
#         return {{
#             authCredentials: {{
#                 username: "{user}",
#                 password: "{password}"
#             }}
#         }};
#     }}

#     chrome.webRequest.onAuthRequired.addListener(
#                 callbackFn,
#                 {{urls: ["<all_urls>"]}},
#                 ['blocking']
#     );
#     """

#     with zipfile.ZipFile(plugin_path, 'w') as zp:
#         zp.writestr("manifest.json", manifest_json)
#         zp.writestr("background.js", background_js)

#     return plugin_path

# # MOCK UTILS for standalone running (Replace with your actual imports)
# def polite_delay():
#     time.sleep(random.uniform(2, 5))

# def save_to_excel(filename, data):
#     print(f"Saving {len(data)} items to {filename}.xlsx (Mock Function)")

# def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
#     # 1. Create the Proxy Extension
#     session_id = random.randint(100000, 999999)
#     session_user = f"{PROXY_USER}-session-{session_id}"
#     proxy_plugin = create_proxy_auth_extension(
#         host=PROXY_HOST,
#         port=PROXY_PORT,
#         user=session_user,
#         password=PROXY_PASS
#     )

#     # 2. Configure Chrome Options
#     options = uc.ChromeOptions()
#     options.add_argument("--headless=new") # Using 'new' headless mode is more undetectable
#     options.add_argument("--disable-gpu")
#     options.add_argument("--disable-dev-shm-usage")
#     options.add_argument("--no-sandbox")
#     options.add_argument("--window-size=1920,1080")
    
#     # 3. Load the Proxy Extension
#     options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

#     # Random User Agent
#     user_agents = [
#         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
#     ]
#     options.add_argument(f"--user-agent={random.choice(user_agents)}")

#     driver = None

#     try:
#         # Initialize Driver
#         driver = uc.Chrome(options=options)

#         # polite_delay()

#         # Build search query
#         if asin_number:
#             keywords = [brand, product, asin_number]
#         else:
#             keywords = [brand, product, oem_number] if oem_number else [brand, product]

#         query = "+".join([k for k in keywords if k])
#         url = f"https://www.amitretail.com/?s={query}&post_type=product"
        
#         print(f"Scraping URL: {url}")
#         driver.get(url)

#         # GIVE JS TIME TO LOAD
#         # time.sleep(5)

#         # # Scroll logic
#         # for _ in range(5): # Reduced to 3 for speed, increase if needed
#         #     driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
#         #     time.sleep(1.5)

#         # Parse
#         soup = BeautifulSoup(driver.page_source, "html.parser")
#         product_cards = soup.select("li.product-col")

#         scraped_data = []

#         for card in product_cards:
#             # URL
#             url_tag = card.select_one("a.product-loop-title")
#             product_url = url_tag["href"] if url_tag else "N/A"

#             # Name
#             name_tag = card.select_one("h3.woocommerce-loop-product__title")
#             name = name_tag.get_text(strip=True) if name_tag else "N/A"

#             # Price
#             price_tag = card.select_one("span.price")
#             raw_price = price_tag.get_text(strip=True) if price_tag else "0"

#             price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
#             # Remove commas before converting to float
#             price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

#             # Currency
#             currency_tag = card.select_one("span.custom_currency")
#             currency = currency_tag["alt"] if currency_tag and currency_tag.has_attr("alt") else "NA"

#             scraped_data.append({
#                 "BRAND": brand,
#                 "PRODUCT": product,
#                 "OEM NUMBER": oem_number or "NA",
#                 "ASIN NUMBER": asin_number or "NA",
#                 "WEBSITE": "AmitRetail",
#                 "PRODUCT NAME": name,
#                 "PRICE": price_value,
#                 "CURRENCY": currency,
#                 "SELLER RATING": "N/A",
#                 "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                 "SOURCE URL": product_url,
#             })

#         if not scraped_data:
#             print("No products found.")
#             return {"error": "No products found. Please search for other available products"}

#         # Save to Excel
#         try:
#             save_to_excel("AmitRetail", scraped_data)
#         except Exception as e:
#             print(f"Error saving excel: {e}")

#         return {"data": scraped_data}

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return {"error": str(e)}

#     finally:
#         if driver:
#             try:
#                 driver.quit()
#             except:
#                 pass
#         # Clean up the extension file
#         if os.path.exists('proxy_auth_plugin.zip'):
#             try:
#                 os.remove('proxy_auth_plugin.zip')
#             except:
#                 pass
#         gc.collect()

# import undetected_chromedriver as uc
# from bs4 import BeautifulSoup
# import time, re
# from scrapers.utils import polite_delay, save_to_excel
# from datetime import datetime
# import random

# def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
#     # Start undetected Chrome (headless OK!)
#     options = uc.ChromeOptions()
#     options.add_argument("--headless=new")
#     options.add_argument("--disable-gpu")
#     options.add_argument("--disable-dev-shm-usage")
#     options.add_argument("--no-sandbox")
#     options.add_argument("--disable-blink-features=AutomationControlled")
#     options.add_argument("--window-size=1920,1080")
#     # Random User Agent
#     user_agents = [
#         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
#     ]
    
#     options.add_argument(f"--user-agent={random.choice(user_agents)}")

#     driver = None

#     try:
#         driver = uc.Chrome(options=options)
        
#         polite_delay()

#         # Build search query
#         if asin_number:
#             keywords = [brand, product, asin_number]
#         else:
#             keywords = [brand, product, oem_number] if oem_number else [brand, product]

#         query = "+".join([k for k in keywords if k])
#         url = f"https://www.amitretail.com/shop?search={query}"
#         driver.get(url)

#         # GIVE ALGOLIA JS TIME TO LOAD RENDERED RESULTS
#         time.sleep(5)

#         # Ensure further JS rendering is complete
#         for _ in range(5):
#             time.sleep(1)
#             driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
#             time.sleep(1)

#         # Parse
#         soup = BeautifulSoup(driver.page_source, "html.parser")
#         product_cards = soup.select("li.product-col")

#         scraped_data = []

#         for card in product_cards:

#             # URL
#             url_tag = card.select_one("a.product-loop-title")
#             product_url = url_tag["href"] if url_tag else "N/A"

#             # Name
#             name_tag = card.select_one("h3.woocommerce-loop-product__title")
#             name = name_tag.get_text(strip=True) if name_tag else "N/A"

#             # Price
#             price_tag = card.select_one("span.price")
#             raw_price = price_tag.get_text(strip=True) if price_tag else "0"

#             price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
#             price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

#             # Currency
#             currency_tag = card.select_one("span.custom_currency")
#             currency = currency_tag["alt"] if currency_tag and currency_tag.has_attr("alt") else "NA"

#             scraped_data.append({
#                 "BRAND": brand,
#                 "PRODUCT": product,
#                 "OEM NUMBER": oem_number or "NA",
#                 "ASIN NUMBER": asin_number or "NA",
#                 "WEBSITE": "AmitRetail",
#                 "PRODUCT NAME": name,
#                 "PRICE": price_value,
#                 "CURRENCY": currency,
#                 "SELLER RATING": "N/A",
#                 "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                 "SOURCE URL": product_url,
#             })

#         if not scraped_data:
#             return {"error": "No products found. JS may not have loaded fully."}

#         # Save to Excel
#         try:
#             save_to_excel("AmitRetail", scraped_data)
#         except:
#             pass

#         return {"data": scraped_data}

#     except Exception as e:
#         return {"error": str(e)}

#     finally:
#         driver.quit()
