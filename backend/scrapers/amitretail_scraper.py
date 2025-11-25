import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re
import random
import requests
from datetime import datetime

# ==========================================
# PART 1: PROXY HELPER FUNCTIONS
# ==========================================

def get_proxy_list():
    """Get free proxies from multiple reliable sources"""
    proxies = []
    
    # Source 1: FreeProxy API
    try:
        response = requests.get('https://freeproxyapi.com/api/v1/proxy?limit=10', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                for proxy in data:
                    if proxy.get('isWorking'):
                        proxies.append(f"http://{proxy['ip']}:{proxy['port']}")
            elif isinstance(data, dict):
                if data.get('ip') and data.get('port'):
                    proxies.append(f"http://{data['ip']}:{data['port']}")
    except:
        pass
    
    # Source 2: Geonode API
    try:
        response = requests.get('https://proxylist.geonode.com/api/proxy-list?limit=20&page=1&sort_by=lastChecked&sort_type=desc', timeout=10)
        if response.status_code == 200:
            data = response.json()
            for proxy in data.get('data', []):
                if proxy.get('protocols') and 'http' in proxy['protocols']:
                    proxies.append(f"http://{proxy['ip']}:{proxy['port']}")
    except:
        pass
    
    # Source 3: GitHub Proxy List
    try:
        response = requests.get('https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt', timeout=10)
        if response.status_code == 200:
            proxy_list = response.text.strip().split('\n')
            for proxy in proxy_list[:30]:  # Take first 30
                proxy = proxy.strip()
                if proxy and ':' in proxy:
                    proxies.append(f"http://{proxy}")
    except:
        pass
    
    # Remove duplicates
    return list(set(proxies))

def test_proxy(proxy_url, timeout=5):
    """Test if a proxy is working by hitting a lightweight IP echo service"""
    try:
        response = requests.get(
            'http://httpbin.org/ip',
            proxies={'http': proxy_url, 'https': proxy_url},
            timeout=timeout
        )
        return response.status_code == 200
    except:
        return False

def get_working_proxy():
    """Get a working proxy by testing multiple options"""
    print("Fetching and testing proxies...")
    proxies = get_proxy_list()
    random.shuffle(proxies)
    
    for proxy in proxies[:15]:  # Test up to 15 proxies
        print(f"Testing proxy: {proxy}...")
        if test_proxy(proxy):
            print(f"Found working proxy: {proxy}")
            return proxy
    
    print("No working proxies found, continuing without proxy")
    return None

def polite_delay(min_wait=2, max_wait=5):
    time.sleep(random.uniform(min_wait, max_wait))

# ==========================================
# PART 2: MAIN SCRAPER FUNCTION
# ==========================================

def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
    print(f"Starting scrape for: {brand} - {product}")
    
    # --- Chrome Options Setup ---
    options = uc.ChromeOptions()
    
    # VPS SPECIFIC PATHS (As requested)
    options.binary_location = "/opt/chrome-142-cft/chrome"
    
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    
    # Stealth options
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Random User Agent
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]
    options.add_argument(f"--user-agent={random.choice(user_agents)}")

    driver = None
    
    try:
        # --- Proxy Integration ---
        proxy = get_working_proxy()
        if proxy:
            options.add_argument(f'--proxy-server={proxy}')

        # --- Driver Initialization ---
        print("Initializing Chrome Driver...")
        driver = uc.Chrome(
            options=options, 
            driver_executable_path="/opt/chrome-142-cft/chromedriver",
            version_main=114 # Helps prevents version mismatch errors
        )
        
        # Extra Stealth: Overwrite navigator properties
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        polite_delay()

        # --- Build URL ---
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])
        url = f"https://www.amitretail.com/shop?search={query}"
        
        print(f"Navigating to: {url}")
        
        # Set Page Load Timeout (prevent hanging on bad proxies)
        driver.set_page_load_timeout(45)
        driver.get(url)

        # --- Handle Dynamic Content (Algolia/JS) ---
        print("Waiting for results to load...")
        time.sleep(5) # Initial wait for Algolia

        # Scroll to ensure rendering
        for _ in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)

        # --- Parsing ---
        soup = BeautifulSoup(driver.page_source, "html.parser")
        product_cards = soup.select("li.product-col")
        
        print(f"Found {len(product_cards)} product cards.")

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

            item = {
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
            }
            scraped_data.append(item)

        return {"data": scraped_data}

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return {"error": str(e)}

    finally:
        if driver:
            print("Closing driver...")
            driver.quit()

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
