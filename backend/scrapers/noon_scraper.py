import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re
from datetime import datetime
from scrapers.utils import polite_delay, save_to_excel
import random

def scrape_noon(brand, product, oem_number=None, asin_number=None):
    options = uc.ChromeOptions()
    options.headless = True
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # FIX: Use Chrome
    options.binary_location = '/usr/bin/google-chrome'

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ]
    
    options.add_argument(f"--user-agent={random.choice(user_agents)}")

    try:
        driver = uc.Chrome(options=options)
        polite_delay()

        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])
        url = f"https://www.noon.com/uae-en/search/?q={query}"
        print(f"Scraping Noon: {url}")
        driver.get(url)

        time.sleep(8)

        # Better scrolling with pauses
        for i in range(10):
            driver.execute_script(f"window.scrollTo(0, {i * 500});")
            time.sleep(0.5)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        
        # Multiple selector attempts
        product_cards = (soup.select('div[data-qa*="product"]') or 
                        soup.select('[class*="productContainer"]') or
                        soup.select('.sc-5ec9bc3c-0'))

        scraped_data = []

        for card in product_cards:
            try:
                # URL
                link = card.select_one('a[href*="/p/"]')
                product_url = "https://www.noon.com" + link["href"] if link else "N/A"

                # Name
                name_tag = card.select_one('[data-qa*="name"]') or card.select_one('h2')
                name = name_tag.get_text(strip=True) if name_tag else "N/A"

                # Rating
                rating_tag = card.select_one('[class*="rating"]') or card.select_one('.sc-7f8482d-0')
                rating = rating_tag.get_text(strip=True) if rating_tag else "N/A"

                # Price
                price_tag = card.select_one('[class*="price"]') or card.select_one('strong')
                raw_price = price_tag.get_text(strip=True) if price_tag else "0"

                price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

                scraped_data.append({
                    "BRAND": brand,
                    "PRODUCT": product,
                    "OEM NUMBER": oem_number or "NA",
                    "ASIN NUMBER": asin_number or "NA",
                    "WEBSITE": "Noon",
                    "PRODUCT NAME": name,
                    "PRICE": price_value,
                    "CURRENCY": "AED",
                    "SELLER RATING": rating,
                    "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "SOURCE URL": product_url,
                })
            except Exception as card_error:
                print(f"Error processing Noon card: {card_error}")
                continue

        if not scraped_data:
            with open("noon_debug.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            return {"error": "No products found. Check noon_debug.html"}

        try:
            save_to_excel("Noon", scraped_data)
        except:
            pass

        return {"data": scraped_data}

    except Exception as e:
        print(f"Noon scraping error: {e}")
        return {"error": str(e)}

    finally:
        if 'driver' in locals():
            driver.quit()
