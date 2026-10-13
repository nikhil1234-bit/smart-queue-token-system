const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/db');
const tokenRoutes = require('./routes/tokenRoutes');
const counterRoutes = require('./routes/counterRoutes');
const queueRoutes = require('./routes/queueRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Utility Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false // Allows inline scripts & Google Fonts in modern UI
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/tokens', tokenRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/queue', queueRoutes);

// Direct Health Check Route for Docker & Render & Monitoring
app.get('/api/health', (req, res) => {
  res.redirect('/api/queue/health');
});

// Single Page Application Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint Not Found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Start Server Function
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Smart Queue & Token Management DevOps System Running`);
      console.log(`📍 Local URL:     http://localhost:${PORT}`);
      console.log(`🩺 Health Check:  http://localhost:${PORT}/api/health`);
      console.log(`📦 Node Version:  ${process.version}`);
      console.log(`⚙️  Environment:   ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
