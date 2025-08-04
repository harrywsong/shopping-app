# E:\codingprojects\shopping\stores\tnt_scraper.py
import requests
import json
import logging
import re
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def scrape_tnt_flyer(driver, flyers_data):
    """
    Scrapes the T&T Supermarket flyer items by using the provided Selenium driver.
    It waits for dynamic content to load, scrolls down to load all items, and
    appends the scraped data to the provided list.
    """
    try:
        logging.info("Step 1: Attempting to bypass bot detection and fetch page content...")
        url = "https://www.tntsupermarket.com/eng/weekly-special-er.html"
        driver.get(url)

        # Use WebDriverWait to wait for the product grid to be present
        wait = WebDriverWait(driver, 30)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.category-grid-44X')))

        # Scroll to load dynamic content until all items are loaded or we have at least 200 items.
        last_height = driver.execute_script("return document.body.scrollHeight")
        while True:
            # Scroll down to the bottom
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)  # Wait for new content to load

            # Check if all content has been loaded
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height

            # Final parse after scrolling is complete
            page_source = driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            products = soup.select('div.item-root-NyK')

            if not products:
                logging.warning("No product data found on the page.")
                return

        for product in products:
            try:
                # Extract product name
                item_name_tag = product.select_one('a.item-name-suo span')
                item_name = item_name_tag.get_text(strip=True) if item_name_tag else 'N/A'

                price_box = product.select_one('div.item-priceBox-ObD')
                unit = 'N/A'
                new_price = 'N/A'
                original_price = 'N/A'

                if price_box:
                    # Find the unit first from the entire price box
                    unit_element = price_box.find(
                        lambda tag: tag.has_attr('class') and any('item-weightUom-' in c for c in tag['class']))
                    if unit_element:
                        unit = f"/{unit_element.get_text(strip=True).lower().lstrip('/')}"

                    # Extract new price
                    new_price_element = price_box.select_one('div[class^="item-hasPrice-"]')
                    if new_price_element:
                        # Concatenate all span text that is not the unit
                        new_price_spans = new_price_element.find_all('span')
                        new_price = "".join([span.get_text(strip=True) for span in new_price_spans if
                                             not any('item-weightUom-' in c for c in span.get('class', []))])

                    # Extract original price
                    original_price_element = price_box.select_one('div[class^="item-wasPrice-"]')
                    if original_price_element:
                        # Concatenate all span text that is not the unit
                        original_price_spans = original_price_element.find_all('span')
                        original_price = "".join([span.get_text(strip=True) for span in original_price_spans if
                                                  not any('item-weightUom-' in c for c in span.get('class', []))])

                # Extract image URL
                image_tag = product.select_one('a.item-images-Or3 img')
                image_url = image_tag.get('src') if image_tag else 'N/A'

                if item_name and new_price != 'N/A':
                    flyers_data.append({
                        "name": item_name,  # Corrected key from 'item' to 'name'
                        "price": new_price,
                        "unit": unit,
                        "original_price": original_price,
                        "image_url": image_url,
                        "store": "tnt_supermarket"
                    })
            except Exception as e:
                logging.warning(f"Failed to parse a T&T product item: {e}")
                continue

    except Exception as e:
        logging.error(f"An unexpected error occurred during T&T scraping: {e}")
        return

    logging.info(f"T&T Supermarket scraping complete. Found {len(flyers_data)} items.")


if __name__ == '__main__':
    # This block is for testing the scraper file on its own if needed.
    # It creates a dummy driver and a list to simulate the `update_data.py` call.
    def test_scraper():
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        service = Service(ChromeDriverManager().install())
        test_driver = webdriver.Chrome(service=service, options=options)
        test_data = []
        try:
            scrape_tnt_flyer(test_driver, test_data)
        finally:
            test_driver.quit()
        if test_data:
            print("T&T Flyer data scraped successfully:")
            print(json.dumps(test_data, indent=2))
        else:
            print("Failed to scrape T&T flyer data.")


    test_scraper()