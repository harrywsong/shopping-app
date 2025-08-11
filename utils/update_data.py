import json
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from contextlib import contextmanager
import os
from webdriver_manager.chrome import ChromeDriverManager
from stores.galleria_scraper import scrape_galleria_flyer
from stores.foodbasics_scraper import scrape_foodbasics_flyer
from stores.tnt_scraper import scrape_tnt_flyer
from stores.nofrills_scraper import scrape_nofrills_flyer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATA_FOLDER = 'data'
os.makedirs(DATA_FOLDER, exist_ok=True)


@contextmanager
def get_driver():
    """
    Provides a WebDriver instance with a clean setup and teardown.
    """
    driver = None
    try:
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        yield driver
    finally:
        if driver:
            driver.quit()


def update_data():
    """
    Runs all scrapers sequentially using a single WebDriver instance and saves data to a JSON file.
    """
    logging.info("Starting data collection...")
    all_flyers_data = {
        "galleria": [],
        "tnt_supermarket": [],
        "foodbasics": [],
        "nofrills": []
    }

    with get_driver() as driver:
        # Galleria Scraper
        try:
            logging.info("Attempting to fetch Galleria flyer data...")
            scrape_galleria_flyer(driver, all_flyers_data["galleria"])
        except Exception as e:
            logging.error(f"Error scraping Galleria: {e}")

        # # Food Basics Scraper
        # try:
        #     logging.info("Attempting to fetch Foodbasics flyer data...")
        #     scrape_foodbasics_flyer(driver, all_flyers_data["foodbasics"])
        # except Exception as e:
        #     logging.error(f"Error scraping Foodbasics: {e}")
        #
        # # T&T Supermarket Scraper
        # try:
        #     logging.info("Attempting to fetch Tnt Supermarket flyer data...")
        #     scrape_tnt_flyer(driver, all_flyers_data["tnt_supermarket"])
        # except Exception as e:
        #     logging.error(f"Error scraping Tnt Supermarket: {e}")

        # No Frills Scraper
        try:
            logging.info("Attempting to fetch No Frills flyer data...")
            scrape_nofrills_flyer(driver, all_flyers_data["nofrills"])
        except Exception as e:
            logging.error(f"Error scraping No Frills: {e}")

    try:
        file_path = os.path.join(DATA_FOLDER, 'flyers.json')
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(all_flyers_data, f, ensure_ascii=False, indent=2)
        logging.info("Data collection complete. flyers.json has been updated.")
    except Exception as e:
        logging.error(f"Error writing to {file_path}: {e}")

if __name__ == '__main__':
    update_data()