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
from scrapers.utils import save_to_excel

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

def scrape_flipkart(brand, product, oem_number=None, asin_number=None):
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
            print(f"[{session_id}] Acquire Lock: Starting Flipkart Browser...")
            
            # Start virtual display once
            try:
                display = Display(visible=0, size=(1920, 1080))
                display.start()
            except Exception as disp_e:
                print(f"[{session_id}] Error starting display: {disp_e}")

            # RETRY LOGIC: Try to start browser up to 3 times
            browser_started = False
            for attempt in range(1, 4):
                try:
                    options = uc.ChromeOptions()
                    options.add_argument(f"--user-data-dir={temp_user_data_dir}")
                    options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")
                    options.add_argument("--no-sandbox")
                    options.add_argument("--disable-dev-shm-usage")
                    options.add_argument("--disable-gpu")
                    options.add_argument("--start-maximized")
                    options.add_argument("--disable-popup-blocking")
                    
                    # Extra stability options
                    options.add_argument("--disable-infobars")
                    options.add_argument("--disable-extensions-file-access-check")

                    # Driver patching
                    patcher = uc.Patcher()
                    patcher.auto()
                    src_driver = patcher.executable_path
                    
                    unique_driver_name = f"chromedriver_{session_id}_{attempt}"
                    unique_driver_path = os.path.join(temp_user_data_dir, unique_driver_name)
                    shutil.copy2(src_driver, unique_driver_path)
                    os.chmod(unique_driver_path, 0o755)

                    driver = uc.Chrome(
                        options=options, 
                        driver_executable_path=unique_driver_path,
                        use_subprocess=True,
                        version_main=None
                    )
                    
                    # If we get here, browser started successfully
                    print(f"[{session_id}] Browser started on attempt {attempt}. Stabilizing...")
                    browser_started = True
                    # time.sleep(2)
                    break 

                except Exception as e:
                    print(f"[{session_id}] Browser launch attempt {attempt} failed: {e}")
                    # Clean up failed driver before retrying
                    if driver:
                        try: driver.quit()
                        except: pass
                    driver = None
                    # time.sleep(3) # Wait before retry

            if not browser_started:
                raise Exception("Failed to start Chrome browser after 3 attempts")

            print(f"[{session_id}] Lock Released.")

        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]
        
        base_query = "+".join([k for k in keywords if k])

        for current_page in range(1, max_pages + 1):
            print(f"[{session_id}] Scraping Flipkart Page {current_page}...")
            
            url = f"https://www.flipkart.com/search?q={base_query}&page={current_page}"
            
            try:
                driver.get(url)
                
                if "Something is wrong" in driver.page_source:
                    print(f"[{session_id}] Soft block detected. Stopping.")
                    break

                soup = BeautifulSoup(driver.page_source, "html.parser")
                product_cards = soup.select("div[data-id]")

                if not product_cards:
                    print(f"[{session_id}] No products found on page {current_page}.")
                    break

                page_new_items = 0

                for card in product_cards:
                    url_tag = (
                        card.select_one("a.k7wcnx") or
                        card.select_one("a.CIaYa1") or
                        card.select_one("a.GnxRXv") or
                        card.select_one("a")
                    )
                    
                    if not url_tag or not url_tag.has_attr("href"): continue

                    raw_url = "https://www.flipkart.com" + url_tag['href']
                    clean_url_key = raw_url.split("?")[0]
                    
                    if clean_url_key in seen_urls: continue
                    seen_urls.add(clean_url_key)
                    product_url = raw_url

                    name_tag = (
                        card.select_one("div.RG5Slk") or
                        card.select_one("a.atJtCj") or
                        card.select_one("a.pIpigb") or
                        card.select_one("div.TbCaMn")
                    )
                    name = name_tag.get_text(strip=True) if name_tag else "N/A"

                    if name.lower() in ["sponsored", "advertisement"]: continue

                    price_tag = card.select_one("div.hZ3P6w")
                    raw_price = price_tag.text.strip() if price_tag else "0"
                    price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                    
                    if not price_nums: continue

                    try:
                        price_value = float(price_nums[0].replace(",", ""))
                    except ValueError: continue

                    currency_match = re.search(r'([$€£₹]|Rs)', raw_price)
                    currency = currency_match.group(0) if currency_match else "₹"

                    rating_tag = card.select_one("div.MKiFS6")
                    rating = rating_tag.text.strip() if rating_tag else "N/A"

                    all_scraped_data.append({
                        "BRAND": brand,
                        "PRODUCT": product,
                        "OEM NUMBER": oem_number or "NA",
                        "ASIN NUMBER": asin_number or "NA",
                        "WEBSITE": "Flipkart",
                        "PRODUCT NAME": name,
                        "PRICE": price_value,
                        "CURRENCY": currency,
                        "SELLER RATING": rating,
                        "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "SOURCE URL": product_url,
                    })
                    page_new_items += 1
                
                print(f"[{session_id}] > Added {page_new_items} items.")

                if page_new_items == 0 and len(product_cards) > 0:
                      print(f"[{session_id}] Page contained only duplicates. Stopping.")
                      break

            except Exception as e:
                print(f"[{session_id}] Error scraping page {current_page}: {str(e)}")
                continue 

        if not all_scraped_data:
            return {"error": "No products found."}

        try:
            save_to_excel("Flipkart", all_scraped_data)
        except Exception: pass

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
# from scrapers.utils import save_to_excel
# import gc

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

# def scrape_flipkart(brand, product, oem_number=None, asin_number=None):
#     max_pages=25
#     session_id = random.randint(100000, 999999)
#     session_user = f"{PROXY_USER}-session-{session_id}"
#     proxy_plugin = create_proxy_auth_extension(
#         host=PROXY_HOST,
#         port=PROXY_PORT,
#         user=session_user,
#         password=PROXY_PASS
#     )

#     options = uc.ChromeOptions()
#     options.add_argument("--headless=new")
#     options.add_argument("--disable-gpu")
#     options.add_argument("--no-sandbox")
#     options.add_argument("--disable-dev-shm-usage")
#     options.add_argument("--window-size=1920,1080")
#     options.add_argument("--disable-blink-features=AutomationControlled")
#     options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

#     user_agents = [
#         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
#     ]
#     options.add_argument(f"--user-agent={random.choice(user_agents)}")

#     driver = None
#     all_scraped_data = [] 
    
#     seen_urls = set()

#     try:
#         driver = uc.Chrome(options=options)
        
#         if asin_number:
#             keywords = [brand, product, asin_number]
#         else:
#             keywords = [brand, product, oem_number] if oem_number else [brand, product]
        
#         base_query = "+".join([k for k in keywords if k])

#         for current_page in range(1, max_pages + 1):
#             print(f"Scraping Flipkart Page {current_page}...")
            
#             url = f"https://www.flipkart.com/search?q={base_query}&page={current_page}"
            
#             try:
#                 driver.get(url)
#                 # time.sleep(2)

#                 if "Something is wrong" in driver.page_source:
#                     print(f"Soft block detected on page {current_page}. Stopping.")
#                     break

#                 soup = BeautifulSoup(driver.page_source, "html.parser")
#                 product_cards = soup.select("div[data-id]")

#                 if not product_cards:
#                     print(f"No products found on page {current_page}. Ending scrape.")
#                     break

#                 page_new_items = 0

#                 for card in product_cards:
#                     url_tag = (
#                         card.select_one("a.k7wcnx") or
#                         card.select_one("a.CIaYa1") or
#                         card.select_one("a.GnxRXv") or
#                         card.select_one("a")
#                     )
                    
#                     if not url_tag or not url_tag.has_attr("href"):
#                         continue

#                     raw_url = "https://www.flipkart.com" + url_tag['href']
                    
#                     clean_url_key = raw_url.split("?")[0]
                    
#                     if clean_url_key in seen_urls:
#                         continue
                    
#                     seen_urls.add(clean_url_key)
#                     product_url = raw_url

#                     name_tag = (
#                         card.select_one("div.RG5Slk") or
#                         card.select_one("a.atJtCj") or
#                         card.select_one("a.pIpigb") or
#                         card.select_one("div.TbCaMn")
#                     )
#                     name = name_tag.get_text(strip=True) if name_tag else "N/A"

#                     if name.lower() in ["sponsored", "advertisement"]:
#                         continue

#                     price_tag = card.select_one("div.hZ3P6w")
#                     raw_price = price_tag.text.strip() if price_tag else "0"
#                     price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                    
#                     if not price_nums:
#                         continue

#                     try:
#                         price_value = float(price_nums[0].replace(",", ""))
#                     except ValueError:
#                         continue

#                     currency_match = re.search(r'([$€£₹]|Rs)', raw_price)
#                     currency = currency_match.group(0) if currency_match else "₹"

#                     rating_tag = card.select_one("div.MKiFS6")
#                     rating = rating_tag.text.strip() if rating_tag else "N/A"

#                     all_scraped_data.append({
#                         "BRAND": brand,
#                         "PRODUCT": product,
#                         "OEM NUMBER": oem_number or "NA",
#                         "ASIN NUMBER": asin_number or "NA",
#                         "WEBSITE": "Flipkart",
#                         "PRODUCT NAME": name,
#                         "PRICE": price_value,
#                         "CURRENCY": currency,
#                         "SELLER RATING": rating,
#                         "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                         "SOURCE URL": product_url,
#                     })
#                     page_new_items += 1
                
#                 print(f"  > Added {page_new_items} unique items from page {current_page}.")

#                 if page_new_items == 0 and len(product_cards) > 0:
#                      print("  > Page contained only duplicates. Stopping.")
#                      break

#             except Exception as e:
#                 print(f"Error scraping page {current_page}: {str(e)}")
#                 continue 

#         if not all_scraped_data:
#             return {"error": "No products found across all pages."}

#         try:
#             save_to_excel("Flipkart", all_scraped_data)
#         except Exception:
#             pass

#         return {"data": all_scraped_data}

#     except Exception as e:
#         return {"error": str(e)}

#     finally:
#         if driver:
#             try:
#                 driver.quit()
#             except:
#                 pass
        
#         if os.path.exists(proxy_plugin):
#             try:
#                 os.remove(proxy_plugin)
#             except:
#                 pass
#         gc.collect()

# import undetected_chromedriver as uc
# from bs4 import BeautifulSoup
# import time, re, os, zipfile, random, string
# from datetime import datetime
# from scrapers.utils import polite_delay, save_to_excel
# import gc
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC

# # --- PROXY CONFIGURATION ---
# PROXY_HOST = "gate.decodo.com"  # Check your dashboard
# PROXY_PORT = "10001"             # Check your dashboard
# PROXY_USER = "sp7oukpich"    # REPLACE WITH ACTUAL USER
# PROXY_PASS = "oHz7RSjbv1W7cafe+7"    # REPLACE WITH ACTUAL PASS

# def create_proxy_auth_extension(host, port, user, password, scheme='http', plugin_path=None):
#     if plugin_path is None:
#         # Random filename to avoid conflicts during parallel scraping
#         random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
#         plugin_path = os.path.join(os.getcwd(), f'proxy_auth_plugin_{random_suffix}.zip')

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

# def scrape_flipkart(brand, product, oem_number=None, asin_number=None):
#     # 1. Create Proxy Extension
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
#     options.add_argument("--headless=new")
#     options.add_argument("--disable-gpu")
#     options.add_argument("--no-sandbox")            # Mandatory for VPS Root
#     options.add_argument("--disable-dev-shm-usage") # Mandatory for VPS Memory
#     options.add_argument("--window-size=1920,1080")
#     options.add_argument("--disable-blink-features=AutomationControlled")
    
#     # Load Proxy
#     options.add_argument(f"--load-extension={os.path.abspath(proxy_plugin)}")

#     # 3. Random User Agent (Fixed Logic)
#     user_agents = [
#         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
#     ]
#     # We pick ONE agent randomly, instead of passing the whole list
#     options.add_argument(f"--user-agent={random.choice(user_agents)}")

#     driver = None

#     try:
#         driver = uc.Chrome(options=options)
#         # polite_delay()

#         # Build dynamic query
#         if asin_number:
#             keywords = [brand, product, asin_number]
#         else:
#             keywords = [brand, product, oem_number] if oem_number else [brand, product]

#         query = "+".join([k for k in keywords if k])
#         url = f"https://www.flipkart.com/search?q={query}"
        
#         driver.get(url)
        
#         WebDriverWait(driver, 5).until(
#             EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-id]"))
#         )

#         soup = BeautifulSoup(driver.page_source, "html.parser")
#         product_cards = soup.select("div[data-id]")

#         scraped_data = []

#         for card in product_cards:
#             # Product URL
#             url_tag = (
#                 card.select_one("a.k7wcnx") or
#                 card.select_one("a.CIaYa1") or
#                 card.select_one("a.GnxRXv") or
#                 card.select_one("a")
#             )
#             product_url = "https://www.flipkart.com" + url_tag['href'] if url_tag and url_tag.has_attr("href") else "N/A"

#             # Product Name
#             name_tag = (
#                 card.select_one("div.RG5Slk") or
#                 card.select_one("a.atJtCj") or
#                 card.select_one("a.pIpigb") or
#                 card.select_one("div.TbCaMn")
#             )
#             name = name_tag.get_text(strip=True) if name_tag else "N/A"

#             if not name or name.lower() in ["sponsored", "advertisement"]:
#                 continue

#             # Price
#             price_tag = (
#                 card.select_one("div.hZ3P6w")
#             )
#             raw_price = price_tag.text.strip() if price_tag else "0"
#             price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
#             if not price_nums:
#                 continue

#             try:
#                 price_value = float(price_nums[0].replace(",", ""))
#             except ValueError:
#                 continue

#             currency_match = re.search(r'([$€£₹]|Rs)', raw_price)
#             currency = currency_match.group(0) if currency_match else "₹"

#             # Rating
#             rating_tag = (
#                 card.select_one("div.MKiFS6")
#             )
#             rating = rating_tag.text.strip() if rating_tag else "N/A"

#             # Append structured data
#             scraped_data.append({
#                 "BRAND": brand,
#                 "PRODUCT": product,
#                 "OEM NUMBER": oem_number or "NA",
#                 "ASIN NUMBER": asin_number or "NA",
#                 "WEBSITE": "Flipkart",
#                 "PRODUCT NAME": name,
#                 "PRICE": price_value,
#                 "CURRENCY": currency,
#                 "SELLER RATING": rating,
#                 "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#                 "SOURCE URL": product_url,
#             })

#         if not scraped_data:
#             return {"error": "No products found. Please search for other available products"}

#         try:
#             save_to_excel("Flipkart", scraped_data)
#         except Exception:
#             pass

#         return {"data": scraped_data}

#     except Exception as e:
#         return {"error": str(e)}

#     finally:
#         # --- SAFE QUIT LOGIC ---
#         if driver:
#             try:
#                 driver.quit()
#             except:
#                 pass
        
#         # Clean up proxy file
#         if os.path.exists(proxy_plugin):
#             try:
#                 os.remove(proxy_plugin)
#             except:
#                 pass
#         gc.collect()

