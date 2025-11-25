import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re
import random
import requests
from datetime import datetime
# Ensure these imports exist in your project structure
from scrapers.utils import polite_delay, save_to_excel 

def get_free_proxies():
    """
    Fetches free proxies from the user-provided sources.
    Returns a list of strings in format 'ip:port'.
    """
    proxy_list = []
    
    # 1. Fetch from Geonode (JSON API)
    try:
        url_geonode = "https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc"
        response = requests.get(url_geonode, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for item in data.get('data', []):
                ip = item.get("ip")
                port = item.get("port")
                if ip and port:
                    proxy_list.append(f"{ip}:{port}")
    except Exception as e:
        print(f"[Warning] Failed to fetch Geonode proxies: {e}")

    # 2. Fetch from GitHub TheSpeedX (Raw Text)
    try:
        url_github = "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
        response = requests.get(url_github, timeout=10)
        if response.status_code == 200:
            proxies = response.text.splitlines()
            for p in proxies:
                if ':' in p: # Basic validation
                    proxy_list.append(p.strip())
    except Exception as e:
        print(f"[Warning] Failed to fetch GitHub proxies: {e}")

    # Remove duplicates and shuffle
    unique_proxies = list(set(proxy_list))
    random.shuffle(unique_proxies)
    print(f"[Info] Fetched {len(unique_proxies)} total proxies.")
    return unique_proxies

def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
    # Fetch fresh proxies every time we start a scrape job
    available_proxies = get_free_proxies()
    
    if not available_proxies:
        return {"error": "No proxies could be fetched. Check internet connection."}

    max_retries = 3
    driver = None

    # Try up to 'max_retries' different proxies
    for attempt in range(max_retries):
        current_proxy = available_proxies.pop(0) if available_proxies else None
        if not current_proxy:
            break

        print(f"[Attempt {attempt+1}/{max_retries}] Trying proxy: {current_proxy}")

        try:
            # --- CHROME OPTIONS ---
            options = uc.ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--window-size=1920,1080")
            
            # INTEGRATE PROXY HERE
            options.add_argument(f'--proxy-server={current_proxy}')

            # Random User Agent
            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
            ]
            options.add_argument(f"--user-agent={random.choice(user_agents)}")

            # Initialize Driver
            # version_main ensures compatibility if your VPS chrome auto-updates
            driver = uc.Chrome(options=options, version_main=114) 
            
            # Set a strict page load timeout so we don't hang on bad proxies
            driver.set_page_load_timeout(30)

            polite_delay()

            # --- NAVIGATION ---
            if asin_number:
                keywords = [brand, product, asin_number]
            else:
                keywords = [brand, product, oem_number] if oem_number else [brand, product]

            query = "+".join([k for k in keywords if k])
            url = f"https://www.amitretail.com/shop?search={query}"
            
            driver.get(url)

            # GIVE ALGOLIA JS TIME TO LOAD RENDERED RESULTS
            time.sleep(5)

            # Ensure further JS rendering is complete
            for _ in range(3): # Reduced range slightly for speed
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1)

            # --- PARSING ---
            soup = BeautifulSoup(driver.page_source, "html.parser")
            product_cards = soup.select("li.product-col")
            
            # If we get here and soup is empty, the proxy might have loaded a captcha or blocked page
            if not product_cards and "403" in driver.title:
                raise Exception("Proxy blocked (403 or Captcha)")

            scraped_data = []

            for card in product_cards:
                # URL
                url_tag = card.select_one("a.product-loop-title")
                product_url = url_tag["href"] if url_tag else "N/A"

                # Name
                name_tag = card.select_one("h3.woocommerce-loop-product__title")
                name = name_tag.get_text(strip=True) if name_tag else "N/A"

                # Price
                price_tag = card.select_one("span.price")
                raw_price = price_tag.get_text(strip=True) if price_tag else "0"
                price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

                # Currency
                currency_tag = card.select_one("span.custom_currency")
                currency = currency_tag["alt"] if currency_tag and currency_tag.has_attr("alt") else "NA"

                scraped_data.append({
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

            # Save to Excel
            try:
                save_to_excel("AmitRetail", scraped_data)
            except:
                pass

            # If successful, return data and BREAK out of the retry loop
            return {"data": scraped_data}

        except Exception as e:
            print(f"[Error] Proxy {current_proxy} failed: {str(e)}")
            # Don't return error yet, loop to next proxy
            if driver:
                try:
                    driver.quit()
                except:
                    pass
            continue

        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass

    return {"error": "All proxy attempts failed."}

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
