import pytest
import os
import json
from app import app, init_db, DB_PATH

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        init_db()
        yield client

def test_home_page(client):
    rv = client.get('/')
    assert rv.status_code == 200
    assert b'Smart Parking' in rv.data

def test_book_slot(client):
    payload = {
        'driver_name': 'Nikhil Kumar B',
        'vehicle_no': 'TN-37-AB-1234',
        'slot_number': 'A1',
        'duration': 2
    }
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['success'] is True
    assert data['slot_number'] == 'A1'
    assert data['total_price'] == 200

def test_release_slot(client):
    # Book first
    payload = {'driver_name': 'Test User', 'vehicle_no': 'TN-01-XX-9999', 'slot_number': 'A2', 'duration': 1}
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    booking_id = json.loads(rv.data)['booking_id']

    # Release
    rv_release = client.post('/release_slot', data=json.dumps({'booking_id': booking_id}), content_type='application/json')
    assert rv_release.status_code == 200
    data_release = json.loads(rv_release.data)
    assert data_release['success'] is True

def test_cancel_booking(client):
    # Book first
    payload = {'driver_name': 'Test User 2', 'vehicle_no': 'TN-01-XX-8888', 'slot_number': 'B1', 'duration': 1}
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    booking_id = json.loads(rv.data)['booking_id']

    # Cancel
    rv_cancel = client.post('/cancel_booking', data=json.dumps({'booking_id': booking_id}), content_type='application/json')
    assert rv_cancel.status_code == 200
    data_cancel = json.loads(rv_cancel.data)
    assert data_cancel['success'] is True

def test_admin_dashboard(client):
    rv = client.get('/admin')
    assert rv.status_code == 200
    assert b'Vehicle Booking & System Analytics' in rv.data

def test_api_slots(client):
    rv = client.get('/api/slots')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['success'] is True
    assert len(data['slots']) > 0

def test_api_stats(client):
    rv = client.get('/api/stats')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['success'] is True
    assert 'occupancy_pct' in data
    assert 'total_slots' in data

def test_extend_booking(client):
    # Book slot
    payload = {'driver_name': 'Extend User', 'vehicle_no': 'TN-09-EX-1111', 'slot_number': 'A3', 'duration': 1}
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    booking_id = json.loads(rv.data)['booking_id']

    # Extend by 2 hours
    rv_ext = client.post('/api/extend_booking', data=json.dumps({'booking_id': booking_id, 'extra_hours': 2}), content_type='application/json')
    assert rv_ext.status_code == 200
    data_ext = json.loads(rv_ext.data)
    assert data_ext['success'] is True
    assert data_ext['new_duration'] == 3

def test_ticket_lookup(client):
    payload = {'driver_name': 'Lookup User', 'vehicle_no': 'TN-99-ZZ-0001', 'slot_number': 'B2', 'duration': 1}
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    booking_id = json.loads(rv.data)['booking_id']

    # Lookup by ID
    rv_lookup = client.get(f'/api/ticket/{booking_id}')
    assert rv_lookup.status_code == 200
    data_lookup = json.loads(rv_lookup.data)
    assert data_lookup['success'] is True
    assert data_lookup['ticket']['vehicle_no'] == 'TN-99-ZZ-0001'

    # Lookup by Vehicle Number
    rv_v = client.get('/api/ticket/TN-99-ZZ-0001')
    assert rv_v.status_code == 200
    assert json.loads(rv_v.data)['success'] is True

def test_export_csv(client):
    rv = client.get('/export_csv')
    assert rv.status_code == 200
    assert rv.content_type == 'text/csv; charset=utf-8' or 'text/csv' in rv.content_type
    assert b'Booking ID,Driver Name,Vehicle No' in rv.data

def test_api_health(client):
    rv = client.get('/api/health')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['status'] == 'healthy'
    assert data['database'] == 'connected'
    assert data['version'] == '2.0.0'

def test_api_system_info(client):
    rv = client.get('/api/system_info')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['version'] == '2.0.0'
    assert 'author' in data
    assert 'total_slots' in data

def test_invalid_slot_booking(client):
    payload = {'driver_name': 'Bad Slot User', 'vehicle_no': 'TN-00-XX-0000', 'slot_number': 'NON_EXISTENT', 'duration': 1}
    rv = client.post('/book_slot', data=json.dumps(payload), content_type='application/json')
    assert rv.status_code == 400
    data = json.loads(rv.data)
    assert data['success'] is False



