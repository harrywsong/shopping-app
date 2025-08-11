# E:\codingprojects\shopping\stores\nofrills_scraper.py
import time
import logging
from bs4 import BeautifulSoup
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from urllib.parse import urljoin


def scroll_to_bottom(driver, pause_time=0.5, max_scrolls=10):
    last_height = driver.execute_script("return document.body.scrollHeight")
    scrolls = 0

    while scrolls < max_scrolls:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

        # wait for scroll height to increase or timeout
        try:
            WebDriverWait(driver, pause_time).until(
                lambda d: d.execute_script("return document.body.scrollHeight") > last_height
            )
            last_height = driver.execute_script("return document.body.scrollHeight")
        except:
            # no increase in height after pause_time, end scrolling
            break

        scrolls += 1


def clean_value(value):
    """Remove 'null' strings from values and return None if empty."""
    if value is None:
        return None
    value = str(value).replace('null', '').strip()
    return value if value else None


def scrape_single_page(driver, page_url):
    """Scrape a single page of the No Frills flyer."""
    driver.get(page_url)
    time.sleep(2)

    # # Try to accept cookies (only needed on first page)
    # try:
    #     cookie_accept = WebDriverWait(driver, 5).until(
    #         EC.element_to_be_clickable((By.ID, 'onetrust-accept-btn-handler')))
    #     cookie_accept.click()
    #     logging.info("Accepted cookies")
    #     time.sleep(1)
    # except:
    #     pass

    # Wait for products
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR,
                                            'div[data-testid="product-tile"], div.product-tile, div.css-yyn1h'))
        )
    except TimeoutException:
        logging.warning(f"Product tiles container not found on page: {page_url}")

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

    # Process all tiles
    for tile in tiles:
        product_data = {
            "store": "nofrills",
            "name": None,
            "price": None,
            "unit": None,
            "original_price": None,
            "image_url": None,
            "valid": True,
            "error": None,
            "page_url": page_url  # Track which page the item came from
        }

        try:
            # Extract and clean name
            name_tag = (tile.select_one('h3[data-testid="product-title"], h3.product-title') or
                        tile.select_one('div[data-testid="product-title"]'))
            product_data["name"] = clean_value(name_tag.get_text(strip=True) if name_tag else None)

            # Extract and clean price
            sale_price_tag = (tile.select_one('span[data-testid="sale-price"], span.price__value') or
                              tile.select_one('span.price-sale'))
            if sale_price_tag:
                product_data["price"] = clean_value(
                    sale_price_tag.get_text(strip=True)
                    .replace('sale', '')
                    .strip()
                )

            # Extract and clean original price
            was_price_tag = (tile.select_one('span[data-testid="was-price"], span.price__was') or
                             tile.select_one('span.price-was'))
            if was_price_tag:
                product_data["original_price"] = clean_value(
                    was_price_tag.get_text(strip=True)
                    .replace('was', '')
                    .strip()
                )

            # Extract and clean unit/amount
            amount_tag = (tile.select_one('p[data-testid="product-package-size"], p.product-amount') or
                          tile.select_one('div.product-size'))
            if amount_tag:
                product_data["unit"] = clean_value(amount_tag.get_text(strip=True))

            # Extract and clean image URL
            img_tag = (tile.select_one('div[data-testid="product-image"] img, div.product-image img') or
                       tile.select_one('img.product-img'))
            if img_tag and 'src' in img_tag.attrs:
                image_url = img_tag['src']
            product_data["image_url"] = clean_value(
                urljoin('https://www.nofrills.ca', image_url)
                if image_url.startswith('/')
                else image_url
            )

            # Validate required fields
            if not product_data["name"] or not product_data["price"]:
                product_data["valid"] = False
            missing_fields = []
            if not product_data["name"]:
                missing_fields.append("name")
            if not product_data["price"]:
                missing_fields.append("price")
            product_data["error"] = f"Missing {', '.join(missing_fields)}"

        except Exception as e:
            product_data["valid"] = False
            product_data["error"] = f"Parsing error: {str(e)}"
            logging.warning(f"Error parsing product tile: {str(e)}")

        finally:
            # Clean all values one more time before adding
            for key in product_data:
                if isinstance(product_data[key], str):
                    product_data[key] = clean_value(product_data[key])

            page_items.append(product_data)

    return page_items


def scrape_nofrills_flyer(driver, flyers_data):
    """Scrape product data from all No Frills flyer pages (1-50)."""
    base_url = "https://www.nofrills.ca/en/deals/flyer"
    max_pages = 20
    items_per_page = {}

    try:
        for page_num in range(1, max_pages + 1):
            page_url = f"{base_url}?page={page_num}" if page_num > 1 else base_url
            logging.info(f"Scraping page {page_num}...")

            page_items = scrape_single_page(driver, page_url)
            items_per_page[page_num] = len(page_items)
            flyers_data.extend(page_items)

            # Stop if no product tiles found on page (empty page)
            if len(page_items) == 0:
                logging.info(f"No product tiles found on page {page_num}, stopping pagination.")
                break

            # Also stop if all products are invalid (optional)
            valid_items = [item for item in page_items if item.get("valid")]
            if len(valid_items) == 0:
                logging.info(f"All products invalid on page {page_num}, stopping pagination.")
                break

            time.sleep(0.5)  # reduced delay

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