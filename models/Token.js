const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    service: {
      type: String,
      required: true,
      enum: ['General Inquiries', 'Account Services', 'Cash & Billing', 'Priority / VIP', 'Technical Support'],
      default: 'General Inquiries'
    },
    customerName: {
      type: String,
      trim: true,
      default: 'Guest Customer'
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ''
    },
    priority: {
      type: String,
      enum: ['Normal', 'Senior Citizen', 'VIP'],
      default: 'Normal'
    },
    status: {
      type: String,
      enum: ['Waiting', 'Serving', 'Completed', 'Cancelled', 'Skipped'],
      default: 'Waiting',
      index: true
    },
    counter: {
      type: Number,
      default: null
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 5
    },
    calledAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Resilient In-Memory Fallback Store for offline / initial testing without Atlas URI
const memoryTokens = [];

// Helper functions for fallback mode
const memoryStore = {
  tokens: memoryTokens,
  async create(data) {
    const item = {
      _id: 'mem_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      ...data,
      status: data.status || 'Waiting',
      counter: data.counter || null,
      calledAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryTokens.push(item);
    return item;
  },
  async find(filter = {}) {
    return memoryTokens
      .filter((t) => {
        if (filter.status && t.status !== filter.status) return false;
        if (filter.service && t.service !== filter.service) return false;
        return true;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },
  async findOne(filter = {}) {
    return memoryTokens.find((t) => {
      if (filter.tokenNumber && t.tokenNumber !== filter.tokenNumber) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter._id && t._id !== filter._id) return false;
      return true;
    }) || null;
  },
  async updateOne(filter, update) {
    const item = await this.findOne(filter);
    if (item) {
      Object.assign(item, update, { updatedAt: new Date() });
      return item;
    }
    return null;
  },
  async countDocuments(filter = {}) {
    return (await this.find(filter)).length;
  }
};

const TokenModel = mongoose.model('Token', tokenSchema);

module.exports = { Token: TokenModel, memoryTokenStore: memoryStore };
