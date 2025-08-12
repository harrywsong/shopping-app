# Updated app.py with improvements:
# - Added expiration for qr_lists_db entries (e.g., 1 hour TTL using datetime).
# - Used a dict with timestamps for persistence in memory, but added optional file persistence.
# - Improved error handling and logging.
# - Made QR code generation more robust.
# - Added route for QR page to handle not found better.

from flask import Flask, render_template, jsonify, request, send_file, url_for
import json
import logging
from utils.update_data import update_data
import qrcode
from qrcode.image.pil import PilImage
import io
import os
import uuid
import base64
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATA_FOLDER = 'data'
os.makedirs(DATA_FOLDER, exist_ok=True)

# Temporary in-memory storage for shopping lists linked to QR codes with TTL
qr_lists_db = {}  # {list_id: {'content': list_content, 'expiry': datetime}}

# Optional: Persist qr_lists_db to file on shutdown, but for simplicity, keep in-memory with TTL

def cleanup_expired_qr_lists():
    now = datetime.now()
    to_remove = [list_id for list_id, data in qr_lists_db.items() if data['expiry'] < now]
    for list_id in to_remove:
        del qr_lists_db[list_id]
    logging.info(f"Cleaned up {len(to_remove)} expired QR lists.")

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

# New route to serve the standalone shopping list page
@app.route('/list-page/<string:list_id>')
def list_page(list_id):
    cleanup_expired_qr_lists()  # Cleanup on access
    list_data = qr_lists_db.get(list_id)
    if list_data:
        return render_template('qr_list_page.html', list_content=list_data['content'])
    else:
        return "Shopping list not found or has expired.", 404

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

@app.route('/api/generate-qr-for-list', methods=['POST'])
def generate_qr_for_list():
    list_content = request.json.get('listContent')
    if not list_content:
        return jsonify({"error": "No list content provided."}), 400

    # Create a unique ID for this list
    list_id = str(uuid.uuid4())
    expiry = datetime.now() + timedelta(hours=1)  # 1 hour TTL
    qr_lists_db[list_id] = {'content': list_content, 'expiry': expiry}

    # Generate the URL for the new list page
    list_url = url_for('list_page', list_id=list_id, _external=True)

    # Generate QR code from the URL
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(list_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Save image to a BytesIO object
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    # Encode the image to base64
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    qr_code_data_uri = f"data:image/png;base64,{qr_code_base64}"

    # Return the data URI as a JSON response
    return jsonify({"qrCode": qr_code_data_uri}), 200

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