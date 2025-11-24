import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re, traceback, random
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

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

def scrape_sharafdg(brand, product, oem_number=None, asin_number=None):
    max_retries = 3
    headless = True
    scraped_data = []

    for attempt in range(1, max_retries + 1):
        ua = random.choice(USER_AGENTS)
        width, height = _random_viewport_size()

        try:
            options = uc.ChromeOptions()
            if headless:
                options.add_argument("--headless+new")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.add_argument("--disable-blink-features=AutomationControlled")
                options.add_argument(f"--user-agent={ua}")
                options.add_argument(f"--window-size={width},{height}")
                options.add_argument("--disable-extensions")
                options.add_argument("--disable-background-networking")
                options.add_argument("--log-level=3")

            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(45)

            _stealth_hook(driver, ua)

            # Warm-up visit
            try:
                warmup_url = "https://uae.sharafdg.com/"
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
            url = f"https://uae.sharafdg.com/?q={query}&post_type=product"
            driver.get(url)

            # Wait for results with retry logic
            try:
                WebDriverWait(driver, 18).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.product-wrapper"))
                )
            except Exception:
                try:
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight/4);")
                except Exception:
                    pass
                time.sleep(random.uniform(4.5, 8.5))

            # Ensure further JS rendering is complete
            for _ in range(5):
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1)

            html = driver.page_source

            # Block detection
            if "access denied" in html.lower() or "bot" in html.lower():
                driver.quit()
                time.sleep(random.uniform(6, 14) * attempt)
                continue

            # Parse
            soup = BeautifulSoup(driver.page_source, "html.parser")
            product_cards = soup.select("div.product-wrapper")

            for card in product_cards:
                # URL
                url_tag = card.select_one("a.product-link")
                product_url = url_tag["href"] if url_tag else "N/A"

                # Name
                name_tag = card.select_one("div.slider--prd-info")
                name = name_tag.get_text(strip=True) if name_tag else "N/A"

                # Price
                price_tag = card.select_one("div.price")
                raw_price = price_tag.get_text(strip=True) if price_tag else "0"

                price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

                # Currency
                currency="AED"

                #Rating
                rating_tag = card.select_one("span.product-rating-count")
                if rating_tag:
                    rating = rating_tag.get_text(strip=True).replace("(", "").replace(")", "")
                else:
                    rating = "N/A"

                scraped_data.append({
                    "BRAND": brand,
                    "PRODUCT": product,
                    "OEM NUMBER": oem_number or "NA",
                    "ASIN NUMBER": asin_number or "NA",
                    "WEBSITE": "SharafDG",
                    "PRODUCT NAME": name,
                    "PRICE": price_value,
                    "CURRENCY": currency,
                    "SELLER RATING": rating,
                    "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "SOURCE URL": product_url,
                })

            if scraped_data:
                try:
                    save_to_excel("SharafDG", scraped_data)
                except Exception:
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

    return {"error": "No products found or blocked after multiple retries."}
