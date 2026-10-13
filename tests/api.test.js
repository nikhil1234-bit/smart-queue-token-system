const request = require('supertest');
const app = require('../server');
const queueService = require('../services/queueService');

beforeEach(async () => {
  await queueService.resetAll();
});

describe('Smart Queue & Token Management DevOps API Test Suite', () => {

  test('GET /api/queue/health - should return 200 healthy status', async () => {
    const res = await request(app).get('/api/queue/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toContain('Queue');
  });

  test('POST /api/tokens - should issue a new token with valid sequence number', async () => {
    const res = await request(app)
      .post('/api/tokens')
      .send({
        service: 'General Inquiries',
        customerName: 'Alex Mercer',
        phoneNumber: '+1234567890',
        priority: 'Normal'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokenNumber).toMatch(/^A-\d+$/);
    expect(res.body.data.customerName).toBe('Alex Mercer');
    expect(res.body.data.status).toBe('Waiting');
  });

  test('GET /api/tokens/waiting - should list queued tokens in FIFO order', async () => {
    await request(app).post('/api/tokens').send({ service: 'General Inquiries', customerName: 'Customer 1' });
    await request(app).post('/api/tokens').send({ service: 'Account Services', customerName: 'Customer 2' });

    const res = await request(app).get('/api/tokens/waiting');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].customerName).toBe('Customer 1');
  });

  test('GET /api/counters - should return default service desks', async () => {
    const res = await request(app).get('/api/counters');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(4);
  });

  test('POST /api/counters/:counterNumber/call-next - should allocate waiting token to counter', async () => {
    const tokenRes = await request(app).post('/api/tokens').send({
      service: 'General Inquiries',
      customerName: 'Elena Rostova'
    });
    const issuedToken = tokenRes.body.data.tokenNumber;

    const callRes = await request(app).post('/api/counters/1/call-next');
    expect(callRes.statusCode).toBe(200);
    expect(callRes.body.success).toBe(true);
    expect(callRes.body.token.tokenNumber).toBe(issuedToken);
    expect(callRes.body.token.status).toBe('Serving');
  });

  test('POST /api/counters/:counterNumber/complete - should mark current serving token completed', async () => {
    await request(app).post('/api/tokens').send({
      service: 'General Inquiries',
      customerName: 'Bruce Wayne'
    });
    await request(app).post('/api/counters/1/call-next');

    const completeRes = await request(app).post('/api/counters/1/complete');
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.counterNumber).toBe(1);

    const statsRes = await request(app).get('/api/queue/stats');
    expect(statsRes.body.data.completedToday).toBe(1);
    expect(statsRes.body.data.waitingCount).toBe(0);
  });

  test('GET /api/queue/stats - should accurately compute queue counts', async () => {
    await request(app).post('/api/tokens').send({ service: 'General Inquiries', customerName: 'User A' });
    await request(app).post('/api/tokens').send({ service: 'Cash & Billing', customerName: 'User B' });

    const res = await request(app).get('/api/queue/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.waitingCount).toBe(2);
    expect(res.body.data.activeCounters).toBe(4);
  });
});
