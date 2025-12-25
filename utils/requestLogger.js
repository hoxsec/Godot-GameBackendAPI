// In-memory request log for live console
import { broadcastRequest, broadcastRpsUpdate } from './websocket.js';

const MAX_REQUESTS = 500;
const requests = [];
let requestId = 0;

// Store request counts per second for RPS chart (keep 1 hour of data)
const MAX_RPS_HISTORY = 3600; // 1 hour in seconds
const rpsHistory = []; // Array of { timestamp: secondTimestamp, count: number }

// Paths to exclude from logging (static files, admin pages, etc.)
const EXCLUDED_PATHS = [
  '/css/',
  '/js/',
  '/favicon',
  '/ws/admin',
];

const EXCLUDED_EXTENSIONS = [
  '.html',
  '.css',
  '.js',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
];

// Admin page routes to exclude
const ADMIN_PAGES = [
  '/login',
  '/dashboard',
  '/console',
  '/users',
  '/kv',
  '/leaderboards',
  '/endpoints',
];

function shouldLogRequest(path) {
  // Exclude static file paths
  for (const excluded of EXCLUDED_PATHS) {
    if (path.startsWith(excluded)) return false;
  }
  
  // Exclude admin page routes (but not /admin API routes)
  for (const page of ADMIN_PAGES) {
    if (path === page) return false;
  }
  
  // Exclude by file extension
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (path.endsWith(ext)) return false;
  }
  
  // Exclude root redirect
  if (path === '/') return false;
  
  return true;
}

export function logRequest(req, res, duration) {
  const now = Date.now();
  const entry = {
    id: ++requestId,
    timestamp: now,
    method: req.method,
    path: req.originalUrl || req.path,
    status: res.statusCode,
    duration: duration,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
    userId: req.userId || null
  };

  requests.push(entry);
  
  // Keep only last MAX_REQUESTS
  if (requests.length > MAX_REQUESTS) {
    requests.shift();
  }

  // Update RPS history
  const secondTs = Math.floor(now / 1000) * 1000; // Round to second
  const lastEntry = rpsHistory[rpsHistory.length - 1];
  
  if (lastEntry && lastEntry.timestamp === secondTs) {
    lastEntry.count++;
  } else {
    rpsHistory.push({ timestamp: secondTs, count: 1 });
    // Clean old entries
    const cutoff = now - (MAX_RPS_HISTORY * 1000);
    while (rpsHistory.length > 0 && rpsHistory[0].timestamp < cutoff) {
      rpsHistory.shift();
    }
  }

  // Broadcast request to all WebSocket clients
  broadcastRequest(entry);

  return entry;
}

// Start periodic RPS data broadcast
export function startRpsBroadcast() {
  setInterval(() => {
    // Broadcast RPS data to each client with their preferred window
    broadcastRpsUpdate();
  }, 1000); // Broadcast every second for smooth chart updates
}

export function getRecentRequests(sinceId = 0) {
  if (sinceId === 0) {
    // Return last 100 if no since provided
    return requests.slice(-100);
  }
  return requests.filter(r => r.id > sinceId);
}

// Get RPS data for charting
// windowMinutes: 1, 5, 15, or 60
export function getRpsData(windowMinutes = 5) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const cutoff = now - windowMs;
  
  // Determine bucket size based on window
  let bucketSeconds;
  if (windowMinutes <= 1) {
    bucketSeconds = 1; // 1 second buckets for 1 min view
  } else if (windowMinutes <= 5) {
    bucketSeconds = 5; // 5 second buckets for 5 min view
  } else if (windowMinutes <= 15) {
    bucketSeconds = 15; // 15 second buckets for 15 min view
  } else {
    bucketSeconds = 60; // 1 minute buckets for 1 hour view
  }
  
  const bucketMs = bucketSeconds * 1000;
  
  // Create buckets
  const buckets = new Map();
  const startBucket = Math.floor(cutoff / bucketMs) * bucketMs;
  const endBucket = Math.floor(now / bucketMs) * bucketMs;
  
  // Initialize all buckets with 0
  for (let ts = startBucket; ts <= endBucket; ts += bucketMs) {
    buckets.set(ts, 0);
  }
  
  // Fill buckets from history
  for (const entry of rpsHistory) {
    if (entry.timestamp >= cutoff) {
      const bucketTs = Math.floor(entry.timestamp / bucketMs) * bucketMs;
      if (buckets.has(bucketTs)) {
        buckets.set(bucketTs, buckets.get(bucketTs) + entry.count);
      }
    }
  }
  
  // Convert to array and calculate RPS (requests per second in that bucket)
  const data = [];
  for (const [ts, count] of buckets) {
    data.push({
      timestamp: ts,
      rps: count / bucketSeconds // Average RPS for this bucket
    });
  }
  
  // Calculate current RPS (last 10 seconds average)
  const last10s = rpsHistory.filter(e => e.timestamp >= now - 10000);
  const currentRps = last10s.reduce((sum, e) => sum + e.count, 0) / 10;
  
  // Calculate total requests in window
  const totalRequests = rpsHistory.filter(e => e.timestamp >= cutoff).reduce((sum, e) => sum + e.count, 0);
  
  // Calculate average RPS
  const avgRps = totalRequests / (windowMinutes * 60);
  
  // Calculate peak RPS (max in any bucket)
  const peakRps = Math.max(...data.map(d => d.rps), 0);
  
  return {
    data,
    stats: {
      current: Math.round(currentRps * 100) / 100,
      average: Math.round(avgRps * 100) / 100,
      peak: Math.round(peakRps * 100) / 100,
      total: totalRequests
    },
    bucketSeconds,
    windowMinutes
  };
}

export function requestLogger(req, res, next) {
  const path = req.originalUrl || req.path;
  
  // Skip logging for static files and admin pages
  if (!shouldLogRequest(path)) {
    return next();
  }
  
  const startTime = Date.now();

  // Override res.end to capture when response finishes
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    logRequest(req, res, duration);
    originalEnd.apply(res, args);
  };

  next();
}

export { requests as requestLog };

