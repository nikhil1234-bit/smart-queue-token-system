const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const { getStatus } = require('../config/db');

// GET /api/queue/stats - Get overall queue metrics
router.get('/stats', async (req, res) => {
  try {
    const stats = await queueService.getStats();
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch queue statistics',
      error: error.message
    });
  }
});

// POST /api/queue/reset - Reset current day's queue (testing / new shift)
router.post('/reset', async (req, res) => {
  try {
    await queueService.resetAll();
    return res.json({
      success: true,
      message: 'Queue and token system reset successfully.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reset queue',
      error: error.message
    });
  }
});

// GET /api/queue/health - Health check endpoint for Docker & Render & CI/CD
router.get('/health', async (req, res) => {
  const dbStatus = getStatus();
  return res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'Smart Queue & Token Management DevOps API',
    version: '1.0.0',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
