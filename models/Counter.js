const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    counterNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    counterName: {
      type: String,
      default: function () {
        return `Desk ${this.counterNumber}`;
      }
    },
    officerName: {
      type: String,
      default: 'Officer'
    },
    assignedService: {
      type: String,
      default: 'All Services'
    },
    status: {
      type: String,
      enum: ['Available', 'Calling', 'Serving', 'Closed'],
      default: 'Available'
    },
    currentServingToken: {
      type: String,
      default: null
    },
    tokensServedToday: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Fallback in-memory counters
const initialCounters = [
  { counterNumber: 1, counterName: 'Desk 1 - Quick Service', officerName: 'Sarah Jenkins', assignedService: 'General Inquiries', status: 'Available', currentServingToken: null, tokensServedToday: 0 },
  { counterNumber: 2, counterName: 'Desk 2 - Accounts & Cash', officerName: 'Michael Chang', assignedService: 'Account Services', status: 'Available', currentServingToken: null, tokensServedToday: 0 },
  { counterNumber: 3, counterName: 'Desk 3 - Billing & Deposit', officerName: 'Priya Sharma', assignedService: 'Cash & Billing', status: 'Available', currentServingToken: null, tokensServedToday: 0 },
  { counterNumber: 4, counterName: 'Desk 4 - VIP & Support', officerName: 'David Miller', assignedService: 'Priority / VIP', status: 'Available', currentServingToken: null, tokensServedToday: 0 }
];

let memoryCounters = [...initialCounters];

const memoryCounterStore = {
  counters: memoryCounters,
  async find() {
    return memoryCounters;
  },
  async findOne(filter = {}) {
    return memoryCounters.find(c => {
      if (filter.counterNumber !== undefined && c.counterNumber !== Number(filter.counterNumber)) return false;
      return true;
    }) || null;
  },
  async updateOne(filter, update) {
    const item = await this.findOne(filter);
    if (item) {
      Object.assign(item, update);
      return item;
    }
    return null;
  },
  async reset() {
    memoryCounters = JSON.parse(JSON.stringify(initialCounters));
    this.counters = memoryCounters;
  }
};

const CounterModel = mongoose.model('Counter', counterSchema);

module.exports = { Counter: CounterModel, memoryCounterStore, initialCounters };
