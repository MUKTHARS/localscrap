import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re
from scrapers.utils import polite_delay, save_to_excel
from datetime import datetime
import random

def scrape_sharafdg(brand, product, oem_number=None, asin_number=None):
    options = uc.ChromeOptions()
    options.headless = True
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--window-size=1920,1080")
    
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
        url = f"https://uae.sharafdg.com/?q={query}&post_type=product"
        print(f"Scraping SharafDG: {url}")
        driver.get(url)

        time.sleep(8)

        # Scroll to load content
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight/2);")
        time.sleep(2)
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(3)

        soup = BeautifulSoup(driver.page_source, "html.parser")
        
        # Multiple selector attempts
        product_cards = (soup.select(".product-wrapper") or 
                        soup.select(".product-item") or
                        soup.select("[class*='product']"))

        scraped_data = []

        for card in product_cards:
            try:
                # URL
                url_tag = card.select_one("a") or card.select_one(".product-link")
                product_url = url_tag["href"] if url_tag and url_tag.has_attr("href") else "N/A"
                if product_url and not product_url.startswith("http"):
                    product_url = "https://uae.sharafdg.com" + product_url

                # Name
                name_tag = (card.select_one("h2") or 
                           card.select_one(".product-title") or
                           card.select_one(".slider--prd-info"))
                name = name_tag.get_text(strip=True) if name_tag else "N/A"

                # Price
                price_tag = (card.select_one(".price") or 
                            card.select_one(".amount") or
                            card.select_one("[class*='price']"))
                raw_price = price_tag.get_text(strip=True) if price_tag else "0"

                price_nums = re.findall(r'[\d,]+(?:\.\d+)?', raw_price)
                price_value = float(price_nums[0].replace(",", "")) if price_nums else 0

                # Rating
                rating_tag = card.select_one("[class*='rating']") or card.select_one(".product-rating-count")
                if rating_tag:
                    rating = rating_tag.get_text(strip=True).replace("(", "").replace(")", "")
                else:
                    rating = "N/A"

                # FIX: Correct website name
                scraped_data.append({
                    "BRAND": brand,
                    "PRODUCT": product,
                    "OEM NUMBER": oem_number or "NA",
                    "ASIN NUMBER": asin_number or "NA",
                    "WEBSITE": "SharafDG",  # FIXED: Was "AmitRetail"
                    "PRODUCT NAME": name,
                    "PRICE": price_value,
                    "CURRENCY": "AED",
                    "SELLER RATING": rating,
                    "DATE SCRAPED": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "SOURCE URL": product_url,
                })
            except Exception as card_error:
                print(f"Error processing SharafDG card: {card_error}")
                continue

        if not scraped_data:
            with open("sharafdg_debug.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            return {"error": "No products found. Check sharafdg_debug.html"}

        try:
            save_to_excel("SharafDG", scraped_data)
        except:
            pass

        return {"data": scraped_data}

    except Exception as e:
        print(f"SharafDG scraping error: {e}")
        return {"error": str(e)}

    finally:
        if 'driver' in locals():
            driver.quit()
