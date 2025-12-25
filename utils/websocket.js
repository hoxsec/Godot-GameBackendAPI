// WebSocket handler for real-time dashboard updates
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { getRpsData } from './requestLogger.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-in-production';

let wss = null;
const clients = new Map(); // Map<WebSocket, { window: number }>

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws/admin' });
  
  wss.on('connection', (ws, req) => {
    // Parse token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!verifyAdminToken(token)) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    
    // Store client with default window preference
    clients.set(ws, { window: 5 });
    console.log(`📡 WebSocket client connected (${clients.size} total)`);
    
    // Send initial RPS data for default window
    const rpsData = getRpsData(5);
    ws.send(JSON.stringify({ type: 'rps', data: rpsData }));
    
    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'setWindow') {
          const validWindows = [1, 5, 15, 60];
          const window = validWindows.includes(message.window) ? message.window : 5;
          
          // Update client's window preference
          const clientData = clients.get(ws);
          if (clientData) {
            clientData.window = window;
          }
          
          // Send RPS data for new window immediately
          const rpsData = getRpsData(window);
          ws.send(JSON.stringify({ type: 'rps', data: rpsData }));
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`📡 WebSocket client disconnected (${clients.size} remaining)`);
    });
    
    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
    });
    
    // Handle ping/pong for keep-alive
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });
  
  // Heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(heartbeat);
  });
  
  console.log('📡 WebSocket server initialized on /ws/admin');
  return wss;
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    return decoded.type === 'admin';
  } catch {
    return false;
  }
}

// Broadcast to all connected clients
export function broadcast(type, data) {
  if (!wss) return;
  
  const message = JSON.stringify({ type, data });
  
  clients.forEach((clientData, client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Broadcast new request to all clients
export function broadcastRequest(request) {
  broadcast('request', request);
}

// Broadcast RPS data to each client with their preferred window
export function broadcastRpsUpdate() {
  if (!wss) return;
  
  // Group clients by window preference to avoid recalculating same data
  const windowGroups = new Map();
  
  clients.forEach((clientData, client) => {
    if (client.readyState === 1) {
      const window = clientData.window;
      if (!windowGroups.has(window)) {
        windowGroups.set(window, []);
      }
      windowGroups.get(window).push(client);
    }
  });
  
  // Send RPS data to each group
  windowGroups.forEach((clientList, window) => {
    const rpsData = getRpsData(window);
    const message = JSON.stringify({ type: 'rps', data: rpsData });
    
    clientList.forEach((client) => {
      client.send(message);
    });
  });
}

// Get connected client count
export function getClientCount() {
  return clients.size;
}
