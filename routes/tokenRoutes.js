const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');

// POST /api/tokens - Generate a new token
router.post('/', async (req, res) => {
  try {
    const { service, customerName, phoneNumber, priority } = req.body;
    const token = await queueService.createToken({
      service,
      customerName,
      phoneNumber,
      priority
    });
    return res.status(201).json({
      success: true,
      message: 'Token issued successfully',
      data: token
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to issue token',
      error: error.message
    });
  }
});

// GET /api/tokens/waiting - Fetch all currently waiting tokens
router.get('/waiting', async (req, res) => {
  try {
    const tokens = await queueService.getWaitingTokens();
    return res.json({
      success: true,
      count: tokens.length,
      data: tokens
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve waiting tokens',
      error: error.message
    });
  }
});

// GET /api/tokens/serving - Fetch all tokens currently being served
router.get('/serving', async (req, res) => {
  try {
    const tokens = await queueService.getServingTokens();
    return res.json({
      success: true,
      count: tokens.length,
      data: tokens
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve serving tokens',
      error: error.message
    });
  }
});

// GET /api/tokens/history - Fetch recent completed tokens
router.get('/history', async (req, res) => {
  try {
    const tokens = await queueService.getHistoryTokens();
    return res.json({
      success: true,
      count: tokens.length,
      data: tokens
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve token history',
      error: error.message
    });
  }
});

module.exports = router;
