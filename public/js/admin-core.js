// Admin Core JavaScript
const API_BASE = window.location.origin;
let token = localStorage.getItem('admin_token');

// API Helper
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  
  if (!res.ok) throw new Error(data.error?.message || 'Request failed');
  return data;
}

// Check authentication
async function checkAuth() {
  if (!token) {
    window.location.href = '/login';
    return null;
  }
  try {
    const data = await api('/admin/me');
    return data.admin;
  } catch {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
    return null;
  }
}

// Logout
function logout() {
  localStorage.removeItem('admin_token');
  window.location.href = '/login';
}

// Initialize page
async function initPage(pageName) {
  const admin = await checkAuth();
  if (!admin) return null;
  
  // Set admin name
  const adminNameEl = document.getElementById('adminName');
  if (adminNameEl) adminNameEl.textContent = admin.username;
  
  // Set active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });
  
  return admin;
}

// Utility functions
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString();
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString();
}

function getMethodClass(method) {
  return `method-${method.toLowerCase()}`;
}

function getStatusClass(status) {
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 300) return 'status-3xx';
  return 'status-2xx';
}

function formatJSON(obj) {
  const str = JSON.stringify(obj, null, 2);
  return str
    .replace(/("([^"]+)"):/g, '<span class="json-key">$1</span>:')
    .replace(/: "([^"\\]*(\\.[^"\\]*)*)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/: (null)/g, ': <span class="json-null">$1</span>');
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      let cls = 'json-string';
      if (/:$/.test(match)) cls = 'json-key';
      return `<span class="${cls}">${match}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Sidebar HTML template
function getSidebarHTML(activePage) {
  return `
    <div class="sidebar-logo">
      <h2>🎮 GameBackend</h2>
      <span>Admin Panel</span>
    </div>
    
    <div class="nav-section">
      <div class="nav-section-title">Overview</div>
      <a class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" href="/dashboard" data-page="dashboard">
        <span class="nav-icon">📊</span>
        <span>Dashboard</span>
      </a>
      <a class="nav-item ${activePage === 'console' ? 'active' : ''}" href="/console" data-page="console">
        <span class="nav-icon">📡</span>
        <span>Live Console</span>
      </a>
    </div>

    <div class="nav-section">
      <div class="nav-section-title">Data</div>
      <a class="nav-item ${activePage === 'users' ? 'active' : ''}" href="/users" data-page="users">
        <span class="nav-icon">👥</span>
        <span>Users</span>
      </a>
      <a class="nav-item ${activePage === 'kv' ? 'active' : ''}" href="/kv" data-page="kv">
        <span class="nav-icon">🗄️</span>
        <span>KV Store</span>
      </a>
      <a class="nav-item ${activePage === 'leaderboards' ? 'active' : ''}" href="/leaderboards" data-page="leaderboards">
        <span class="nav-icon">🏆</span>
        <span>Leaderboards</span>
      </a>
    </div>

    <div class="nav-section">
      <div class="nav-section-title">API</div>
      <a class="nav-item ${activePage === 'endpoints' ? 'active' : ''}" href="/endpoints" data-page="endpoints">
        <span class="nav-icon">🔌</span>
        <span>Endpoints</span>
      </a>
    </div>
  `;
}

