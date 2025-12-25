// Chart functionality with WebSocket support
let rpsChart = null;
let currentWindow = 5;
let adminWs = null;
let wsReconnectTimeout = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;

// Callbacks for external handlers
let onRequestCallback = null;
let onRpsCallback = null;

const chartConfig = {
  type: 'line',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28, 33, 40, 0.95)',
        titleColor: '#e6edf3',
        bodyColor: '#8b949e',
        borderColor: '#30363d',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items) => new Date(items[0].parsed.x).toLocaleTimeString(),
          label: (item) => `${item.parsed.y.toFixed(2)} req/s`
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        display: true,
        grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
        ticks: {
          color: '#6e7681',
          font: { family: 'JetBrains Mono', size: 10 },
          maxTicksLimit: 8,
          callback: (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
        ticks: {
          color: '#6e7681',
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value) => value.toFixed(1)
        }
      }
    }
  }
};

function createChartData(data) {
  return {
    datasets: [{
      data: data.map(d => ({ x: d.timestamp, y: d.rps })),
      borderColor: '#58a6ff',
      backgroundColor: 'rgba(88, 166, 255, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#58a6ff'
    }]
  };
}

function initRpsChart(canvasId) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (ctx && !rpsChart) {
    rpsChart = new Chart(ctx, {
      ...chartConfig,
      data: createChartData([])
    });
  }
}

function updateRpsChart(response) {
  if (rpsChart) {
    rpsChart.data = createChartData(response.data);
    rpsChart.update('none');
  }

  // Update stats
  const currentEl = document.getElementById('rps-current');
  const avgEl = document.getElementById('rps-avg');
  const peakEl = document.getElementById('rps-peak');
  const totalEl = document.getElementById('rps-total');

  if (currentEl) currentEl.textContent = response.stats.current.toFixed(2);
  if (avgEl) avgEl.textContent = response.stats.average.toFixed(2);
  if (peakEl) peakEl.textContent = response.stats.peak.toFixed(2);
  if (totalEl) totalEl.textContent = response.stats.total.toLocaleString();
  
  // Call external callback if set
  if (onRpsCallback) onRpsCallback(response);
}

function setChartWindow(window) {
  currentWindow = window;
  document.querySelectorAll('.chart-filter-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.window) === window);
  });
  
  // Request server to update window (optional optimization)
  if (adminWs && adminWs.readyState === WebSocket.OPEN) {
    adminWs.send(JSON.stringify({ type: 'setWindow', window }));
  }
}

// WebSocket connection management
function connectWebSocket() {
  if (adminWs && adminWs.readyState === WebSocket.OPEN) {
    return; // Already connected
  }
  
  const token = localStorage.getItem('admin_token');
  if (!token) {
    console.warn('No admin token for WebSocket connection');
    return;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/admin?token=${encodeURIComponent(token)}`;
  
  try {
    adminWs = new WebSocket(wsUrl);
    
    adminWs.onopen = () => {
      console.log('📡 WebSocket connected');
      wsReconnectAttempts = 0;
      updateConnectionStatus(true);
    };
    
    adminWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'rps':
            updateRpsChart(message.data);
            break;
          case 'request':
            if (onRequestCallback) {
              onRequestCallback(message.data);
            }
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    
    adminWs.onclose = (event) => {
      console.log('📡 WebSocket disconnected', event.code, event.reason);
      updateConnectionStatus(false);
      adminWs = null;
      
      // Reconnect unless it was an auth error
      if (event.code !== 4001 && wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        const delay = RECONNECT_DELAY * Math.min(wsReconnectAttempts, 5);
        console.log(`📡 Reconnecting in ${delay}ms (attempt ${wsReconnectAttempts})`);
        wsReconnectTimeout = setTimeout(connectWebSocket, delay);
      }
    };
    
    adminWs.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
  } catch (err) {
    console.error('WebSocket connection error:', err);
  }
}

function disconnectWebSocket() {
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }
  
  if (adminWs) {
    adminWs.close();
    adminWs = null;
  }
}

function updateConnectionStatus(connected) {
  const indicator = document.getElementById('ws-status');
  if (indicator) {
    indicator.className = `ws-status ${connected ? 'connected' : 'disconnected'}`;
    indicator.title = connected ? 'Real-time updates active' : 'Reconnecting...';
  }
}

// Register callback for new requests
function onRequest(callback) {
  onRequestCallback = callback;
}

// Register callback for RPS updates
function onRps(callback) {
  onRpsCallback = callback;
}

// Start WebSocket connection (replaces polling)
function startRpsPolling() {
  connectWebSocket();
}

function stopRpsPolling() {
  disconnectWebSocket();
}

// Initialize chart filter buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.chart-filters').forEach(container => {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('chart-filter-btn')) {
        setChartWindow(parseInt(e.target.dataset.window));
      }
    });
  });
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  disconnectWebSocket();
});
