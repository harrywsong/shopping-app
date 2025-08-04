# E:\codingprojects\shopping\utils\update_data.py
import json
import logging
import threading
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from contextlib import contextmanager
import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup
import os

# Assuming these scraper functions exist and take a driver object and a data list
# as arguments to append results.
from stores.galleria_scraper import scrape_galleria_flyer
from stores.foodbasics_scraper import scrape_foodbasics_flyer
from stores.tnt_scraper import scrape_tnt_flyer
# from stores.hmart_scraper import scrape_hmart_flyer
from stores.nofrills_scraper import scrape_nofrills_flyer

logging.basicConfig(level=logging.INFO)

# Create a lock to prevent concurrent scraping
scraper_lock = threading.Lock()

@contextmanager
def get_driver():
    """Provides a WebDriver instance with a clean setup and teardown."""
    try:
        service = Service(ChromeDriverManager().install())
        options = webdriver.ChromeOptions()
        # options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        driver = webdriver.Chrome(service=service, options=options)
        yield driver
    finally:
        if 'driver' in locals() and driver:
            driver.quit()


def update_data():
    """
    Main function to run all scrapers and update the data file.
    The function handles scraper calls with a shared WebDriver instance and
    gracefully handles errors from individual scrapers.
    """
    with scraper_lock:
        logging.info("Starting data collection...")
        all_flyers_data = {
            "galleria": [],
            "tnt_supermarket": [],
            "foodbasics": [],
            "nofrills": []
        }

        scrapers = [
            ("galleria", scrape_galleria_flyer, "https://www.galleriasm.com/Home/prodview/dy9MFsYpCkOidpzOUKlHww"),
            ("foodbasics", scrape_foodbasics_flyer, "https://www.foodbasics.ca/search?sortOrder=relevance&filter=%3Arelevance%3Adeal%3AFlyer+%26+Deals&fromEcomFlyer=true"),
            ("tnt_supermarket", scrape_tnt_flyer, "https://www.tntsupermarket.com/eng/weekly-special-er.html"),
            #walmart
            ("nofrills", scrape_nofrills_flyer, "https://www.nofrills.ca/en/deals/flyer?page=1")
        ]

        with get_driver() as driver:
            for store_name, scraper_function, url in scrapers:
                try:
                    logging.info(f"Attempting to fetch {store_name.replace('_', ' ').title()} flyer data from {url}...")
                    scraper_function(driver, all_flyers_data[store_name])
                    logging.info(f"{store_name.replace('_', ' ').title()} data scraped successfully.")
                except Exception as e:
                    logging.error(f"Error scraping {store_name.replace('_', ' ').title()}: {e}")

        try:
            # Create the 'data' directory if it doesn't exist
            os.makedirs('data', exist_ok=True)
            # Construct the full path to the flyers.json file
            file_path = os.path.join('data', 'flyers.json')

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(all_flyers_data, f, ensure_ascii=False, indent=2)
            logging.info("Data collection complete. flyers.json has been updated.")
        except Exception as e:
            logging.error(f"Error writing to {file_path}: {e}")


if __name__ == '__main__':
    update_data()
