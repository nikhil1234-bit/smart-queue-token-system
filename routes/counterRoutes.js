const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');

// GET /api/counters - List all counters with status
router.get('/', async (req, res) => {
  try {
    const counters = await queueService.getCounters();
    return res.json({
      success: true,
      count: counters.length,
      data: counters
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve counters',
      error: error.message
    });
  }
});

// POST /api/counters/:counterNumber/call-next - Call next customer to this counter
router.post('/:counterNumber/call-next', async (req, res) => {
  try {
    const { counterNumber } = req.params;
    const result = await queueService.callNextToken(counterNumber);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to call next token',
      error: error.message
    });
  }
});

// POST /api/counters/:counterNumber/complete - Mark current token finished
router.post('/:counterNumber/complete', async (req, res) => {
  try {
    const { counterNumber } = req.params;
    const result = await queueService.completeToken(counterNumber);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to complete token',
      error: error.message
    });
  }
});

// POST /api/counters/:counterNumber/skip - Mark current token skipped
router.post('/:counterNumber/skip', async (req, res) => {
  try {
    const { counterNumber } = req.params;
    const result = await queueService.skipToken(counterNumber);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to skip token',
      error: error.message
    });
  }
});

module.exports = router;
