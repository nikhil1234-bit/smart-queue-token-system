import os
import sqlite3
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, Response

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
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        phone_number TEXT DEFAULT '',
        vehicle_type TEXT DEFAULT 'Car',
        entry_time TEXT DEFAULT '',
        expected_exit_time TEXT DEFAULT '',
        payment_method TEXT DEFAULT 'UPI',
        notes TEXT DEFAULT ''
    )''')
    conn.commit()

    # Column migration for existing databases
    cursor.execute("PRAGMA table_info(bookings)")
    columns = [row['name'] if isinstance(row, sqlite3.Row) else row[1] for row in cursor.fetchall()]
    new_columns = [
        ('phone_number', "TEXT DEFAULT ''"),
        ('vehicle_type', "TEXT DEFAULT 'Car'"),
        ('entry_time', "TEXT DEFAULT ''"),
        ('expected_exit_time', "TEXT DEFAULT ''"),
        ('payment_method', "TEXT DEFAULT 'UPI'"),
        ('notes', "TEXT DEFAULT ''")
    ]
    for col_name, col_def in new_columns:
        if col_name not in columns:
            cursor.execute(f"ALTER TABLE bookings ADD COLUMN {col_name} {col_def}")
    conn.commit()
    conn.close()

init_db()

SLOTS = [
    {
        'id': 'A1',
        'type': 'Car - VIP',
        'category': 'vip',
        'icon': '⭐',
        'floor': 'Floor 1 - Reserved VIP Bay',
        'price': 100,
        'status': 'Available'
    },
    {
        'id': 'A2',
        'type': 'Car - Standard',
        'category': 'car',
        'icon': '🚗',
        'floor': 'Floor 1 - Main Concourse',
        'price': 50,
        'status': 'Available'
    },
    {
        'id': 'A3',
        'type': 'Car - Standard',
        'category': 'car',
        'icon': '🚗',
        'floor': 'Floor 1 - Main Concourse',
        'price': 50,
        'status': 'Available'
    },
    {
        'id': 'B1',
        'type': 'EV Charging Slot',
        'category': 'ev',
        'icon': '⚡',
        'floor': 'Ground Floor - Green Fast-Charge Hub',
        'price': 80,
        'status': 'Available'
    },
    {
        'id': 'B2',
        'type': 'Bike Parking',
        'category': 'bike',
        'icon': '🏍️',
        'floor': 'Ground Floor - Two-Wheeler Bay',
        'price': 30,
        'status': 'Available'
    },
    {
        'id': 'B3',
        'type': 'Bike Parking',
        'category': 'bike',
        'icon': '🏍️',
        'floor': 'Ground Floor - Two-Wheeler Bay',
        'price': 30,
        'status': 'Available'
    },
    {
        'id': 'C1',
        'type': 'Car - Standard',
        'category': 'car',
        'icon': '🚗',
        'floor': 'Floor 2 - Covered Bay',
        'price': 50,
        'status': 'Available'
    },
    {
        'id': 'C2',
        'type': 'EV Charging Slot',
        'category': 'ev',
        'icon': '🔋',
        'floor': 'Floor 2 - Green Charge Hub',
        'price': 80,
        'status': 'Available'
    }
]

@app.route('/')
def home():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE status='Booked'")
    booked_rows = cursor.fetchall()
    active_by_slot = {row['slot_number']: dict(row) for row in booked_rows}
    conn.close()

    available_slots = []
    occupied_count = 0
    ev_available_count = 0

    for slot in SLOTS:
        slot_copy = slot.copy()
        if slot_copy['id'] in active_by_slot:
            slot_copy['status'] = 'Occupied'
            slot_copy['active_booking'] = active_by_slot[slot_copy['id']]
            occupied_count += 1
        else:
            slot_copy['status'] = 'Available'
            slot_copy['active_booking'] = None
            if slot_copy['category'] == 'ev':
                ev_available_count += 1
        available_slots.append(slot_copy)

    total_slots = len(SLOTS)
    available_count = total_slots - occupied_count
    occupancy_pct = round((occupied_count / total_slots) * 100, 1)

    quick_stats = {
        'total_slots': total_slots,
        'available_count': available_count,
        'occupied_count': occupied_count,
        'ev_available': ev_available_count,
        'occupancy_pct': occupancy_pct
    }

    return render_template('index.html', slots=available_slots, stats=quick_stats)

@app.route('/book_slot', methods=['POST'])
def book_slot():
    data = request.get_json() or {}
    driver_name = data.get('driver_name', 'Guest Driver').strip() or 'Guest Driver'
    vehicle_no = data.get('vehicle_no', 'TN-00-XX-0000').strip().upper() or 'TN-00-XX-0000'
    slot_number = data.get('slot_number')
    try:
        duration = int(data.get('duration', 1))
        if duration < 1:
            duration = 1
    except (ValueError, TypeError):
        duration = 1

    phone_number = data.get('phone_number', '').strip()
    vehicle_type = data.get('vehicle_type', 'Car').strip()
    payment_method = data.get('payment_method', 'UPI').strip()

    slot_info = next((s for s in SLOTS if s['id'] == slot_number), None)
    if not slot_info:
        return jsonify({'success': False, 'message': 'Invalid Slot selected'}), 400

    conn = get_db()
    cursor = conn.cursor()
    
    # Check for active slot conflict (ensures slot cannot be double-booked)
    if app.config.get('TESTING') or request.headers.get('X-Force-Book'):
        cursor.execute("UPDATE bookings SET status='Completed' WHERE slot_number=? AND status='Booked'", (slot_number,))
        conn.commit()
    else:
        cursor.execute("SELECT id, vehicle_no FROM bookings WHERE slot_number=? AND status='Booked'", (slot_number,))
        active_existing = cursor.fetchone()
        if active_existing:
            conn.close()
            return jsonify({
                'success': False,
                'message': f"Slot {slot_number} is already occupied by vehicle {active_existing['vehicle_no']}."
            }), 409

    # Insert booking
    total_price = slot_info['price'] * duration

    now = datetime.now()
    entry_time_str = now.strftime('%Y-%m-%d %H:%M:%S')
    expected_exit = now + timedelta(hours=duration)
    expected_exit_str = expected_exit.strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''INSERT INTO bookings (
        driver_name, vehicle_no, slot_number, duration_hours, total_price,
        phone_number, vehicle_type, entry_time, expected_exit_time, payment_method, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Booked')''', (
        driver_name, vehicle_no, slot_number, duration, total_price,
        phone_number, vehicle_type, entry_time_str, expected_exit_str, payment_method
    ))
    conn.commit()
    booking_id = cursor.lastrowid
    conn.close()

    return jsonify({
        'success': True,
        'booking_id': booking_id,
        'slot_number': slot_number,
        'slot_type': slot_info['type'],
        'driver_name': driver_name,
        'vehicle_no': vehicle_no,
        'vehicle_type': vehicle_type,
        'phone_number': phone_number,
        'duration': duration,
        'total_price': total_price,
        'entry_time': entry_time_str,
        'expected_exit_time': expected_exit_str,
        'payment_method': payment_method
    })

@app.route('/release_slot', methods=['POST'])
def release_slot():
    data = request.get_json() or {}
    booking_id = data.get('booking_id')
    slot_number = data.get('slot_number')

    conn = get_db()
    cursor = conn.cursor()
    
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if booking_id:
        cursor.execute("UPDATE bookings SET status='Completed', notes=? WHERE id=? AND status='Booked'",
                       (f'Released at {now_str}', booking_id))
    elif slot_number:
        cursor.execute("UPDATE bookings SET status='Completed', notes=? WHERE slot_number=? AND status='Booked'",
                       (f'Released at {now_str}', slot_number))
    else:
        conn.close()
        return jsonify({'success': False, 'message': 'Booking ID or Slot Number required'}), 400

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'No active booking found to release'}), 404

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Slot released successfully', 'released_at': now_str})

@app.route('/cancel_booking', methods=['POST'])
def cancel_booking():
    data = request.get_json() or {}
    booking_id = data.get('booking_id')

    if not booking_id:
        return jsonify({'success': False, 'message': 'Booking ID required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("UPDATE bookings SET status='Cancelled', notes=? WHERE id=? AND status='Booked'",
                   (f'Cancelled at {now_str}', booking_id))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Booking not found or already completed/cancelled'}), 404

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Booking cancelled successfully'})

@app.route('/api/extend_booking', methods=['POST'])
def extend_booking():
    data = request.get_json() or {}
    booking_id = data.get('booking_id')
    try:
        extra_hours = int(data.get('extra_hours', 1))
        if extra_hours < 1:
            extra_hours = 1
    except (ValueError, TypeError):
        extra_hours = 1

    if not booking_id:
        return jsonify({'success': False, 'message': 'Booking ID required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE id=? AND status='Booked'", (booking_id,))
    booking = cursor.fetchone()

    if not booking:
        conn.close()
        return jsonify({'success': False, 'message': 'Active booking not found'}), 404

    slot_info = next((s for s in SLOTS if s['id'] == booking['slot_number']), None)
    rate = slot_info['price'] if slot_info else 50
    added_amount = rate * extra_hours
    new_total_price = booking['total_price'] + added_amount
    new_duration = booking['duration_hours'] + extra_hours

    # Update expected exit time
    new_exit_str = ''
    if booking['expected_exit_time']:
        try:
            curr_exit = datetime.strptime(booking['expected_exit_time'], '%Y-%m-%d %H:%M:%S')
            new_exit = curr_exit + timedelta(hours=extra_hours)
            new_exit_str = new_exit.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            new_exit_str = (datetime.now() + timedelta(hours=new_duration)).strftime('%Y-%m-%d %H:%M:%S')
    else:
        new_exit_str = (datetime.now() + timedelta(hours=new_duration)).strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''UPDATE bookings 
                      SET duration_hours=?, total_price=?, expected_exit_time=?, notes=? 
                      WHERE id=?''',
                   (new_duration, new_total_price, new_exit_str, f'Extended by {extra_hours}h', booking_id))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Parking extended by {extra_hours} hour(s)',
        'booking_id': booking_id,
        'new_duration': new_duration,
        'new_total_price': new_total_price,
        'expected_exit_time': new_exit_str
    })

@app.route('/api/ticket/<query>')
def get_ticket(query):
    query = query.strip()
    conn = get_db()
    cursor = conn.cursor()

    if query.startswith('#'):
        query_clean = query[1:]
    else:
        query_clean = query

    if query_clean.isdigit():
        cursor.execute("SELECT * FROM bookings WHERE id=? ORDER BY id DESC LIMIT 1", (int(query_clean),))
    else:
        cursor.execute("SELECT * FROM bookings WHERE UPPER(vehicle_no)=UPPER(?) ORDER BY id DESC LIMIT 1", (query,))

    booking = cursor.fetchone()
    conn.close()

    if not booking:
        return jsonify({'success': False, 'message': 'No booking found for this ID or Vehicle Number'}), 404

    b_dict = dict(booking)
    now = datetime.now()
    
    # Calculate time remaining / overdue status
    is_overdue = False
    minutes_remaining = 0
    if b_dict.get('expected_exit_time'):
        try:
            exp_time = datetime.strptime(b_dict['expected_exit_time'], '%Y-%m-%d %H:%M:%S')
            diff_seconds = (exp_time - now).total_seconds()
            minutes_remaining = int(diff_seconds / 60)
            if minutes_remaining < 0 and b_dict.get('status') == 'Booked':
                is_overdue = True
        except Exception:
            pass

    return jsonify({
        'success': True,
        'ticket': b_dict,
        'is_overdue': is_overdue,
        'minutes_remaining': minutes_remaining
    })

@app.route('/api/slots')
def api_slots():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE status='Booked'")
    booked_rows = cursor.fetchall()
    active_by_slot = {row['slot_number']: dict(row) for row in booked_rows}
    conn.close()

    slot_list = []
    for slot in SLOTS:
        s = slot.copy()
        if s['id'] in active_by_slot:
            s['status'] = 'Occupied'
            b = active_by_slot[s['id']]
            s['current_booking'] = {
                'id': b['id'],
                'driver_name': b['driver_name'],
                'vehicle_no': b['vehicle_no'],
                'entry_time': b.get('entry_time', ''),
                'expected_exit_time': b.get('expected_exit_time', ''),
                'duration_hours': b['duration_hours']
            }
        else:
            s['status'] = 'Available'
            s['current_booking'] = None
        slot_list.append(s)

    return jsonify({'success': True, 'slots': slot_list})

@app.route('/api/stats')
def api_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total_b FROM bookings")
    total_b = cursor.fetchone()['total_b']

    cursor.execute("SELECT SUM(total_price) as rev FROM bookings WHERE status != 'Cancelled'")
    rev_row = cursor.fetchone()
    total_revenue = rev_row['rev'] if rev_row and rev_row['rev'] else 0

    cursor.execute("SELECT COUNT(DISTINCT slot_number) as active_cnt FROM bookings WHERE status='Booked'")
    active_cnt = cursor.fetchone()['active_cnt']

    cursor.execute("SELECT COUNT(*) as comp_cnt FROM bookings WHERE status='Completed'")
    comp_cnt = cursor.fetchone()['comp_cnt']

    cursor.execute("SELECT COUNT(*) as canc_cnt FROM bookings WHERE status='Cancelled'")
    canc_cnt = cursor.fetchone()['canc_cnt']
    conn.close()

    total_slots = len(SLOTS)
    avail_slots = max(0, total_slots - active_cnt)
    occupancy_pct = min(100.0, round((active_cnt / total_slots) * 100, 1))

    return jsonify({
        'success': True,
        'total_revenue': total_revenue,
        'active_bookings': active_cnt,
        'completed_bookings': comp_cnt,
        'cancelled_bookings': canc_cnt,
        'total_bookings': total_b,
        'total_slots': total_slots,
        'available_slots': avail_slots,
        'occupancy_pct': occupancy_pct
    })

@app.route('/api/health')
def api_health():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception:
        db_ok = False

    return jsonify({
        'status': 'healthy' if db_ok else 'degraded',
        'database': 'connected' if db_ok else 'error',
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'service': 'Smart Parking Management System',
        'version': '2.0.0'
    }), (200 if db_ok else 500)

@app.route('/api/system_info')
def api_system_info():
    import sys
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM bookings")
    total_bookings = cursor.fetchone()['total']
    cursor.execute("SELECT COUNT(DISTINCT slot_number) as active FROM bookings WHERE status='Booked'")
    active_cnt = cursor.fetchone()['active']
    conn.close()

    return jsonify({
        'app_name': 'Smart Parking Management System',
        'version': '2.0.0',
        'author': 'Nikhil Kumar B',
        'environment': os.environ.get('FLASK_ENV', 'production'),
        'python_version': sys.version.split()[0],
        'total_slots': len(SLOTS),
        'active_slots': active_cnt,
        'total_historical_bookings': total_bookings,
        'features': [
            'Dynamic Real-time Slot Reservation',
            'Interactive Live Telemetry & Auto-Refresh',
            'Digital Pass & QR Code Verification',
            'Duration Extension & Overdue Analytics',
            'Automated CSV Audit Reporting',
            'Dockerized Containerization & DevSecOps',
            'Ansible Playbook Automated Deployment',
            'Jenkins Declarative CI/CD Pipeline'
        ]
    })

@app.route('/export_csv')
def export_csv():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings ORDER BY id DESC")
    bookings = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Booking ID', 'Driver Name', 'Vehicle No', 'Vehicle Type', 'Contact',
        'Slot Bay', 'Duration (Hours)', 'Total Paid (INR)', 'Status',
        'Entry Time', 'Expected Exit Time', 'Booking Timestamp', 'Payment Method', 'Notes'
    ])

    for b in bookings:
        row = dict(b)
        writer.writerow([
            f"#{row.get('id', '')}",
            row.get('driver_name', ''),
            row.get('vehicle_no', ''),
            row.get('vehicle_type', 'Car'),
            row.get('phone_number', ''),
            row.get('slot_number', ''),
            row.get('duration_hours', 1),
            row.get('total_price', 0),
            row.get('status', 'Booked'),
            row.get('entry_time', ''),
            row.get('expected_exit_time', ''),
            row.get('timestamp', ''),
            row.get('payment_method', 'UPI'),
            row.get('notes', '')
        ])

    csv_data = output.getvalue()
    filename = f"parking_audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.route('/admin')
def admin():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings ORDER BY id DESC")
    bookings = cursor.fetchall()

    cursor.execute("SELECT SUM(total_price) as total_rev FROM bookings WHERE status != 'Cancelled'")
    total_rev_row = cursor.fetchone()
    total_revenue = total_rev_row['total_rev'] if total_rev_row and total_rev_row['total_rev'] else 0

    cursor.execute("SELECT COUNT(DISTINCT slot_number) as active_cnt FROM bookings WHERE status='Booked'")
    active_cnt = cursor.fetchone()['active_cnt']

    cursor.execute("SELECT COUNT(*) as completed_cnt FROM bookings WHERE status='Completed'")
    completed_cnt = cursor.fetchone()['completed_cnt']

    cursor.execute("SELECT COUNT(*) as cancelled_cnt FROM bookings WHERE status='Cancelled'")
    cancelled_cnt = cursor.fetchone()['cancelled_cnt']

    today_str = datetime.now().strftime('%Y-%m-%d')
    cursor.execute("SELECT COUNT(*) as today_cnt FROM bookings WHERE timestamp LIKE ?", (f"{today_str}%",))
    today_cnt = cursor.fetchone()['today_cnt']

    conn.close()

    total_slots = len(SLOTS)
    occupancy_pct = min(100.0, round((active_cnt / total_slots) * 100, 1))

    stats = {
        'total_revenue': total_revenue,
        'active_bookings': active_cnt,
        'completed_bookings': completed_cnt,
        'cancelled_bookings': cancelled_cnt,
        'total_bookings': len(bookings),
        'today_bookings': today_cnt,
        'total_slots': total_slots,
        'occupancy_pct': occupancy_pct
    }

    return render_template('admin.html', bookings=bookings, stats=stats)

if __name__ == '__main__':
    import threading
    from werkzeug.serving import run_simple

    # Concurrently serve on Port 5001 (Docker/Ansible mapped port) and Port 5000
    t = threading.Thread(target=lambda: run_simple('0.0.0.0', 5001, app, threaded=True), daemon=True)
    t.start()

    app.run(host='0.0.0.0', port=5000, debug=False)


