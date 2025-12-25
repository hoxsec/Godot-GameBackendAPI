import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import http from 'http';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import kvRoutes from './routes/kv.js';
import leaderboardRoutes from './routes/leaderboards.js';
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';
import { initializeDatabase } from './utils/database.js';
import { requestLogger, startRpsBroadcast } from './utils/requestLogger.js';
import { initWebSocket } from './utils/websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket server
initWebSocket(server);

// Start RPS broadcast interval
startRpsBroadcast();

// Initialize database
initializeDatabase();

// Middleware
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false,
}));


// Request logging for live console (skip admin polling requests)
app.use((req, res, next) => {
  // Skip logging for admin panel polling to avoid spam
  if (req.path.startsWith('/admin/requests') || req.path.startsWith('/admin/rps')) {
    return next();
  }
  requestLogger(req, res, next);
});

// Console logging (skip admin polling)
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin/requests') && !req.path.startsWith('/admin/rps')) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// Serve static files (css, js, etc.)
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Admin page routes (without .html extension)
const adminPages = ['login', 'dashboard', 'console', 'users', 'kv', 'leaderboards', 'endpoints'];
adminPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Legacy redirects (with .html)
app.get('/admin.html', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard.html', (req, res) => res.redirect('/dashboard'));
app.get('/login.html', (req, res) => res.redirect('/login'));
app.get('/console.html', (req, res) => res.redirect('/console'));
app.get('/users.html', (req, res) => res.redirect('/users'));
app.get('/kv.html', (req, res) => res.redirect('/kv'));
app.get('/leaderboards.html', (req, res) => res.redirect('/leaderboards'));
app.get('/endpoints.html', (req, res) => res.redirect('/endpoints'));

// Admin API routes
app.use('/admin', adminRoutes);

// API Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/kv', kvRoutes);
app.use('/v1/leaderboards', leaderboardRoutes);
app.use('/v1/config', configRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `Route ${req.path} not found`
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      code: 'server_error',
      message: err.message || 'Internal server error'
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   🎮 GameBackend API Server                                ║');
  console.log('║                                                            ║');
  console.log(`║   📡 API:       http://localhost:${PORT}                      ║`);
  console.log(`║   🔧 Admin:     http://localhost:${PORT}/dashboard             ║`);
  console.log(`║   💚 Health:    http://localhost:${PORT}/health               ║`);
  console.log(`║   🔌 WebSocket: ws://localhost:${PORT}/ws/admin               ║`);
  console.log('║                                                            ║');
  console.log('║   Admin Pages:                                             ║');
  console.log('║   • /dashboard    - Overview & Stats                       ║');
  console.log('║   • /console      - Live Request Console                   ║');
  console.log('║   • /users        - User Management                        ║');
  console.log('║   • /kv           - KV Store Viewer                        ║');
  console.log('║   • /leaderboards - Leaderboards                           ║');
  console.log('║   • /endpoints    - API Tester                             ║');
  console.log('║                                                            ║');
  console.log('║   Default admin: admin / admin123                          ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});
