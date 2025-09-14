# Enhanced app.py with filtering, last updated tracking, and quality of life improvements

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


def get_last_updated():
    """Get the last modified time of the flyers.json file"""
    try:
        file_path = os.path.join(DATA_FOLDER, 'flyers.json')
        if os.path.exists(file_path):
            timestamp = os.path.getmtime(file_path)
            return datetime.fromtimestamp(timestamp)
    except Exception as e:
        logging.error(f"Error getting last updated time: {e}")
    return None


def calculate_savings_percentage(original_price, sale_price):
    """Calculate savings percentage between original and sale price"""
    try:
        # Extract numeric values from price strings
        original = float(''.join(filter(lambda x: x.isdigit() or x == '.', str(original_price))))
        sale = float(''.join(filter(lambda x: x.isdigit() or x == '.', str(sale_price))))

        if original > 0 and sale < original:
            return round(((original - sale) / original) * 100, 1)
    except (ValueError, TypeError):
        pass
    return 0


def enhance_flyer_data(flyers_data):
    """Add computed fields to flyer data for filtering"""
    enhanced_data = {}

    for store, items in flyers_data.items():
        enhanced_items = []
        for item in items:
            enhanced_item = item.copy()

            # Determine if item is on sale
            has_original = item.get('original_price') and item.get('original_price') != 'N/A'
            has_sale = item.get('price') and item.get('price') != 'N/A'
            enhanced_item['on_sale'] = has_original and has_sale and item['original_price'] != item['price']

            # Calculate savings percentage
            if enhanced_item['on_sale']:
                enhanced_item['savings_percentage'] = calculate_savings_percentage(
                    item.get('original_price'), item.get('price')
                )
            else:
                enhanced_item['savings_percentage'] = 0

            # Extract numeric price for range filtering
            try:
                price_str = item.get('price', '0')
                if price_str and price_str != 'N/A':
                    enhanced_item['numeric_price'] = float(
                        ''.join(filter(lambda x: x.isdigit() or x == '.', str(price_str))))
                else:
                    enhanced_item['numeric_price'] = 0
            except (ValueError, TypeError):
                enhanced_item['numeric_price'] = 0

            enhanced_items.append(enhanced_item)

        enhanced_data[store] = enhanced_items

    return enhanced_data


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
    cleanup_expired_qr_lists()
    list_data = qr_lists_db.get(list_id)
    if list_data:
        return render_template('qr_list_page.html', list_content=list_data['content'])
    else:
        return "Shopping list not found or has expired.", 404


@app.route('/api/flyers')
def get_flyers():
    flyers_data = load_flyer_data()
    enhanced_data = enhance_flyer_data(flyers_data)

    # Get filter parameters
    search_query = request.args.get('search', '').lower()
    sale_filter = request.args.get('sale_filter', 'all')  # all, on_sale, not_on_sale
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    min_savings = request.args.get('min_savings', type=float, default=0)
    sort_by = request.args.get('sort_by', 'name')  # name, price, savings
    sort_order = request.args.get('sort_order', 'asc')  # asc, desc

    filtered_data = {
        "galleria": [],
        "tnt_supermarket": [],
        "foodbasics": [],
        "nofrills": []
    }

    for store, items in enhanced_data.items():
        filtered_items = []

        for item in items:
            # Apply filters
            if search_query and search_query not in item.get('name', '').lower():
                continue

            if sale_filter == 'on_sale' and not item.get('on_sale'):
                continue
            elif sale_filter == 'not_on_sale' and item.get('on_sale'):
                continue

            if min_price is not None and item.get('numeric_price', 0) < min_price:
                continue

            if max_price is not None and item.get('numeric_price', 0) > max_price:
                continue

            if item.get('savings_percentage', 0) < min_savings:
                continue

            filtered_items.append(item)

        # Apply sorting
        if sort_by == 'price':
            filtered_items.sort(key=lambda x: x.get('numeric_price', 0), reverse=(sort_order == 'desc'))
        elif sort_by == 'savings':
            filtered_items.sort(key=lambda x: x.get('savings_percentage', 0), reverse=(sort_order == 'desc'))
        else:  # sort by name
            filtered_items.sort(key=lambda x: x.get('name', '').lower(), reverse=(sort_order == 'desc'))

        filtered_data[store] = filtered_items

    return jsonify(filtered_data)


@app.route('/api/last-updated')
def get_last_updated():
    """Return the last updated timestamp"""
    last_updated = get_last_updated()
    if last_updated:
        return jsonify({
            'last_updated': last_updated.isoformat(),
            'human_readable': last_updated.strftime('%Y-%m-%d %I:%M %p')
        })
    return jsonify({'last_updated': None, 'human_readable': 'Never'})


@app.route('/api/statistics')
def get_statistics():
    """Return statistics about the current flyer data"""
    flyers_data = load_flyer_data()
    enhanced_data = enhance_flyer_data(flyers_data)

    stats = {
        'total_items': 0,
        'items_on_sale': 0,
        'average_savings': 0,
        'stores': {},
        'price_ranges': {
            'under_5': 0,
            '5_to_10': 0,
            '10_to_20': 0,
            'over_20': 0
        }
    }

    total_savings = 0
    sale_items = 0

    for store, items in enhanced_data.items():
        store_stats = {
            'total': len(items),
            'on_sale': sum(1 for item in items if item.get('on_sale')),
            'avg_price': 0
        }

        total_price = 0
        valid_prices = 0

        for item in items:
            stats['total_items'] += 1

            if item.get('on_sale'):
                stats['items_on_sale'] += 1
                total_savings += item.get('savings_percentage', 0)
                sale_items += 1

            price = item.get('numeric_price', 0)
            if price > 0:
                total_price += price
                valid_prices += 1

                # Price range categorization
                if price < 5:
                    stats['price_ranges']['under_5'] += 1
                elif price < 10:
                    stats['price_ranges']['5_to_10'] += 1
                elif price < 20:
                    stats['price_ranges']['10_to_20'] += 1
                else:
                    stats['price_ranges']['over_20'] += 1

        if valid_prices > 0:
            store_stats['avg_price'] = round(total_price / valid_prices, 2)

        stats['stores'][store] = store_stats

    if sale_items > 0:
        stats['average_savings'] = round(total_savings / sale_items, 1)

    return jsonify(stats)


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