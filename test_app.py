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
