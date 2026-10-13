// State Management
let selectedService = 'General Inquiries';
let isSoundEnabled = true;
let countersData = [];
let waitingTokensData = [];

// Web Audio API Ding-Dong Chime Synthesizer
const playChimeSound = () => {
  if (!isSoundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Traditional Two-Tone chime (C5 -> E5)
    playTone(523.25, 0, 0.45);
    playTone(659.25, 0.25, 0.7);
  } catch (e) {
    console.warn('Audio chime unavailable:', e);
  }
};

const playVoiceAnnouncement = (tokenNumber, counterNumber) => {
  if (!isSoundEnabled || !window.speechSynthesis) return;
  try {
    const text = `Token ${tokenNumber.split('').join(' ')}, please proceed to Counter ${counterNumber}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Voice announcement failed:', e);
  }
};

// Toast Notifications
const showToast = (message, type = 'info') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// Clock Ticker
const startClock = () => {
  const clockEl = document.getElementById('live-clock-ticker');
  if (!clockEl) return;
  setInterval(() => {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString();
  }, 1000);
};

// Tab Switching
const initTabs = () => {
  const buttons = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.tab-content');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      buttons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
};

// Service Selector in Kiosk
const initServiceSelector = () => {
  const opts = document.querySelectorAll('.service-opt');
  opts.forEach((opt) => {
    opt.addEventListener('click', () => {
      opts.forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedService = opt.getAttribute('data-service');
      const servicePreview = document.getElementById('preview-service-name');
      if (servicePreview) servicePreview.innerText = selectedService;
    });
  });
};

// Fetch Health & Database Status
const fetchHealthStatus = async () => {
  try {
    const res = await fetch('/api/queue/health');
    const data = await res.json();
    const statusText = document.getElementById('db-status-text');
    const statusDot = document.getElementById('db-status-dot');

    if (data.database && data.database.connected) {
      statusText.innerText = 'MongoDB Atlas Connected';
      statusDot.style.background = '#10b981';
      statusDot.style.boxShadow = '0 0 10px #10b981';
    } else {
      statusText.innerText = 'In-Memory / Atlas Ready';
      statusDot.style.background = '#06b6d4';
      statusDot.style.boxShadow = '0 0 10px #06b6d4';
    }
  } catch (err) {
    const statusText = document.getElementById('db-status-text');
    if (statusText) statusText.innerText = 'Server Offline';
  }
};

// Fetch Queue Statistics
const fetchQueueStats = async () => {
  try {
    const res = await fetch('/api/queue/stats');
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      document.getElementById('metric-waiting-count').innerText = d.waitingCount;
      document.getElementById('metric-serving-count').innerText = d.servingCount;
      document.getElementById('metric-completed-count').innerText = d.completedToday;
      document.getElementById('metric-avg-wait').innerText = `${d.averageWaitMinutes}m`;
      const tickerBadge = document.getElementById('ticker-waiting-badge');
      if (tickerBadge) tickerBadge.innerText = `${d.waitingCount} waiting`;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
};

// Fetch Waiting Tokens for Ticker
const fetchWaitingTokens = async () => {
  try {
    const res = await fetch('/api/tokens/waiting');
    const json = await res.json();
    if (json.success) {
      waitingTokensData = json.data;
      renderWaitingTicker(json.data);
    }
  } catch (err) {
    console.error('Error fetching waiting tokens:', err);
  }
};

const renderWaitingTicker = (tokens) => {
  const container = document.getElementById('waiting-chips-list');
  if (!container) return;

  if (tokens.length === 0) {
    container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">No customers waiting. All counters clear!</span>`;
    return;
  }

  container.innerHTML = tokens
    .map(
      (t) => `
    <div class="waiting-chip">
      <div class="chip-token">${t.tokenNumber}</div>
      <div>
        <div class="chip-svc">${t.service}</div>
        <div style="font-size: 0.7rem; color: ${t.priority === 'Normal' ? '#9ca3af' : '#f59e0b'}; font-weight: 600;">
          ${t.priority} • ~${t.estimatedWaitMinutes}m
        </div>
      </div>
    </div>
  `
    )
    .join('');
};

// Fetch Counters
const fetchCounters = async () => {
  try {
    const res = await fetch('/api/counters');
    const json = await res.json();
    if (json.success) {
      countersData = json.data;
      renderDisplayBoard(json.data);
      renderOfficerDesks(json.data);
    }
  } catch (err) {
    console.error('Error fetching counters:', err);
  }
};

// Render TV Display Board
const renderDisplayBoard = (counters) => {
  const grid = document.getElementById('tv-serving-grid');
  if (!grid) return;

  grid.innerHTML = counters
    .map((c) => {
      const isServing = c.currentServingToken !== null;
      return `
      <div class="serving-card ${isServing ? 'active-call' : ''}" id="tv-card-counter-${c.counterNumber}">
        <span class="serving-counter-badge">COUNTER 0${c.counterNumber}</span>
        <div class="serving-token-number">${c.currentServingToken || '---'}</div>
        <div class="serving-service-tag">${c.assignedService}</div>
        <div>
          <span class="serving-status-badge ${isServing ? 'status-serving' : 'status-idle'}">
            ${isServing ? '● NOW SERVING' : '○ IDLE / READY'}
          </span>
        </div>
      </div>
    `;
    })
    .join('');
};

// Render Officer Desks
const renderOfficerDesks = (counters) => {
  const grid = document.getElementById('officer-counters-grid');
  if (!grid) return;

  grid.innerHTML = counters
    .map((c) => {
      const isServing = c.currentServingToken !== null;
      return `
      <div class="counter-desk-card" id="desk-card-${c.counterNumber}">
        <div>
          <div class="desk-header">
            <div class="desk-info">
              <h3>Desk 0${c.counterNumber}</h3>
              <p>${c.officerName} • ${c.assignedService}</p>
            </div>
            <span class="serving-status-badge ${isServing ? 'status-serving' : 'status-idle'}">
              ${isServing ? 'BUSY' : 'AVAILABLE'}
            </span>
          </div>

          <div class="desk-current-box">
            <div class="current-label">CURRENT CUSTOMER</div>
            <div class="current-token-code" id="desk-token-${c.counterNumber}">${c.currentServingToken || 'None'}</div>
            <div class="current-cust-name">${isServing ? 'In Service' : 'Waiting for next customer'}</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.35rem;">
              Served Today: <strong>${c.tokensServedToday || 0}</strong>
            </div>
          </div>
        </div>

        <div class="desk-action-grid">
          <button class="btn-call-next" onclick="callNextCustomer(${c.counterNumber})">
            <span>📢</span> Call Next
          </button>
          <button class="btn-desk-secondary" onclick="recallCustomer(${c.counterNumber})" ${!isServing ? 'disabled style="opacity: 0.5;"' : ''}>
            <span>🔔</span> Recall Chime
          </button>
          <button class="btn-desk-secondary btn-desk-finish" onclick="completeCustomer(${c.counterNumber})" ${!isServing ? 'disabled style="opacity: 0.5;"' : ''}>
            <span>✅</span> Complete
          </button>
          <button class="btn-desk-secondary" onclick="skipCustomer(${c.counterNumber})" ${!isServing ? 'disabled style="opacity: 0.5;"' : ''} style="grid-column: 1 / -1; color: #f87171;">
            <span>⏭️</span> Skip / No Show
          </button>
        </div>
      </div>
    `;
    })
    .join('');
};

// Officer Actions
window.callNextCustomer = async (counterNumber) => {
  try {
    const res = await fetch(`/api/counters/${counterNumber}/call-next`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Counter ${counterNumber} called ${json.token.tokenNumber}`, 'success');
      playChimeSound();
      playVoiceAnnouncement(json.token.tokenNumber, counterNumber);
      refreshAll();
    } else {
      showToast(json.message || 'No waiting customers', 'info');
    }
  } catch (err) {
    showToast('Failed to call next token', 'error');
  }
};

window.recallCustomer = (counterNumber) => {
  const counter = countersData.find((c) => c.counterNumber === counterNumber);
  if (counter && counter.currentServingToken) {
    playChimeSound();
    playVoiceAnnouncement(counter.currentServingToken, counterNumber);
    showToast(`Recalled ${counter.currentServingToken} to Counter ${counterNumber}`, 'info');
  }
};

window.completeCustomer = async (counterNumber) => {
  try {
    const res = await fetch(`/api/counters/${counterNumber}/complete`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Finished serving at Desk ${counterNumber}`, 'success');
      refreshAll();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to complete token', 'error');
  }
};

window.skipCustomer = async (counterNumber) => {
  try {
    const res = await fetch(`/api/counters/${counterNumber}/skip`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Skipped token at Desk ${counterNumber}`, 'info');
      refreshAll();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to skip token', 'error');
  }
};

// Generate Token from Kiosk
const initGenerateButton = () => {
  const btn = document.getElementById('btn-generate-token');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const nameInput = document.getElementById('input-customer-name');
    const phoneInput = document.getElementById('input-customer-phone');
    const isPriority = document.getElementById('input-is-priority').checked;

    const payload = {
      service: selectedService,
      customerName: (nameInput.value || '').trim() || 'Guest Customer',
      phoneNumber: (phoneInput.value || '').trim(),
      priority: isPriority ? 'VIP' : 'Normal'
    };

    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> Issuing Ticket...`;

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success && json.data) {
        const t = json.data;
        document.getElementById('preview-token-number').innerText = t.tokenNumber;
        document.getElementById('preview-service-name').innerText = t.service;
        document.getElementById('preview-customer-name').innerText = t.customerName;
        document.getElementById('preview-issue-time').innerText = new Date(t.createdAt).toLocaleTimeString();
        document.getElementById('preview-wait-time').innerText = `~${t.estimatedWaitMinutes} mins`;
        document.getElementById('preview-priority-badge').innerText =
          t.priority === 'VIP' ? '⭐ VIP PRIVILEGE QUEUE' : 'STANDARD QUEUE';
        document.getElementById('preview-priority-badge').style.color =
          t.priority === 'VIP' ? '#f59e0b' : '#6366f1';

        showToast(`Token ${t.tokenNumber} issued successfully!`, 'success');
        playChimeSound();
        nameInput.value = '';
        phoneInput.value = '';
        document.getElementById('input-is-priority').checked = false;
        refreshAll();
      } else {
        showToast(json.message || 'Failed to issue ticket', 'error');
      }
    } catch (err) {
      showToast('Error connecting to queue server', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>🎟️</span> Generate Token Slip`;
    }
  });
};

// Reset Shift Queue
const initResetButton = () => {
  const btn = document.getElementById('btn-reset-queue-day');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the queue and start a fresh shift?')) return;
    try {
      const res = await fetch('/api/queue/reset', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('Queue system reset for new shift', 'success');
        refreshAll();
      }
    } catch (err) {
      showToast('Failed to reset queue', 'error');
    }
  });
};

// Sound Toggle Button
const initSoundToggle = () => {
  const btn = document.getElementById('btn-toggle-sound');
  if (!btn) return;
  btn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    btn.innerHTML = `<span id="sound-icon">${isSoundEnabled ? '🔔' : '🔕'}</span> Chime: ${isSoundEnabled ? 'ON' : 'OFF'}`;
  });
};

// Periodic Polling Refresh
const refreshAll = () => {
  fetchHealthStatus();
  fetchQueueStats();
  fetchWaitingTokens();
  fetchCounters();
};

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initTabs();
  initServiceSelector();
  initGenerateButton();
  initResetButton();
  initSoundToggle();
  refreshAll();

  // Live polling every 3.5 seconds
  setInterval(refreshAll, 3500);
});
