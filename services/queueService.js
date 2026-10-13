const mongoose = require('mongoose');
const { Token, memoryTokenStore } = require('../models/Token');
const { Counter, memoryCounterStore, initialCounters } = require('../models/Counter');

// Prefix mapping for ticket issuance
const servicePrefixes = {
  'General Inquiries': 'A',
  'Account Services': 'B',
  'Cash & Billing': 'C',
  'Technical Support': 'T',
  'Priority / VIP': 'V'
};

let ticketCounters = { A: 100, B: 100, C: 100, T: 100, V: 100 };

const isMongoReady = () => mongoose.connection.readyState === 1;

// Seed initial counters into MongoDB if connected
const seedCountersIfEmpty = async () => {
  if (!isMongoReady()) return;
  try {
    const count = await Counter.countDocuments();
    if (count === 0) {
      await Counter.insertMany(initialCounters);
      console.log('🌱 Seeded 4 default service counters into MongoDB Atlas.');
    }
  } catch (err) {
    console.error('Error seeding counters:', err.message);
  }
};

const generateTokenNumber = (service, priority) => {
  let prefix = servicePrefixes[service] || 'A';
  if (priority === 'VIP') {
    prefix = 'V';
  }
  ticketCounters[prefix] = (ticketCounters[prefix] || 100) + 1;
  return `${prefix}-${ticketCounters[prefix]}`;
};

const createToken = async ({ service, customerName, phoneNumber, priority }) => {
  const tokenNumber = generateTokenNumber(service, priority);
  const waitingCount = await getWaitingCount();
  const estimatedWaitMinutes = Math.max(3, (waitingCount + 1) * 4);

  const tokenData = {
    tokenNumber,
    service: service || 'General Inquiries',
    customerName: customerName ? customerName.trim() : 'Guest Customer',
    phoneNumber: phoneNumber ? phoneNumber.trim() : '',
    priority: priority || 'Normal',
    status: 'Waiting',
    estimatedWaitMinutes
  };

  if (isMongoReady()) {
    const doc = new Token(tokenData);
    await doc.save();
    return doc.toObject();
  } else {
    return await memoryTokenStore.create(tokenData);
  }
};

const getWaitingTokens = async () => {
  if (isMongoReady()) {
    return await Token.find({ status: 'Waiting' }).sort({ createdAt: 1 });
  } else {
    return await memoryTokenStore.find({ status: 'Waiting' });
  }
};

const getWaitingCount = async () => {
  if (isMongoReady()) {
    return await Token.countDocuments({ status: 'Waiting' });
  } else {
    return await memoryTokenStore.countDocuments({ status: 'Waiting' });
  }
};

const getServingTokens = async () => {
  if (isMongoReady()) {
    return await Token.find({ status: 'Serving' }).sort({ calledAt: -1 });
  } else {
    return (await memoryTokenStore.find({ status: 'Serving' })).sort((a, b) => new Date(b.calledAt || 0) - new Date(a.calledAt || 0));
  }
};

const getHistoryTokens = async (limit = 10) => {
  if (isMongoReady()) {
    return await Token.find({ status: { $in: ['Completed', 'Skipped'] } })
      .sort({ updatedAt: -1 })
      .limit(limit);
  } else {
    return memoryTokenStore.tokens
      .filter((t) => t.status === 'Completed' || t.status === 'Skipped')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }
};

const getCounters = async () => {
  if (isMongoReady()) {
    await seedCountersIfEmpty();
    return await Counter.find().sort({ counterNumber: 1 });
  } else {
    return await memoryCounterStore.find();
  }
};

const callNextToken = async (counterNumber) => {
  const num = Number(counterNumber);

  // 1. Find next waiting token (VIP & Senior first, else FIFO)
  let nextToken = null;
  if (isMongoReady()) {
    // Check priority first
    nextToken = await Token.findOne({ status: 'Waiting', priority: { $in: ['VIP', 'Senior Citizen'] } }).sort({ createdAt: 1 });
    if (!nextToken) {
      nextToken = await Token.findOne({ status: 'Waiting' }).sort({ createdAt: 1 });
    }
  } else {
    const waiting = await memoryTokenStore.find({ status: 'Waiting' });
    nextToken = waiting.find(t => t.priority === 'VIP' || t.priority === 'Senior Citizen') || waiting[0];
  }

  if (!nextToken) {
    return { success: false, message: 'No customers currently waiting in queue.' };
  }

  // 2. Update token status to Serving
  const now = new Date();
  if (isMongoReady()) {
    nextToken.status = 'Serving';
    nextToken.counter = num;
    nextToken.calledAt = now;
    await nextToken.save();

    await Counter.findOneAndUpdate(
      { counterNumber: num },
      { status: 'Serving', currentServingToken: nextToken.tokenNumber }
    );
  } else {
    await memoryTokenStore.updateOne(
      { tokenNumber: nextToken.tokenNumber },
      { status: 'Serving', counter: num, calledAt: now }
    );
    await memoryCounterStore.updateOne(
      { counterNumber: num },
      { status: 'Serving', currentServingToken: nextToken.tokenNumber }
    );
  }

  return {
    success: true,
    token: isMongoReady() ? nextToken.toObject() : nextToken,
    counterNumber: num,
    message: `Token ${nextToken.tokenNumber} called to Counter ${num}`
  };
};

const completeToken = async (counterNumber) => {
  const num = Number(counterNumber);
  let counter = null;

  if (isMongoReady()) {
    counter = await Counter.findOne({ counterNumber: num });
  } else {
    counter = await memoryCounterStore.findOne({ counterNumber: num });
  }

  if (!counter || !counter.currentServingToken) {
    return { success: false, message: `Counter ${num} is not currently serving any token.` };
  }

  const tokenNum = counter.currentServingToken;
  const now = new Date();

  if (isMongoReady()) {
    await Token.findOneAndUpdate(
      { tokenNumber: tokenNum },
      { status: 'Completed', completedAt: now }
    );
    await Counter.findOneAndUpdate(
      { counterNumber: num },
      {
        status: 'Available',
        currentServingToken: null,
        $inc: { tokensServedToday: 1 }
      }
    );
  } else {
    await memoryTokenStore.updateOne(
      { tokenNumber: tokenNum },
      { status: 'Completed', completedAt: now }
    );
    await memoryCounterStore.updateOne(
      { counterNumber: num },
      {
        status: 'Available',
        currentServingToken: null,
        tokensServedToday: (counter.tokensServedToday || 0) + 1
      }
    );
  }

  return {
    success: true,
    tokenNumber: tokenNum,
    counterNumber: num,
    message: `Token ${tokenNum} marked as Completed at Counter ${num}.`
  };
};

const skipToken = async (counterNumber) => {
  const num = Number(counterNumber);
  let counter = null;

  if (isMongoReady()) {
    counter = await Counter.findOne({ counterNumber: num });
  } else {
    counter = await memoryCounterStore.findOne({ counterNumber: num });
  }

  if (!counter || !counter.currentServingToken) {
    return { success: false, message: `Counter ${num} has no active token to skip.` };
  }

  const tokenNum = counter.currentServingToken;

  if (isMongoReady()) {
    await Token.findOneAndUpdate(
      { tokenNumber: tokenNum },
      { status: 'Skipped' }
    );
    await Counter.findOneAndUpdate(
      { counterNumber: num },
      { status: 'Available', currentServingToken: null }
    );
  } else {
    await memoryTokenStore.updateOne(
      { tokenNumber: tokenNum },
      { status: 'Skipped' }
    );
    await memoryCounterStore.updateOne(
      { counterNumber: num },
      { status: 'Available', currentServingToken: null }
    );
  }

  return {
    success: true,
    tokenNumber: tokenNum,
    counterNumber: num,
    message: `Token ${tokenNum} marked as Skipped.`
  };
};

const getStats = async () => {
  let waiting = 0;
  let serving = 0;
  let completed = 0;

  if (isMongoReady()) {
    waiting = await Token.countDocuments({ status: 'Waiting' });
    serving = await Token.countDocuments({ status: 'Serving' });
    completed = await Token.countDocuments({ status: 'Completed' });
  } else {
    waiting = memoryTokenStore.tokens.filter(t => t.status === 'Waiting').length;
    serving = memoryTokenStore.tokens.filter(t => t.status === 'Serving').length;
    completed = memoryTokenStore.tokens.filter(t => t.status === 'Completed').length;
  }

  const avgWait = waiting > 0 ? (waiting * 3.5).toFixed(1) : 0;

  return {
    waitingCount: waiting,
    servingCount: serving,
    completedToday: completed,
    totalIssued: waiting + serving + completed,
    averageWaitMinutes: Number(avgWait),
    activeCounters: 4
  };
};

const resetAll = async () => {
  ticketCounters = { A: 100, B: 100, C: 100, T: 100, V: 100 };
  memoryTokenStore.tokens.length = 0;
  await memoryCounterStore.reset();
  if (isMongoReady()) {
    await Token.deleteMany({});
    await Counter.deleteMany({});
    await seedCountersIfEmpty();
  }
};

module.exports = {
  createToken,
  getWaitingTokens,
  getServingTokens,
  getHistoryTokens,
  getCounters,
  callNextToken,
  completeToken,
  skipToken,
  getStats,
  resetAll,
  seedCountersIfEmpty
};
