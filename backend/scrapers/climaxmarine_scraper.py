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

def scrape_climaxmarine(brand, product, oem_number=None, asin_number=None):
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
            print(f"[{session_id}] Acquire Lock: Starting ClimaxMarine Browser...")
            
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
            time.sleep(2)
            print(f"[{session_id}] Lock Released.")

        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]
            
        base_query = " ".join([k for k in keywords if k]).replace(" ", "+")

        for current_page in range(1, max_pages + 1):
            print(f"[{session_id}] Scraping ClimaxMarine Page {current_page}...")

            if current_page == 1:
                url = f"https://www.climaxmarine.com/?s={base_query}&post_type=product&type_aws=true"
            else:
                url = f"https://www.climaxmarine.com/page/{current_page}/?s={base_query}&post_type=product&type_aws=true"

            try:
                driver.get(url)
                soup = BeautifulSoup(driver.page_source, "html.parser")
                product_cards = soup.select("li.product-col")

                if not product_cards:
                    print(f"[{session_id}] No products found on page {current_page}. Stopping.")
                    break

                page_new_items = 0

                for card in product_cards:
                    a_tag = card.select_one("a.product-loop-title")
                    if not a_tag or not a_tag.has_attr("href"): continue
                        
                    raw_url = a_tag["href"]
                    clean_url_key = raw_url.split("?")[0]
                    if clean_url_key in seen_urls: continue
                    seen_urls.add(clean_url_key)

                    name_tag = card.select_one("h3.woocommerce-loop-product__title")
                    name = name_tag.get_text(strip=True) if name_tag else "N/A"

                    price_tag = card.select_one("span.price bdi")
                    raw_price = price_tag.get_text(strip=True) if price_tag else "NA"
                    nums = re.findall(r"[\d,]+(?:\.\d+)?", raw_price)
                    price = float(nums[0].replace(",", "")) if nums else None

                    all_scraped_data.append({
                        "BRAND": brand,
                        "PRODUCT": product,
                        "OEM NUMBER": oem_number or "NA",
                        "ASIN NUMBER": asin_number or "NA",
                        "WEBSITE": "Climax Marine",
                        "PRODUCT NAME": name,
                        "PRICE": price,
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
            save_to_excel("Climax_Marine", all_scraped_data)
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
#         "permissions": ["proxy","tabs","unlimitedStorage","storage","<all_urls>","webRequest","webRequestBlocking"],
#         "background": { "scripts": ["background.js"] }
#     }
#     """

#     background_js = f"""
#     var config = {{
#         mode: "fixed_servers",
#         rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
#     }};
#     chrome.proxy.settings.set({{value: config, scope: "regular"}}, function(){{}});
#     chrome.webRequest.onAuthRequired.addListener(
#         function(details){{
#             return {{authCredentials: {{username: "{user}", password: "{password}"}}}};
#         }},
#         {{urls:["<all_urls>"]}},
#         ["blocking"]
#     );
#     """

#     with zipfile.ZipFile(plugin_path, 'w') as z:
#         z.writestr("manifest.json", manifest_json)
#         z.writestr("background.js", background_js)

#     return plugin_path

# def scrape_climaxmarine(brand, product, oem_number=None, asin_number=None):
#     max_pages = 25
    
#     # Create proxy session for request
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
            
#         base_query = " ".join([k for k in keywords if k]).replace(" ", "+")

#         for current_page in range(1, max_pages + 1):
#             print(f"Scraping ClimaxMarine Page {current_page}...")

#             # Construct URL based on page number
#             # Page 1: https://www.climaxmarine.com/?s=query...
#             # Page 2+: https://www.climaxmarine.com/page/2/?s=query...
#             if current_page == 1:
#                 url = f"https://www.climaxmarine.com/?s={base_query}&post_type=product&type_aws=true"
#             else:
#                 url = f"https://www.climaxmarine.com/page/{current_page}/?s={base_query}&post_type=product&type_aws=true"

#             try:
#                 driver.get(url)
                
#                 soup = BeautifulSoup(driver.page_source, "html.parser")

#                 # PRODUCT LISTING ITEMS
#                 product_cards = soup.select("li.product-col")

#                 if not product_cards:
#                     print(f" > No products found on page {current_page}. Stopping.")
#                     break

#                 page_new_items = 0

#                 for card in product_cards:
#                     # Product URL (ALWAYS present)
#                     a_tag = card.select_one("a.product-loop-title")
                    
#                     if not a_tag or not a_tag.has_attr("href"):
#                         continue
                        
#                     raw_url = a_tag["href"]
                    
#                     # Deduplication
#                     clean_url_key = raw_url.split("?")[0]
#                     if clean_url_key in seen_urls:
#                         continue
                    
#                     seen_urls.add(clean_url_key)

#                     # Product Name
#                     name_tag = card.select_one("h3.woocommerce-loop-product__title")
#                     name = name_tag.get_text(strip=True) if name_tag else "N/A"

#                     # Price
#                     price_tag = card.select_one("span.price bdi")
#                     raw_price = price_tag.get_text(strip=True) if price_tag else "NA"

#                     nums = re.findall(r"[\d,]+(?:\.\d+)?", raw_price)
#                     price = float(nums[0].replace(",", "")) if nums else None

#                     all_scraped_data.append({
#                         "BRAND": brand,
#                         "PRODUCT": product,
#                         "OEM NUMBER": oem_number or "NA",
#                         "ASIN NUMBER": asin_number or "NA",
#                         "WEBSITE": "Climax Marine",
#                         "PRODUCT NAME": name,
#                         "PRICE": price,
#                         "CURRENCY": "AED",
#                         "SELLER RATING": "N/A",
#                         "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                         "SOURCE URL": raw_url,
#                     })
#                     page_new_items += 1

#                 print(f"  > Added {page_new_items} unique items from page {current_page}.")

#                 if page_new_items == 0 and len(product_cards) > 0:
#                     print("  > Page contained only duplicates. Stopping.")
#                     break

#             except Exception as e:
#                 print(f"Error scraping page {current_page}: {str(e)}")
#                 continue

#         if not all_scraped_data:
#             return {"error": "No products found across all pages."}

#         try:
#             save_to_excel("Climax_Marine", all_scraped_data)
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
#         "permissions": ["proxy","tabs","unlimitedStorage","storage","<all_urls>","webRequest","webRequestBlocking"],
#         "background": { "scripts": ["background.js"] }
#     }
#     """

#     background_js = f"""
#     var config = {{
#         mode: "fixed_servers",
#         rules: {{ singleProxy: {{ scheme: "{scheme}", host: "{host}", port: parseInt({port}) }}, bypassList: ["localhost"] }}
#     }};
#     chrome.proxy.settings.set({{value: config, scope: "regular"}}, function(){{}});
#     chrome.webRequest.onAuthRequired.addListener(
#         function(details){{
#             return {{authCredentials: {{username: "{user}", password: "{password}"}}}};
#         }},
#         {{urls:["<all_urls>"]}},
#         ["blocking"]
#     );
#     """

#     with zipfile.ZipFile(plugin_path, 'w') as z:
#         z.writestr("manifest.json", manifest_json)
#         z.writestr("background.js", background_js)

#     return plugin_path

# def scrape_climaxmarine(brand, product, oem_number=None, asin_number=None):

#     # Create proxy session for request
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

#     try:
#         driver = uc.Chrome(options=options)
#         # polite_delay()

#         # Build correct search URL
#         query = product.replace(" ", "+")
#         url = f"https://www.climaxmarine.com/?s={query}&post_type=product&type_aws=true"

#         print("Scraping:", url)

#         driver.get(url)

#         # # Auto-scroll to load everything
#         # for _ in range(4):
#         #     driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
#         #     time.sleep(1)

#         soup = BeautifulSoup(driver.page_source, "html.parser")

#         # PRODUCT LISTING ITEMS
#         product_cards = soup.select("li.product-col")

#         scraped_data = []

#         for card in product_cards:

#             # Product URL (ALWAYS present)
#             a_tag = card.select_one("a.product-loop-title")
#             product_url = a_tag["href"] if a_tag else "N/A"

#             # Product Name
#             name_tag = card.select_one("h3.woocommerce-loop-product__title")
#             name = name_tag.get_text(strip=True) if name_tag else "N/A"

#             # Price
#             price_tag = card.select_one("span.price bdi")
#             raw_price = price_tag.get_text(strip=True) if price_tag else "NA"

#             nums = re.findall(r"[\d,]+(?:\.\d+)?", raw_price)
#             price = float(nums[0].replace(",", "")) if nums else None

#             scraped_data.append({
#                 "BRAND": brand,
#                 "PRODUCT": product,
#                 "OEM NUMBER": oem_number or "NA",
#                 "ASIN NUMBER": asin_number or "NA",
#                 "WEBSITE": "Climax Marine",
#                 "PRODUCT NAME": name,
#                 "PRICE": price,
#                 "CURRENCY": "AED",
#                 "SELLER RATING": "N/A",
#                 "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                 "SOURCE URL": product_url,
#             })

#         if not scraped_data:
#             return {"error": "No products found on NTS UAE search page."}

#         save_to_excel("Climax_Marine", scraped_data)
#         return {"data": scraped_data}

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
