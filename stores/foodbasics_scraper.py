import logging
from bs4 import BeautifulSoup
import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

# Configure logging for this specific scraper
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def scrape_foodbasics_flyer(driver, flyers_data):
    """
    Scrapes the Food Basics weekly flyer, limited to the first 20 pages or until there are no more items.

    Args:
        driver: The Selenium WebDriver instance.
        flyers_data: A list to append the scraped product dictionaries to.
    """
    logging.info("Starting Food Basics flyer scraping...")

    base_url = "https://www.foodbasics.ca/search"
    page = 1
    max_pages = 20  # Set the maximum number of pages to scrape

    while page <= max_pages:
        # Construct paginated URL
        if page == 1:
            url = base_url + "?sortOrder=relevance&filter=%3Arelevance%3Adeal%3AFlyer+%26+Deals&fromEcomFlyer=true"
        else:
            url = f"{base_url}-page-{page}?sortOrder=relevance&filter=%3Arelevance%3Adeal%3AFlyer+%26+Deals&fromEcomFlyer=true"

        logging.info(f"Scraping Food Basics page {page}: {url}")
        try:
            driver.get(url)
            time.sleep(2)
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            product_tiles = soup.select('.tile-product')

            # Stop when there are no more product tiles
            if not product_tiles:
                logging.info(f"No products found on page {page}. Ending pagination.")
                break

            for tile in product_tiles:
                try:
                    name_element = tile.select_one('.head__title')
                    name = name_element.get_text(strip=True) if name_element else "N/A"

                    amount_element = tile.select_one('.head__unit-details')
                    amount = amount_element.get_text(strip=True) if amount_element else "N/A"
                    if amount != "N/A":
                        amount = amount.replace(" un", " each")

                    current_price_element = tile.select_one('.pi-price-promo')
                    current_price = current_price_element.get_text(strip=True) if current_price_element else "N/A"

                    original_price = "N/A"
                    unit = "N/A"
                    before_price_element = tile.select_one('.pricing__before-price')
                    if before_price_element:
                        price_span = before_price_element.find('span', string=lambda text: text and '$' in text)
                        if price_span:
                            original_price = price_span.get_text(strip=True)
                        unit_abbr = before_price_element.find('abbr')
                        if unit_abbr:
                            unit = f'/{unit_abbr.get_text(strip=True)}'

                    image_url = "N/A"
                    source_element = tile.select_one('picture source')
                    if source_element and 'srcset' in source_element.attrs:
                        image_url = source_element['srcset'].split(',')[0].strip().split(' ')[0]
                    else:
                        img_element = tile.select_one('img')
                        if img_element and 'src' in img_element.attrs:
                            image_url = img_element['src']

                    if name != "N/A" and current_price != "N/A":
                        flyers_data.append({
                            "store": "Food Basics",
                            "name": name,
                            "price": current_price,
                            "amount": amount,
                            "unit": unit,
                            "original_price": original_price,
                            "image_url": image_url
                        })

                except Exception as e:
                    logging.warning(f"Failed to parse a product tile: {e}")
                    continue

        except TimeoutException:
            logging.error("Timeout while loading Food Basics page.")
            break
        except WebDriverException as e:
            logging.error(f"WebDriver error: {e}")
            break
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            break

        page += 1  # Move to the next page

    logging.info(f"Scraping complete. Total items found: {len(flyers_data)}")