# E:\codingprojects\shopping\app.py
from flask import Flask, render_template, jsonify, request, send_file, send_from_directory
import json
import logging
from utils.update_data import update_data
import threading
import time
import qrcode
import io
import os
import socket

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATA_FOLDER = 'data'


def load_flyer_data():
    try:
        with open(os.path.join(DATA_FOLDER, 'flyers.json'), 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error("flyers.json not found. Returning empty data.")
        return []


def save_shopping_list(shopping_list):
    with open(os.path.join(DATA_FOLDER, 'shopping_list.json'), 'w', encoding='utf-8') as f:
        json.dump(shopping_list, f, indent=2)


def load_shopping_list():
    try:
        with open(os.path.join(DATA_FOLDER, 'shopping_list.json'), 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.info("shopping_list.json not found. Starting with an empty list.")
        return []


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/flyers')
def get_flyers():
    flyers_data = load_flyer_data()
    return jsonify(flyers_data)


@app.route('/api/shopping-list', methods=['GET', 'POST', 'DELETE'])
def manage_shopping_list():
    shopping_list = load_shopping_list()

    if request.method == 'GET':
        return jsonify(shopping_list)

    elif request.method == 'POST':
        item = request.json
        if not item or 'name' not in item or 'store' not in item:
            logging.error(f"Invalid item data received: {item}. Missing 'name' or 'store' key.")
            return jsonify({"error": "Invalid item data, 'name' and 'store' keys are required"}), 400

        logging.info(f"Received item to add from store '{item.get('store')}': {item.get('name')}")

        found = False
        for i in range(len(shopping_list)):
            # Check for a match on both name and store to prevent adding the same item multiple times from different stores
            if shopping_list[i]['name'] == item['name'] and shopping_list[i].get('store') == item.get('store'):
                shopping_list[i]['quantity'] += 1
                found = True
                break
        if not found:
            item['quantity'] = 1
            shopping_list.append(item)

        save_shopping_list(shopping_list)
        return jsonify(shopping_list), 201

    elif request.method == 'DELETE':
        item = request.json
        if not item or 'name' not in item:
            return jsonify({"error": "Invalid item data, 'name' key is missing"}), 400

        shopping_list = [i for i in shopping_list if i['name'] != item['name']]
        save_shopping_list(shopping_list)
        return jsonify(shopping_list), 200


@app.route('/api/update-data', methods=['POST'])
def update_data_endpoint():
    logging.info("Manual data update triggered via API.")
    update_data()
    logging.info("Manual data update complete.")
    return jsonify({"message": "Data update started."}), 200


@app.route('/data/<filename>')
def serve_data_file(filename):
    return send_from_directory(DATA_FOLDER, filename)


@app.route('/qr/<target>')
def generate_qr_for_data(target):
    if target not in ['flyers', 'shopping']:
        return "Invalid target", 400

    filename = 'flyers.json' if target == 'flyers' else 'shopping_list.json'
    full_url = request.host_url.rstrip('/') + f"/data/{filename}"

    img = qrcode.make(full_url)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png')


@app.route('/qr/embed/<filename>')
def generate_qr_with_content(filename):
    if filename not in ['flyers.json', 'shopping_list.json']:
        return "Invalid file", 400

    try:
        with open(os.path.join(DATA_FOLDER, filename), 'r', encoding='utf-8') as f:
            data = f.read()
    except FileNotFoundError:
        return "File not found", 404

    if len(data) > 1000:
        return "Content too large for QR code", 400

    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png')


@app.route('/api/shopping-list-text')
def generate_shopping_list_text():
    """Generates the shopping list as a plain text file, grouped by store."""
    try:
        with open("data/shopping_list.json", "r", encoding="utf-8") as f:
            shopping_list_data = json.load(f)

        # Group items by store
        grouped_items = {}
        for item in shopping_list_data:
            # --- START OF FIX ---
            # Ensure the store key is always lowercase for consistent grouping and mapping
            store_key = item.get('store', 'unknown').lower()
            if store_key not in grouped_items:
                grouped_items[store_key] = []
            grouped_items[store_key].append(item)
            # --- END OF FIX ---

        formatted_list_parts = []

        # Order the stores for consistent output
        store_order = ["galleria", "tnt_supermarket", "foodbasics", "nofrills", "unknown"]
        # Create a mapping for consistent store name display
        store_name_mapping = {
            "nofrills": "No Frills",
            "tnt_supermarket": "T&T Supermarket",
            "galleria": "Galleria",
            "foodbasics": "Food Basics",
            "unknown": "Other"
        }

        for store_key in store_order:
            if store_key in grouped_items:
                items = grouped_items[store_key]

                # Format the store name for display using the new mapping
                store_name = store_name_mapping.get(store_key, store_key.replace('_', ' ').title())

                formatted_list_parts.append(f"{store_name}")

                for item in items:
                    item_name = item.get('name') or item.get('item', 'Unknown Item')
                    quantity = item.get('quantity', 1)
                    price = item.get('price', 'N/A')
                    original_price = item.get('original_price', 'N/A')
                    unit = item.get('unit', '')

                    price_info = f"{price} {unit}" if price != 'N/A' else 'N/A'
                    original_price_info = f" (Original: {original_price} {unit})" if original_price and original_price != 'N/A' else ''

                    list_item_string = f"- {quantity}x {item_name} - {price_info}{original_price_info}"
                    formatted_list_parts.append(list_item_string)

                formatted_list_parts.append("")  # Add a blank line between stores

        formatted_list_string = "\n".join(formatted_list_parts).strip()
        return formatted_list_string, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    except Exception as e:
        print(f"Error generating text file: {e}")
        return "Could not generate shopping list text", 500


@app.route('/generate_qr')
def generate_qr():
    """Generates a QR code that encodes the URL to the pure text shopping list."""
    try:
        # Construct the URL for the plain text shopping list
        full_url = request.host_url.rstrip('/') + "/api/shopping-list-text"

        # Generate QR code image from the URL
        img = qrcode.make(full_url)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return send_file(buf, mimetype='image/png')
    except Exception as e:
        print(f"Error generating QR: {e}")
        return "Could not generate QR code", 500


if __name__ == '__main__':
    os.makedirs(DATA_FOLDER, exist_ok=True)  # Ensure data folder exists
    app.run(host='0.0.0.0', port=1972)
