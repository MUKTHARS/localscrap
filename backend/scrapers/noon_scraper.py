import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, traceback, random
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
]

def _stealth_hook(driver, user_agent):
    try:
        driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});")
        driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});")
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        driver.execute_script("window.chrome = { runtime: {}, loadTimes: function(){return {}} };")
        driver.execute_script("""
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.__query = originalQuery;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
        """)
        driver.execute_script(f"Object.defineProperty(navigator, 'userAgent', {{get: () => '{user_agent}'}});")
    except Exception:
        pass

def _random_viewport_size():
    widths = [1200, 1366, 1440, 1600, 1920]
    heights = [800, 768, 900, 1024, 1080]
    return random.choice(widths), random.choice(heights)

def scrape_noon(brand, product, oem_number=None, asin_number=None):
    max_retries = 3
    headless = True
    scraped_data = []

    for attempt in range(1, max_retries + 1):
        ua = random.choice(USER_AGENTS)
        width, height = _random_viewport_size()

        try:
            options = uc.ChromeOptions()
            if headless:
                options.add_argument("--headless=new")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.add_argument("--disable-blink-features=AutomationControlled")
                options.add_argument(f"--user-agent={ua}")
                options.add_argument(f"--window-size={width},{height}")
                options.add_argument("--disable-extensions")
                options.add_argument("--disable-background-networking")
                options.add_argument("--log-level=3")
                options.binary_location = '/usr/bin/google-chrome'

            driver = uc.Chrome(options=options, version_main=None)
            driver.set_page_load_timeout(45)

            _stealth_hook(driver, ua)

            # Warm-up visit
            try:
                warmup_url = "https://www.noon.com/uae-en/"
                driver.get(warmup_url)
                time.sleep(random.uniform(1.2, 2.8))
            except Exception:
                pass

            polite_delay()

            # Build search query
            if asin_number:
                keywords = [brand, product, asin_number]
            else:
                keywords = [brand, product, oem_number] if oem_number else [brand, product]

            query = "+".join([k for k in keywords if k])
            url = f"https://www.noon.com/uae-en/search/?q={query}"
            driver.get(url)

            # Wait for content with retry logic
            time.sleep(8)
            
            # Enhanced scrolling
            for _ in range(30):
                driver.execute_script("window.scrollBy(0, 900);")
                time.sleep(0.8)
            time.sleep(3)

            # Check for blocks
            html = driver.page_source
            if "access denied" in html.lower() or "bot" in html.lower():
                driver.quit()
                time.sleep(random.uniform(6, 14) * attempt)
                continue

            soup = BeautifulSoup(html, "html.parser")

            # Product cards
            product_cards = soup.select('div[class*="linkWrapper"]')

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

            if scraped_data:
                try:
                    save_to_excel("Noon", scraped_data)
                except:
                    pass
                driver.quit()
                return {"data": scraped_data}
            else:
                driver.quit()
                time.sleep(random.uniform(4, 10))
                continue

        except Exception as e:
            try:
                traceback.print_exc()
            except Exception:
                pass
            try:
                driver.quit()
            except Exception:
                pass
            time.sleep(random.uniform(4, 12) * attempt)
            continue

    return {
        "error": "Blocked or failed after multiple retries — consider rotating proxies or using a scraping API."
    }
