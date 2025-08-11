# E:\codingprojects\shopping\app.py
from flask import Flask, render_template, jsonify, request, send_file
import json
import logging
from utils.update_data import update_data
import qrcode
from qrcode.image.pil import PilImage
import io
import os
import uuid

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATA_FOLDER = 'data'
os.makedirs(DATA_FOLDER, exist_ok=True)


def load_flyer_data():
    try:
        with open(os.path.join(DATA_FOLDER, 'flyers.json'), 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logging.info("flyers.json not found or is empty/corrupted. Initializing with empty data.")
        return {}


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
    search_query = request.args.get('search', '').lower()

    if search_query:
        filtered_data = {
            "galleria": [],
            "tnt_supermarket": [],
            "foodbasics": [],
            "nofrills": []
        }
        for store, items in flyers_data.items():
            for item in items:
                if search_query in item.get('name', '').lower():
                    filtered_data[store].append(item)
        return jsonify(filtered_data)
    return jsonify(flyers_data)


@app.route('/api/shopping-list', methods=['GET', 'POST', 'DELETE'])
def manage_shopping_list():
    shopping_list = load_shopping_list()

    if request.method == 'POST':
        # The front-end sends the entire updated shopping list as a list of dictionaries.
        new_shopping_list = request.get_json(silent=True)
        if isinstance(new_shopping_list, list):
            save_shopping_list(new_shopping_list)
            return jsonify(new_shopping_list), 200
        else:
            logging.error("Invalid data format for POST. Expected a list.")
            return jsonify({"error": "Invalid data format. Expected a list."}), 400

    elif request.method == 'DELETE':
        item_id_to_delete = request.json.get('id')

        if not item_id_to_delete:
            return jsonify({"error": "Item ID not provided for deletion."}), 400

        original_list_length = len(shopping_list)
        shopping_list = [item for item in shopping_list if item.get('id') != item_id_to_delete]

        if len(shopping_list) < original_list_length:
            save_shopping_list(shopping_list)
            return jsonify({"message": "Item removed successfully."}), 200
        else:
            return jsonify({"error": "Item not found."}), 404

    return jsonify(shopping_list)


@app.route('/api/shopping-list/clear', methods=['POST'])
def clear_shopping_list():
    save_shopping_list([])
    return jsonify({"message": "Shopping list cleared."}), 200


@app.route('/api/shopping-list/send', methods=['POST'])
def send_shopping_list():
    shopping_list = load_shopping_list()
    if not shopping_list:
        return jsonify({"error": "Shopping list is empty."}), 400

    list_text = "My Shopping List:\n"
    for item in shopping_list:
        item_name = item.get('name', 'N/A')
        item_store = item.get('store', 'N/A').replace('_', ' ').title()
        item_price = item.get('price', 'N/A')
        item_quantity = item.get('quantity', 1)
        item_original_price = item.get('original_price', 'N/A')

        price_info = f"({item_price} x {item_quantity})"
        if item_original_price and item_original_price != 'N/A':
            price_info = f"({item_price} on sale, was {item_original_price} x {item_quantity})"

        list_text += f"- {item_name} from {item_store} {price_info}\n"

    qr_code_image = qrcode.make(list_text, image_factory=PilImage)

    img_path = os.path.join('static', 'temp_qr', f'{uuid.uuid4()}.png')
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    qr_code_image.save(img_path)

    return send_file(img_path, mimetype='image/png')


@app.route('/api/update-data', methods=['POST'])
def update_data_endpoint():
    try:
        update_data()
        return jsonify({"message": "Data update initiated successfully."}), 200
    except Exception as e:
        logging.error(f"Error during manual data update: {e}")
        return jsonify({"message": f"Error updating data: {e}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=1972)