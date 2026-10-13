const mongoose = require('mongoose');

let isConnected = false;
let mockMode = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️  MONGODB_URI not found in environment. Running in Memory/Mock Database Mode.');
    console.warn('👉 To connect to MongoDB Atlas, add your connection string to .env (e.g., MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/queue_db)');
    mockMode = true;
    return { isConnected: false, mockMode: true };
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    mockMode = false;
    console.log(`✅ MongoDB Connected to Atlas Host: ${conn.connection.host}`);
    return { isConnected: true, mockMode: false };
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    console.warn('⚠️  Falling back to Resilient In-Memory Mode so your app continues running.');
    mockMode = true;
    return { isConnected: false, mockMode: true, error: error.message };
  }
};

const getStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host || 'simulated-in-memory',
  mockMode: mockMode || mongoose.connection.readyState !== 1,
  timestamp: new Date().toISOString()
});

module.exports = { connectDB, getStatus };
