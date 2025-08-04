# E:\codingprojects\shopping\stores\galleria_scraper.py

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import logging
import time
import re

logging.basicConfig(level=logging.INFO)


def scrape_galleria_flyer(driver, flyers_data):
    """
    Scrapes the Galleria Online Mall website for weekly flyer specials.
    This version uses the provided driver instance and appends
    product information to a shared list.

    Args:
        driver: A Selenium WebDriver instance.
        flyers_data: A list to which the scraped flyer items will be appended.
    """
    logging.info("Attempting to fetch Galleria flyer data...")
    url = "https://www.galleriasm.com/Home/prodview/dy9MFsYpCkOidpzOUKlHww"

    try:
        driver.get(url)

        # The page seems to load dynamically, so we wait for some content to appear.
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".item"))
        )

        # Add a short delay to ensure all dynamically loaded content is rendered
        time.sleep(2)

        soup = BeautifulSoup(driver.page_source, 'html.parser')

        # Locate all product containers using the correct selector from the HTML file
        product_items = soup.find_all('div', class_='item')

        if not product_items:
            logging.warning("No product items found with the specified selector. The page structure may have changed.")
            return

        for item in product_items:
            try:
                # The title is in an anchor tag inside a div with class "item-title"
                name_element = item.find('div', class_='item-title')
                name = name_element.a.get_text(strip=True) if name_element and name_element.a else 'N/A'

                # The image URL is in the style attribute of the anchor tag with class "product-image"
                image_element = item.find('a', class_='product-image')
                image_url = 'N/A'
                if image_element and 'style' in image_element.attrs:
                    style_attr = image_element['style']
                    # Use a regex to extract the URL from the background-image property
                    match = re.search(r"url\('?([^'\)]+)'?\)", style_attr)
                    if match:
                        image_url = match.group(1)

                # Prices are inside a div with class "item-price"
                price_box = item.find('div', class_='price-box')
                old_price = 'N/A'
                new_price = 'N/A'
                unit = 'N/A'

                if price_box:
                    # Find all spans with class 'price' within the price box
                    all_prices_spans = price_box.find_all('span', class_='price')

                    if len(all_prices_spans) > 1:
                        # If there are multiple prices, the first is the original and the last is the sale price.
                        old_price = all_prices_spans[0].get_text(strip=True)
                        new_price = all_prices_spans[-1].get_text(strip=True)
                    elif len(all_prices_spans) == 1:
                        # If there's only one price, it's the current price.
                        new_price = all_prices_spans[0].get_text(strip=True)

                    # Find the unit in the <small> tag
                    unit_element = price_box.find('small')
                    if unit_element:
                        unit = f"/{unit_element.get_text(strip=True).lower()}"

                if name and new_price != 'N/A':
                    flyers_data.append({
                        'store': 'Galleria',
                        'name': name,
                        'price': new_price,
                        'unit': unit,
                        'original_price': old_price,
                        'image_url': f"https://www.galleriasm.com{image_url}",
                    })
            except Exception as e:
                logging.warning(f"Failed to parse a Galleria product item: {e}")
                continue

    except Exception as e:
        logging.error(f"An error occurred while scraping Galleria: {e}")
        return

    logging.info(f"Galleria scraping complete. Found {len(flyers_data)} items.")