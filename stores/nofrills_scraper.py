# Updated nofrills_scraper.py with fixes:
# - Set max_pages to 50 for full scraping.
# - Uncommented and improved cookie accept handling.
# - Improved scrolling with dynamic detection.
# - Better error handling and logging.
# - Added dynamic pagination stop when no more items or duplicate pages.

import time
import logging
from bs4 import BeautifulSoup
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from urllib.parse import urljoin

def scroll_to_bottom(driver, pause_time=1, max_scrolls=20):
    last_height = driver.execute_script("return document.body.scrollHeight")
    scrolls = 0
    while scrolls < max_scrolls:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(pause_time)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height
        scrolls += 1

def clean_value(value):
    if value is None:
        return None
    value = str(value).replace('null', '').strip()
    return value if value else None

def scrape_single_page(driver, page_url):
    driver.get(page_url)
    time.sleep(2)

    # Accept cookies if present
    try:
        cookie_accept = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.ID, 'onetrust-accept-btn-handler')))
        cookie_accept.click()
        logging.info("Accepted cookies")
        time.sleep(1)
    except TimeoutException:
        logging.info("No cookie banner found or already accepted.")

    # Wait for products
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR,
                                            'div[data-testid="product-tile"], div.product-tile, div.css-yyn1h'))
        )
    except TimeoutException:
        logging.warning(f"Product tiles container not found on page: {page_url}")
        return []

    # Scroll to load all products
    scroll_to_bottom(driver)
    time.sleep(1)

    # Parse the page
    soup = BeautifulSoup(driver.page_source, 'html.parser')
    tiles = soup.select('div[data-testid="product-tile"], div.product-tile, div.css-yyn1h')

    if not tiles:
        logging.warning(f"No product tiles found on page: {page_url}")
        return []

    logging.info(f"Found {len(tiles)} product tiles on page: {page_url}")

    page_items = []

    for tile in tiles:
        product_data = {
            "store": "nofrills",
            "name": None,
            "price": None,
            "unit": None,
            "details": None,
            "original_price": None,
            "image_url": None,
            "valid": True,
            "error": None,
            "page_url": page_url
        }

        try:
            name_tag = tile.select_one('h3[data-testid="product-title"]')
            product_data["name"] = clean_value(name_tag.get_text(strip=True) if name_tag else None)

            original_price_tag = tile.select_one('span[data-testid="was-price"]') or tile.select_one(
                'span[data-testid="regular-price"]')
            if original_price_tag:
                original_price_text = original_price_tag.get_text(strip=True)
                product_data["original_price"] = clean_value(
                    original_price_text.replace('was', '').strip()
                )

            sale_price_tag = tile.select_one('span[data-testid="sale-price"]')
            if sale_price_tag:
                price_text = sale_price_tag.get_text(strip=True)
                product_data["price"] = clean_value(price_text.replace('sale', '').strip())
            else:
                product_data["price"] = None

            amount_tag = tile.select_one('p[data-testid="product-package-size"]')
            if amount_tag:
                text = clean_value(amount_tag.get_text(strip=True))
                if text:
                    if '$' in text and text.endswith(('g', 'kg')):
                        parts = text.split('$')
                        unit_text = parts[0].strip().replace(',', '')
                        details_text = f"${parts[1].strip()}"
                        product_data["unit"] = f"/{unit_text}"
                        product_data["details"] = details_text
                    else:
                        product_data["unit"] = f"/{text}"

            img_tag = tile.select_one('div[data-testid="product-image"] img')
            image_url = None
            if img_tag and 'src' in img_tag.attrs:
                image_url = img_tag['src']
            product_data["image_url"] = clean_value(
                urljoin('https://www.nofrills.ca', image_url)
                if image_url and image_url.startswith('/')
                else image_url
            )

            if not product_data["name"] or not (product_data["price"] or product_data["original_price"]):
                product_data["valid"] = False
                missing_fields = []
                if not product_data["name"]:
                    missing_fields.append("name")
                if not (product_data["price"] or product_data["original_price"]):
                    missing_fields.append("price/original_price")
                product_data["error"] = f"Missing {', '.join(missing_fields)}"

        except Exception as e:
            product_data["valid"] = False
            product_data["error"] = f"Parsing error: {str(e)}"
            logging.warning(f"Error parsing product tile: {str(e)}")

        finally:
            for key in product_data:
                if isinstance(product_data[key], str):
                    product_data[key] = clean_value(product_data[key])
            page_items.append(product_data)

    return page_items

def scrape_nofrills_flyer(driver, flyers_data):
    base_url = "https://www.nofrills.ca/en/deals/flyer"
    max_pages = 50
    items_per_page = {}
    previous_page_items = set()  # To detect duplicates for stopping

    try:
        for page_num in range(1, max_pages + 1):
            page_url = f"{base_url}?page={page_num}" if page_num > 1 else base_url
            logging.info(f"Scraping page {page_num}...")

            page_items = scrape_single_page(driver, page_url)
            items_per_page[page_num] = len(page_items)

            # Check for duplicates or empty
            current_items_set = set(item['name'] for item in page_items if item['name'])
            if len(page_items) == 0 or current_items_set == previous_page_items:
                logging.info(f"No new items on page {page_num}, stopping pagination.")
                break
            previous_page_items = current_items_set

            flyers_data.extend(page_items)
            time.sleep(1)  # Increased delay for stability

    except Exception as e:
        logging.error(f"Error during pagination: {str(e)}")
    finally:
        valid_count = sum(1 for item in flyers_data if item["valid"])
        total_items = len(flyers_data)

        logging.info("\nPage Item Counts:")
        for page, count in items_per_page.items():
            logging.info(f"Page {page}: {count} items")

        logging.info(f"\nScraping complete. Valid: {valid_count}, Total: {total_items}")
        logging.info(f"Scraped {len(items_per_page)} pages with items.")