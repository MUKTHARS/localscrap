import os
import shutil
import uuid
import tempfile
import threading
import time
import random
import re
import zipfile
import string
import gc
from datetime import datetime
from bs4 import BeautifulSoup
import undetected_chromedriver as uc
from pyvirtualdisplay import Display
from scrapers.utils import polite_delay, save_to_excel
from urllib.parse import urljoin

PROXY_HOST = "gate.decodo.com"
PROXY_PORT = "10001"
PROXY_USER = "sp7oukpich"
PROXY_PASS = "oHz7RSjbv1W7cafe+7"

BROWSER_START_LOCK = threading.Lock()

def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
    if plugin_path is None:
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        plugin_path = os.path.join(tempfile.gettempdir(), f'proxy_auth_plugin_{random_suffix}.zip')

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

def scrape_seazoneuae(brand, product, oem_number=None, asin_number=None):
    session_id = str(uuid.uuid4())[:8]
    base_temp = tempfile.gettempdir()
    temp_user_data_dir = os.path.join(base_temp, f"chrome_data_{session_id}")
    os.makedirs(temp_user_data_dir, exist_ok=True)

    driver = None
    display = None
    proxy_plugin = None
    unique_driver_path = None
    all_scraped_data = []

    try:
        max_pages = 25
        seen_urls = set()

        session_proxy_id = random.randint(100000, 999999)
        session_user = f"{PROXY_USER}-session-{session_proxy_id}"
        
        proxy_plugin = create_proxy_auth_extension(
            host=PROXY_HOST, port=PROXY_PORT, user=session_user, password=PROXY_PASS
        )

        with BROWSER_START_LOCK:
            print(f"[{session_id}] Acquire Lock: Starting SeazoneUAE Browser...")
            
            display = Display(visible=0, size=(1920, 1080))
            display.start()

            options = uc.ChromeOptions()
            options.add_argument(f"--user-data-dir={temp_user_data_dir}")
            options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--start-maximized")

            UA = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            ]
            options.add_argument(f"--user-agent={random.choice(UA)}")

            try:
                patcher = uc.Patcher()
                patcher.auto()
                src_driver = patcher.executable_path
                unique_driver_name = f"chromedriver_{session_id}"
                unique_driver_path = os.path.join(temp_user_data_dir, unique_driver_name)
                shutil.copy2(src_driver, unique_driver_path)
                os.chmod(unique_driver_path, 0o755)
            except Exception as e:
                print(f"[{session_id}] Driver copy failed: {e}")
                unique_driver_path = None

            if unique_driver_path:
                driver = uc.Chrome(options=options, driver_executable_path=unique_driver_path, use_subprocess=True, version_main=None)
            else:
                driver = uc.Chrome(options=options, use_subprocess=True)

            print(f"[{session_id}] Browser started. Stabilizing...")
            # time.sleep(2)
            print(f"[{session_id}] Lock Released.")

        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]
            
        base_query = " ".join([k for k in keywords if k]).replace(" ", "+")

        for current_page in range(1, max_pages + 1):
            print(f"[{session_id}] Scraping SeazoneUAE Page {current_page}...")
            url = f"https://seazoneuae.com/products?search={base_query}&page={current_page}"
            
            try:
                driver.get(url)
                soup = BeautifulSoup(driver.page_source, "html.parser")
                product_cards = soup.select("div.vertical-product-card")

                if not product_cards:
                    print(f"[{session_id}] No products found on page {current_page}. Stopping.")
                    break

                page_new_items = 0

                for card in product_cards:
                    a_tag = card.select_one("a.card-title")
                    if not a_tag or not a_tag.has_attr("href"): continue

                    raw_url = a_tag["href"]
                    if not raw_url.startswith("http"):
                        raw_url = urljoin("https://seazoneuae.com", raw_url)

                    clean_url_key = raw_url.split("?")[0]
                    if clean_url_key in seen_urls: continue
                    seen_urls.add(clean_url_key)

                    name = a_tag.get_text(strip=True)
                    price_tag = card.select_one("h6.price span")
                    raw_price = price_tag.get_text(strip=True) if price_tag else "0"

                    price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                    price_value = float(price_nums[0].replace(",", "")) if price_nums else 0.0

                    all_scraped_data.append({
                        "BRAND": brand,
                        "PRODUCT": product,
                        "OEM NUMBER": oem_number or "NA",
                        "ASIN NUMBER": asin_number or "NA",
                        "WEBSITE": "Seazone UAE",
                        "PRODUCT NAME": name,
                        "PRICE": price_value,
                        "CURRENCY": "AED",
                        "SELLER RATING": "N/A",
                        "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "SOURCE URL": raw_url,
                    })
                    page_new_items += 1

                print(f"[{session_id}] > Added {page_new_items} unique items.")

                if page_new_items == 0 and len(product_cards) > 0:
                    print(f"[{session_id}] Page contained only duplicates. Stopping.")
                    break

            except Exception as e:
                print(f"[{session_id}] Error scraping page {current_page}: {str(e)}")
                continue

        if not all_scraped_data:
            return {"error": "No products found."}

        try:
            save_to_excel("SeazoneUAE", all_scraped_data)
        except: pass
        
        return {"data": all_scraped_data}

    except Exception as e:
        return {"error": str(e)}

    finally:
        print(f"[{session_id}] Cleaning up...")
        if driver:
            try: driver.quit()
            except: pass
        if display:
            try: display.stop()
            except: pass
        if proxy_plugin and os.path.exists(proxy_plugin):
            try: os.remove(proxy_plugin)
            except: pass
        if os.path.exists(temp_user_data_dir):
            try: shutil.rmtree(temp_user_data_dir, ignore_errors=True)
            except: pass
        gc.collect()

# import undetected_chromedriver as uc
# from bs4 import BeautifulSoup
# import time, re, os, zipfile, random, string
# from datetime import datetime
# from scrapers.utils import polite_delay, save_to_excel
# import gc
# from urllib.parse import urljoin

# # --- PROXY CONFIGURATION ---
# PROXY_HOST = "gate.decodo.com"
# PROXY_PORT = "10001"
# PROXY_USER = "sp7oukpich"
# PROXY_PASS = "oHz7RSjbv1W7cafe+7"

# def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
#     if plugin_path is None:
#         random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
#         plugin_path = os.path.join(os.getcwd(), f'proxy_auth_plugin_{random_suffix}.zip')

#     manifest_json = """
#     {
#         "version": "1.0.0",
#         "manifest_version": 2,
#         "name": "Chrome Proxy",
#         "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
#         "background": {"scripts": ["background.js"]},
#         "minimum_chrome_version":"22.0.0"
#     }
#     """
#     background_js = f"""
#     var config = {{
#             mode: "fixed_servers",
#             rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
#           }};
#     chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});
#     function callbackFn(details) {{ return {{ authCredentials: {{ username: "{user}", password: "{password}" }} }}; }}
#     chrome.webRequest.onAuthRequired.addListener(callbackFn, {{urls: ["<all_urls>"]}}, ['blocking']);
#     """
#     with zipfile.ZipFile(plugin_path, 'w') as zp:
#         zp.writestr("manifest.json", manifest_json)
#         zp.writestr("background.js", background_js)
#     return plugin_path

# def scrape_seazoneuae(brand, product, oem_number=None, asin_number=None):
#     max_pages = 25
#     session_id = random.randint(100000, 999999)
#     session_user = f"{PROXY_USER}-session-{session_id}"
    
#     proxy_plugin = create_proxy_auth_extension(
#         host=PROXY_HOST,
#         port=PROXY_PORT,
#         user=session_user,
#         password=PROXY_PASS
#     )

#     # Chrome Options
#     options = uc.ChromeOptions()
#     options.add_argument("--headless=new")
#     options.add_argument("--disable-gpu")
#     options.add_argument("--no-sandbox")
#     options.add_argument("--window-size=1920,1080")
#     options.add_argument("--disable-blink-features=AutomationControlled")
#     options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

#     # Random User Agent
#     UA = [
#         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
#         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
#     ]
#     options.add_argument(f"--user-agent={random.choice(UA)}")

#     driver = None
#     all_scraped_data = []
#     seen_urls = set()

#     try:
#         driver = uc.Chrome(options=options)
        
#         # Prepare Keywords
#         if asin_number:
#             keywords = [brand, product, asin_number]
#         else:
#             keywords = [brand, product, oem_number] if oem_number else [brand, product]
            
#         # Clean keywords and join
#         base_query = " ".join([k for k in keywords if k]).replace(" ", "+")

#         for current_page in range(1, max_pages + 1):
#             print(f"Scraping SeazoneUAE Page {current_page}...")

#             # URL Structure: https://seazoneuae.com/products?search={query}&page={page}
#             url = f"https://seazoneuae.com/products?search={base_query}&page={current_page}"
            
#             try:
#                 driver.get(url)

#                 soup = BeautifulSoup(driver.page_source, "html.parser")

#                 # PRODUCT LISTING ITEMS
#                 # Seazone usually puts cards in 'vertical-product-card' or generic containers
#                 product_cards = soup.select("div.vertical-product-card")

#                 # Stop if no products found on this page
#                 if not product_cards:
#                     print(f" > No products found on page {current_page}. Stopping.")
#                     break

#                 page_new_items = 0

#                 for card in product_cards:
#                     # Product URL
#                     a_tag = card.select_one("a.card-title")
                    
#                     if not a_tag or not a_tag.has_attr("href"):
#                         continue

#                     raw_url = a_tag["href"]
#                     # Ensure absolute URL
#                     if not raw_url.startswith("http"):
#                         raw_url = urljoin("https://seazoneuae.com", raw_url)

#                     # Deduplication
#                     clean_url_key = raw_url.split("?")[0]
#                     if clean_url_key in seen_urls:
#                         continue
                    
#                     seen_urls.add(clean_url_key)

#                     # Product Name
#                     name = a_tag.get_text(strip=True)

#                     # Price
#                     price_tag = card.select_one("h6.price span")
#                     raw_price = price_tag.get_text(strip=True) if price_tag else "0"

#                     price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
#                     price_value = float(price_nums[0].replace(",", "")) if price_nums else 0.0

#                     all_scraped_data.append({
#                         "BRAND": brand,
#                         "PRODUCT": product,
#                         "OEM NUMBER": oem_number or "NA",
#                         "ASIN NUMBER": asin_number or "NA",
#                         "WEBSITE": "Seazone UAE",
#                         "PRODUCT NAME": name,
#                         "PRICE": price_value,
#                         "CURRENCY": "AED", # Seazone is typically AED
#                         "SELLER RATING": "N/A", # Usually not available on list view
#                         "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                         "SOURCE URL": raw_url,
#                     })
#                     page_new_items += 1

#                 print(f"  > Added {page_new_items} unique items from page {current_page}.")

#                 # Stop if the page was valid but contained only duplicate URLs (end of pagination loop usually)
#                 if page_new_items == 0 and len(product_cards) > 0:
#                      print("  > Page contained only duplicates. Stopping.")
#                      break

#             except Exception as e:
#                 print(f"Error scraping page {current_page}: {str(e)}")
#                 continue

#         if not all_scraped_data:
#             return {"error": "No products found across all pages."}

#         try:
#             save_to_excel("SeazoneUAE", all_scraped_data)
#         except Exception:
#             pass

#         return {"data": all_scraped_data}

#     except Exception as e:
#         return {"error": str(e)}

#     finally:
#         if driver:
#             try: driver.quit()
#             except: pass

#         if os.path.exists(proxy_plugin):
#             try: os.remove(proxy_plugin)
#             except: pass

#         gc.collect()

# # import undetected_chromedriver as uc
# # from bs4 import BeautifulSoup
# # import time, re, os, zipfile, random, string
# # from datetime import datetime
# # from scrapers.utils import polite_delay, save_to_excel
# # import gc
# # from urllib.parse import urljoin

# # # --- PROXY CONFIGURATION ---
# # PROXY_HOST = "gate.decodo.com"
# # PROXY_PORT = "10001"
# # PROXY_USER = "sp7oukpich"
# # PROXY_PASS = "oHz7RSjbv1W7cafe+7"


# # def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):

# #     if plugin_path is None:
# #         random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
# #         plugin_path = os.path.join(os.getcwd(), f'proxy_auth_plugin_{random_suffix}.zip')

# #     manifest_json = """
# #     {
# #         "version": "1.0.0",
# #         "manifest_version": 2,
# #         "name": "Chrome Proxy",
# #         "permissions": ["proxy","tabs","unlimitedStorage","storage","<all_urls>","webRequest","webRequestBlocking"],
# #         "background": { "scripts": ["background.js"] }
# #     }
# #     """

# #     background_js = f"""
# #     var config = {{
# #         mode: "fixed_servers",
# #         rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
# #     }};
# #     chrome.proxy.settings.set({{value: config, scope: "regular"}}, function(){{}});
# #     chrome.webRequest.onAuthRequired.addListener(
# #         function(details){{
# #             return {{authCredentials: {{username: "{user}", password: "{password}"}}}};
# #         }},
# #         {{urls:["<all_urls>"]}},
# #         ["blocking"]
# #     );
# #     """

# #     with zipfile.ZipFile(plugin_path, 'w') as z:
# #         z.writestr("manifest.json", manifest_json)
# #         z.writestr("background.js", background_js)

# #     return plugin_path


# # def scrape_seazoneuae(brand, product, oem_number=None, asin_number=None):

# #     # Create proxy session for request
# #     session_id = random.randint(100000, 999999)
# #     session_user = f"{PROXY_USER}-session-{session_id}"
# #     proxy_plugin = create_proxy_auth_extension(
# #         host=PROXY_HOST,
# #         port=PROXY_PORT,
# #         user=session_user,
# #         password=PROXY_PASS
# #     )

# #     # Chrome Options
# #     options = uc.ChromeOptions()
# #     options.add_argument("--headless=new")
# #     options.add_argument("--disable-gpu")
# #     options.add_argument("--no-sandbox")
# #     options.add_argument("--window-size=1920,1080")
# #     options.add_argument("--disable-blink-features=AutomationControlled")
# #     options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

# #     # Random User Agent
# #     UA = [
# #         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
# #         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
# #         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
# #     ]
# #     options.add_argument(f"--user-agent={random.choice(UA)}")

# #     driver = None

# #     try:
# #         driver = uc.Chrome(options=options)
# #         # polite_delay()

# #         # Build correct search URL
# #         keywords = [brand, product, oem_number, asin_number]

# #         query = product.replace(" ", "+")
# #         url = f"https://seazoneuae.com/products?view=&search={query}"
# #         print("Scraping:", url)

# #         driver.get(url)

# #         # # Auto-scroll to load everything
# #         # for _ in range(4):
# #         #     driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
# #         #     time.sleep(1)

# #         soup = BeautifulSoup(driver.page_source, "html.parser")

# #         # PRODUCT LISTING ITEMS
# #         product_cards = soup.select("div.vertical-product-card")

# #         scraped_data = []

# #         for card in product_cards:

# #             # Product URL
# #             a_tag = card.select_one("a.card-title")
# #             product_url = a_tag["href"] if a_tag else "N/A"

# #             # Product Name
# #             name_tag = card.select_one("a.card-title")
# #             name = name_tag.get_text(strip=True) if name_tag else "N/A"

# #             # Price
# #             price_tag = card.select_one("h6.price span")
# #             raw_price = price_tag.get_text(strip=True) if price_tag else "0"

# #             price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
# #             price = float(price_nums[0].replace(",", "")) if price_nums else None

# #             scraped_data.append({
# #                 "BRAND": brand,
# #                 "PRODUCT": product,
# #                 "OEM NUMBER": oem_number or "NA",
# #                 "ASIN NUMBER": asin_number or "NA",
# #                 "WEBSITE": "Seazone UAE",
# #                 "PRODUCT NAME": name,
# #                 "PRICE": price,
# #                 "CURRENCY": "AED",
# #                 "SELLER RATING": "N/A",
# #                 "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
# #                 "SOURCE URL": product_url,
# #             })

# #         if not scraped_data:
# #             return {"error": "No products found on NTS UAE search page."}

# #         save_to_excel("SeazoneUAE", scraped_data)
# #         return {"data": scraped_data}

# #     except Exception as e:
# #         return {"error": str(e)}

# #     finally:
# #         if driver:
# #             try: driver.quit()
# #             except: pass

# #         if os.path.exists(proxy_plugin):
# #             try: os.remove(proxy_plugin)
# #             except: pass

# #         gc.collect()
