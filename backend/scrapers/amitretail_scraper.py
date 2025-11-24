import undetected_chromedriver as uc
from bs4 import BeautifulSoup
import time, re
from scrapers.utils import polite_delay, save_to_excel
from datetime import datetime
import random

def scrape_amitretail(brand, product, oem_number=None, asin_number=None):
    # Start undetected Chrome (headless OK!)
    options = uc.ChromeOptions()
    options.headless = True
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--window-size=1920,1080")
    
    # Random User Agent
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    ]
    
    options.add_argument(f"--user-agent={random.choice(user_agents)}")

    driver = uc.Chrome(options=options)

    try:
        polite_delay()

        # Build search query
        if asin_number:
            keywords = [brand, product, asin_number]
        else:
            keywords = [brand, product, oem_number] if oem_number else [brand, product]

        query = "+".join([k for k in keywords if k])
        url = f"https://www.amitretail.com/shop?search={query}"
        print(f"🔄 Loading AmitRetail: {url}")
        driver.get(url)

        # IMPROVED: Wait for initial page load and Algolia JS
        print("⏳ Waiting for Algolia JS to load...")
        time.sleep(8)  # Increased from 5 to 8 seconds

        # IMPROVED: Check if products are actually loaded
        products_loaded = False
        max_retries = 3
        
        for retry in range(max_retries):
            # Scroll to trigger lazy loading
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight/2);")
            time.sleep(2)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Check if we have product elements
            soup = BeautifulSoup(driver.page_source, "html.parser")
            product_cards = soup.select("li.product-col")
            
            if product_cards:
                print(f"✅ Found {len(product_cards)} products on attempt {retry + 1}")
                products_loaded = True
                break
            else:
                print(f"🔄 No products found yet, retrying... ({retry + 1}/{max_retries})")
                time.sleep(3)  # Wait longer before retry

        # If still no products, try one more approach
        if not products_loaded:
            print("🔄 Trying alternative loading method...")
            # Sometimes scrolling to top helps
            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(3)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            
            soup = BeautifulSoup(driver.page_source, "html.parser")
            product_cards = soup.select("li.product-col")

        scraped_data = []

        for card in product_cards:
            try:
                # URL
                url_tag = card.select_one("a.product-loop-title")
                product_url = url_tag["href"] if url_tag else "N/A"
                if product_url and not product_url.startswith('http'):
                    product_url = "https://www.amitretail.com" + product_url

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
                currency = currency_tag["alt"] if currency_tag and currency_tag.has_attr("alt") else "AED"  # Default to AED

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
            except Exception as card_error:
                print(f"⚠️ Error processing one product card: {card_error}")
                continue

        if not scraped_data:
            # Save debug info
            debug_info = {
                "url": url,
                "page_title": driver.title,
                "product_cards_found": len(product_cards),
                "page_source_length": len(driver.page_source)
            }
            print(f"❌ Debug info: {debug_info}")
            return {"error": "No products found after multiple retries. Site might be blocking or slow."}

        print(f"✅ Successfully scraped {len(scraped_data)} products from AmitRetail")
        
        # Save to Excel
        try:
            save_to_excel("AmitRetail", scraped_data)
        except Exception as save_error:
            print(f"⚠️ Save to Excel failed: {save_error}")

        return {"data": scraped_data}

    except Exception as e:
        print(f"❌ AmitRetail scraping error: {str(e)}")
        return {"error": f"AmitRetail: {str(e)}"}

    finally:
        driver.quit()
