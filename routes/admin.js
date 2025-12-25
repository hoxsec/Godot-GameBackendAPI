import express from 'express';
import jwt from 'jsonwebtoken';
import { db, queries } from '../utils/database.js';
import { requestLog, getRecentRequests, getRpsData } from '../utils/requestLogger.js';

const router = express.Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-in-production';

// Admin JWT generation
function generateAdminToken(adminId, username) {
  return jwt.sign(
    { adminId, username, type: 'admin' },
    ADMIN_SECRET,
    { expiresIn: '24h' }
  );
}

// Verify admin token
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (decoded.type !== 'admin') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

// Admin authentication middleware
export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'unauthorized', message: 'Missing admin token' }
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyAdminToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: { code: 'unauthorized', message: 'Invalid or expired admin token' }
    });
  }

  req.adminId = decoded.adminId;
  req.adminUsername = decoded.username;
  next();
}

// POST /admin/login - Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Username and password required' }
    });
  }

  try {
    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    
    if (!admin || admin.password !== password) {
      return res.status(401).json({
        error: { code: 'unauthorized', message: 'Invalid credentials' }
      });
    }

    // Update last login
    db.prepare('UPDATE admin_users SET last_login = datetime("now") WHERE id = ?').run(admin.id);

    const token = generateAdminToken(admin.id, admin.username);
    console.log(`🔐 Admin logged in: ${username}`);

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      error: { code: 'server_error', message: 'Login failed' }
    });
  }
});

// GET /admin/me - Get current admin info
router.get('/me', authenticateAdmin, (req, res) => {
  try {
    const admin = db.prepare('SELECT id, username, role, created_at, last_login FROM admin_users WHERE id = ?').get(req.adminId);
    res.json({ admin });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get admin info' } });
  }
});

// GET /admin/stats - Dashboard stats
router.get('/stats', authenticateAdmin, (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const guestCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE type = "guest"').get();
    const registeredCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE type = "registered"').get();
    const bannedCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get();
    const kvCount = db.prepare('SELECT COUNT(*) as count FROM kv_store').get();
    const leaderboardCount = db.prepare('SELECT COUNT(DISTINCT board) as count FROM leaderboards').get();
    const scoreCount = db.prepare('SELECT COUNT(*) as count FROM leaderboards').get();

    res.json({
      users: {
        total: userCount.count,
        guests: guestCount.count,
        registered: registeredCount.count,
        banned: bannedCount.count
      },
      kv_entries: kvCount.count,
      leaderboards: leaderboardCount.count,
      scores: scoreCount.count
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get stats' } });
  }
});

// GET /admin/users - List all users
router.get('/users', authenticateAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    let query = 'SELECT id, email, type, banned, created_at FROM users';
    let params = [];
    
    if (search) {
      query += ' WHERE id LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get();

    res.json({ users, total: total.count, limit, offset });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get users' } });
  }
});

// PATCH /admin/users/:id/ban - Toggle ban status
router.patch('/users/:id/ban', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { banned } = req.body;

  try {
    const result = db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
    }

    console.log(`🚫 User ${id} ${banned ? 'banned' : 'unbanned'} by admin ${req.adminUsername}`);
    res.json({ ok: true, banned: !!banned });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to update ban status' } });
  }
});

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
    }

    console.log(`🗑️ User ${id} deleted by admin ${req.adminUsername}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to delete user' } });
  }
});

// GET /admin/users/:id - Get user details with all related data
router.get('/users/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;

  try {
    // Get user info
    const user = db.prepare('SELECT id, email, type, banned, created_at FROM users WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
    }

    // Get user's KV entries
    const kvEntries = db.prepare('SELECT key, value, version, updated_at FROM kv_store WHERE user_id = ? ORDER BY updated_at DESC').all(id);
    kvEntries.forEach(e => {
      try { e.value = JSON.parse(e.value); } catch {}
    });

    // Get user's leaderboard entries
    const leaderboardEntries = db.prepare(`
      SELECT board, score, submitted_at,
             (SELECT COUNT(*) + 1 FROM leaderboards l2 
              WHERE l2.board = l1.board AND l2.score > l1.score) as rank
      FROM leaderboards l1
      WHERE user_id = ?
      ORDER BY submitted_at DESC
    `).all(id);

    res.json({
      user,
      kv_entries: kvEntries,
      leaderboard_entries: leaderboardEntries,
      stats: {
        kv_count: kvEntries.length,
        leaderboard_count: leaderboardEntries.length
      }
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get user details' } });
  }
});

// GET /admin/kv - List all KV entries
router.get('/kv', authenticateAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.query.user_id;

    let query = 'SELECT user_id, key, value, version, updated_at FROM kv_store';
    let params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM kv_store').get();

    // Parse JSON values
    entries.forEach(e => {
      try { e.value = JSON.parse(e.value); } catch {}
    });

    res.json({ entries, total: total.count, limit, offset });
  } catch (error) {
    console.error('KV list error:', error);
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get KV entries' } });
  }
});

// DELETE /admin/kv/:userId/:key - Delete KV entry
router.delete('/kv/:userId/:key', authenticateAdmin, (req, res) => {
  const { userId, key } = req.params;

  try {
    const result = db.prepare('DELETE FROM kv_store WHERE user_id = ? AND key = ?').run(userId, key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'KV entry not found' } });
    }

    console.log(`🗑️ KV ${userId}/${key} deleted by admin ${req.adminUsername}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to delete KV entry' } });
  }
});

// GET /admin/leaderboards - List all leaderboards
router.get('/leaderboards', authenticateAdmin, (req, res) => {
  try {
    const boards = db.prepare(`
      SELECT board, COUNT(*) as entries, MAX(score) as top_score, MIN(score) as min_score
      FROM leaderboards GROUP BY board ORDER BY entries DESC
    `).all();

    res.json({ boards });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get leaderboards' } });
  }
});

// GET /admin/leaderboards/:board - Get leaderboard entries
router.get('/leaderboards/:board', authenticateAdmin, (req, res) => {
  const { board } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const entries = db.prepare(`
      SELECT id, user_id, score, submitted_at,
             ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM leaderboards WHERE board = ?
      ORDER BY score DESC LIMIT ? OFFSET ?
    `).all(board, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM leaderboards WHERE board = ?').get(board);

    res.json({ board, entries, total: total.count, limit, offset });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get leaderboard' } });
  }
});

// DELETE /admin/leaderboards/:board - Clear leaderboard
router.delete('/leaderboards/:board', authenticateAdmin, (req, res) => {
  const { board } = req.params;

  try {
    const result = db.prepare('DELETE FROM leaderboards WHERE board = ?').run(board);
    console.log(`🗑️ Leaderboard '${board}' cleared by admin ${req.adminUsername} (${result.changes} entries)`);
    res.json({ ok: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to clear leaderboard' } });
  }
});

// DELETE /admin/leaderboards/:board/:id - Delete single score entry
router.delete('/leaderboards/:board/:id', authenticateAdmin, (req, res) => {
  const { board, id } = req.params;

  try {
    const result = db.prepare('DELETE FROM leaderboards WHERE board = ? AND id = ?').run(board, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Score entry not found' } });
    }

    console.log(`🗑️ Score #${id} from '${board}' deleted by admin ${req.adminUsername}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to delete score' } });
  }
});

// GET /admin/requests - Get recent requests (live log)
router.get('/requests', authenticateAdmin, (req, res) => {
  try {
    const since = parseInt(req.query.since) || 0;
    const requests = getRecentRequests(since);
    res.json({ requests, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get requests' } });
  }
});

// GET /admin/rps - Get RPS chart data
router.get('/rps', authenticateAdmin, (req, res) => {
  try {
    const windowMinutes = parseInt(req.query.window) || 5;
    // Validate window
    const validWindows = [1, 5, 15, 60];
    const window = validWindows.includes(windowMinutes) ? windowMinutes : 5;
    
    const rpsData = getRpsData(window);
    res.json(rpsData);
  } catch (error) {
    console.error('RPS data error:', error);
    res.status(500).json({ error: { code: 'server_error', message: 'Failed to get RPS data' } });
  }
});

// GET /admin/endpoints - List all API endpoints
router.get('/endpoints', authenticateAdmin, (req, res) => {
  const endpoints = [
    { 
      method: 'GET', 
      path: '/health', 
      auth: false, 
      description: 'Health check',
      response: { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' }
    },
    { 
      method: 'GET', 
      path: '/v1/config', 
      auth: false, 
      description: 'Get remote configuration',
      queryParams: ['platform', 'app_version'],
      response: { config: {}, flags: {} }
    },
    { 
      method: 'POST', 
      path: '/v1/auth/guest', 
      auth: false, 
      description: 'Create guest session',
      response: { user_id: 'guest_xxx', access_token: '...', refresh_token: '...' }
    },
    { 
      method: 'POST', 
      path: '/v1/auth/register', 
      auth: false, 
      description: 'Register new user',
      body: { email: 'string', password: 'string' },
      response: { user_id: 'user_xxx', access_token: '...', refresh_token: '...' }
    },
    { 
      method: 'POST', 
      path: '/v1/auth/login', 
      auth: false, 
      description: 'Login existing user',
      body: { email: 'string', password: 'string' },
      response: { user_id: 'user_xxx', access_token: '...', refresh_token: '...' }
    },
    { 
      method: 'POST', 
      path: '/v1/auth/refresh', 
      auth: false, 
      description: 'Refresh access token',
      body: { refresh_token: 'string' },
      response: { access_token: '...', refresh_token: '...' }
    },
    { 
      method: 'POST', 
      path: '/v1/auth/logout', 
      auth: false, 
      description: 'Logout user',
      response: { ok: true }
    },
    { 
      method: 'GET', 
      path: '/v1/kv/:key', 
      auth: true, 
      description: 'Get KV value',
      response: { key: 'string', value: 'any', version: 1 }
    },
    { 
      method: 'PUT', 
      path: '/v1/kv/:key', 
      auth: true, 
      description: 'Set KV value',
      body: { value: 'any', expected_version: 'number (optional)' },
      response: { key: 'string', value: 'any', version: 1 }
    },
    { 
      method: 'DELETE', 
      path: '/v1/kv/:key', 
      auth: true, 
      description: 'Delete KV value',
      queryParams: ['expected_version'],
      response: { ok: true }
    },
    { 
      method: 'POST', 
      path: '/v1/leaderboards/:board/submit', 
      auth: true, 
      description: 'Submit score',
      body: { score: 'number' },
      response: { best_score: 1000, rank: 1 }
    },
    { 
      method: 'GET', 
      path: '/v1/leaderboards/:board/top', 
      auth: true, 
      description: 'Get top scores',
      queryParams: ['limit'],
      response: { entries: [{ user_id: '...', score: 1000, rank: 1 }] }
    },
    { 
      method: 'GET', 
      path: '/v1/leaderboards/:board/me', 
      auth: true, 
      description: 'Get user rank',
      response: { user_id: '...', score: 1000, rank: 1 }
    },
  ];

  res.json({ endpoints });
});

export default router;

