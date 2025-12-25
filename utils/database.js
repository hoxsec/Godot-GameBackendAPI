import { Database } from 'bun:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'game.db');

// Initialize database
export const db = new Database(dbPath, { create: true });

// Enable foreign keys for data integrity
db.exec('PRAGMA foreign_keys = ON;');

// Auto-initialize schema on first load
function ensureSchema() {
  // Check if tables exist
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!tableCheck) {
    initializeDatabaseSchema();
  }
}

// Initialize database schema
export function initializeDatabase() {
  initializeDatabaseSchema();
}

function initializeDatabaseSchema() {
  console.log('📦 Initializing database...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      type TEXT NOT NULL CHECK(type IN ('guest', 'registered')),
      banned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Indexes for users
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
  `);

  // KV Store table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Indexes for KV store
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kv_user_id ON kv_store(user_id);
  `);

  // Leaderboards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board TEXT NOT NULL,
      user_id TEXT NOT NULL,
      score REAL NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(board, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Indexes for leaderboards
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leaderboards_board ON leaderboards(board);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_board_score ON leaderboards(board, score DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_user_id ON leaderboards(user_id);
  `);

  // Refresh tokens table (for token blacklisting/tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Indexes for refresh tokens
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  `);

  // Admin users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );
  `);

  // Create default admin user if none exists
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
  if (adminExists.count === 0) {
    db.prepare('INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)').run('admin', 'admin123', 'superadmin');
    console.log('🔐 Default admin created: admin / admin123');
  }

  console.log('✅ Database initialized successfully');
  console.log(`📄 Database location: ${dbPath}`);
}

// Ensure schema exists before preparing statements
ensureSchema();

// Prepared statements for better performance
export const queries = {
  // Users
  createUser: db.prepare('INSERT INTO users (id, email, password, type) VALUES (?, ?, ?, ?)'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  
  // KV Store
  getKV: db.prepare('SELECT key, value, version FROM kv_store WHERE user_id = ? AND key = ?'),
  setKV: db.prepare(`
    INSERT INTO kv_store (user_id, key, value, version, updated_at) 
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, key) 
    DO UPDATE SET value = excluded.value, version = excluded.version, updated_at = datetime('now')
  `),
  deleteKV: db.prepare('DELETE FROM kv_store WHERE user_id = ? AND key = ?'),
  getKVWithVersion: db.prepare('SELECT version FROM kv_store WHERE user_id = ? AND key = ?'),
  
  // Leaderboards
  submitScore: db.prepare(`
    INSERT INTO leaderboards (board, user_id, score, submitted_at) 
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(board, user_id) 
    DO UPDATE SET score = excluded.score, submitted_at = datetime('now')
    WHERE excluded.score > score
  `),
  getTopScores: db.prepare(`
    SELECT user_id, score,
           ROW_NUMBER() OVER (ORDER BY score DESC) as rank
    FROM leaderboards
    WHERE board = ?
    ORDER BY score DESC
    LIMIT ?
  `),
  getUserRank: db.prepare(`
    SELECT user_id, score,
           (SELECT COUNT(*) + 1 FROM leaderboards l2 
            WHERE l2.board = l1.board AND l2.score > l1.score) as rank
    FROM leaderboards l1
    WHERE board = ? AND user_id = ?
  `),
  getUserScore: db.prepare('SELECT score FROM leaderboards WHERE board = ? AND user_id = ?'),
  
  // Refresh tokens
  saveRefreshToken: db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
    VALUES (?, ?, ?)
  `),
  getRefreshToken: db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0'),
  revokeRefreshToken: db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?'),
};

// Helper function to run queries in a transaction
export function transaction(callback) {
  const txn = db.transaction(callback);
  return txn;
}

// Graceful shutdown
export function closeDatabase() {
  db.close();
  console.log('🔒 Database connection closed');
}

process.on('beforeExit', closeDatabase);
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

