import os
import sqlite3
from flask import Flask, render_template, request, jsonify, redirect, url_for

app = Flask(__name__)
app.secret_key = 'smart-parking-secret-key'

DB_PATH = '/app/data/parking.db' if os.path.exists('/app/data') else 'data/parking.db'

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_name TEXT NOT NULL,
        vehicle_no TEXT NOT NULL,
        slot_number TEXT NOT NULL,
        duration_hours INTEGER NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'Booked',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()

init_db()

SLOTS = [
    {'id': 'A1', 'type': 'Car - VIP', 'price': 100, 'status': 'Available'},
    {'id': 'A2', 'type': 'Car - Standard', 'price': 50, 'status': 'Available'},
    {'id': 'A3', 'type': 'Car - Standard', 'price': 50, 'status': 'Available'},
    {'id': 'B1', 'type': 'EV Charging Slot', 'price': 80, 'status': 'Available'},
    {'id': 'B2', 'type': 'Bike Parking', 'price': 30, 'status': 'Available'},
    {'id': 'B3', 'type': 'Bike Parking', 'price': 30, 'status': 'Available'}
]

@app.route('/')
def home():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT slot_number FROM bookings WHERE status='Booked'")
    booked_slots = [row['slot_number'] for row in cursor.fetchall()]
    conn.close()

    available_slots = []
    for slot in SLOTS:
        slot_copy = slot.copy()
        if slot_copy['id'] in booked_slots:
            slot_copy['status'] = 'Occupied'
        available_slots.append(slot_copy)

    return render_template('index.html', slots=available_slots)

@app.route('/book_slot', methods=['POST'])
def book_slot():
    data = request.get_json()
    driver_name = data.get('driver_name', 'Guest Driver')
    vehicle_no = data.get('vehicle_no', 'TN-00-XX-0000')
    slot_number = data.get('slot_number')
    duration = int(data.get('duration', 1))

    slot_info = next((s for s in SLOTS if s['id'] == slot_number), None)
    if not slot_info:
        return jsonify({'success': False, 'message': 'Invalid Slot'}), 400

    total_price = slot_info['price'] * duration

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''INSERT INTO bookings (driver_name, vehicle_no, slot_number, duration_hours, total_price)
                      VALUES (?, ?, ?, ?, ?)''', (driver_name, vehicle_no, slot_number, duration, total_price))
    conn.commit()
    booking_id = cursor.lastrowid
    conn.close()

    return jsonify({
        'success': True,
        'booking_id': booking_id,
        'slot_number': slot_number,
        'total_price': total_price
    })

@app.route('/admin')
def admin():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings ORDER BY id DESC")
    bookings = cursor.fetchall()
    conn.close()
    return render_template('admin.html', bookings=bookings)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
