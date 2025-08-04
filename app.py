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
        if not item or 'name' not in item:
            return jsonify({"error": "Invalid item data, 'name' key is missing"}), 400

        found = False
        for i in range(len(shopping_list)):
            if shopping_list[i]['name'] == item['name']:
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
    """Generates the shopping list as a plain text file."""
    try:
        with open("data/shopping_list.json", "r", encoding="utf-8") as f:
            shopping_list_data = json.load(f)

        list_items = [f"- {item['quantity']}x {item['name']}" for item in shopping_list_data]
        formatted_list_string = "\n".join(list_items)
        return formatted_list_string, 200, {'Content-Type': 'text/plain; charset=utf-8'}

    except Exception as e:
        print(f"Error generating text file: {e}")
        return "Could not generate shopping list text", 500


@app.route('/generate_qr')
def generate_qr():
    """Generates a QR code that encodes the pure text shopping list."""
    try:
        # Load and format the shopping list data
        with open("data/shopping_list.json", "r", encoding="utf-8") as f:
            shopping_list_data = json.load(f)

        list_items = [f"- {item['quantity']}x {item['name']}" for item in shopping_list_data]
        formatted_list_string = "\n".join(list_items)

        # Generate QR code image from the formatted list string
        img = qrcode.make(formatted_list_string)
        img_path = "static/temp/shopping_list_qr.png"
        os.makedirs(os.path.dirname(img_path), exist_ok=True)
        img.save(img_path)

        return jsonify({"qr_url": "/static/temp/shopping_list_qr.png"})
    except Exception as e:
        print(f"Error generating QR: {e}")
        return jsonify({"error": "Could not generate QR code"}), 500


if __name__ == '__main__':
    os.makedirs(DATA_FOLDER, exist_ok=True)  # Ensure data folder exists
    app.run(host='0.0.0.0', port=1972)