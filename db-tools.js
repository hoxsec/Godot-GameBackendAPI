#!/usr/bin/env bun
/**
 * Database Tools
 * Utility script for managing the SQLite database
 * 
 * Usage:
 *   bun db-tools.js stats     - Show database statistics
 *   bun db-tools.js clear     - Clear all data (keeps schema)
 *   bun db-tools.js reset     - Reset database (drops & recreates)
 *   bun db-tools.js export    - Export data to JSON
 */

import { db, initializeDatabase } from './utils/database.js';
import fs from 'fs';

const command = process.argv[2];

function showStats() {
  console.log('\n📊 Database Statistics\n');
  
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const guestCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE type = "guest"').get();
  const registeredCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE type = "registered"').get();
  
  console.log(`Users: ${userCount.count} total`);
  console.log(`  - Guests: ${guestCount.count}`);
  console.log(`  - Registered: ${registeredCount.count}`);
  
  const kvCount = db.prepare('SELECT COUNT(*) as count FROM kv_store').get();
  const kvUsers = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM kv_store').get();
  console.log(`\nKey-Value Store: ${kvCount.count} entries across ${kvUsers.count} users`);
  
  const leaderboardCount = db.prepare('SELECT COUNT(*) as count FROM leaderboards').get();
  const leaderboardBoards = db.prepare('SELECT COUNT(DISTINCT board) as count FROM leaderboards').get();
  console.log(`\nLeaderboards: ${leaderboardCount.count} scores across ${leaderboardBoards.count} boards`);
  
  const boards = db.prepare('SELECT board, COUNT(*) as entries FROM leaderboards GROUP BY board').all();
  if (boards.length > 0) {
    console.log('\nLeaderboard breakdown:');
    boards.forEach(b => console.log(`  - ${b.board}: ${b.entries} entries`));
  }
  
  console.log('\n');
}

function clearData() {
  console.log('🗑️  Clearing all data...\n');
  
  const tables = ['refresh_tokens', 'leaderboards', 'kv_store', 'users'];
  
  db.exec('BEGIN TRANSACTION');
  try {
    for (const table of tables) {
      const result = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`✅ Cleared ${table}: ${result.changes} rows deleted`);
    }
    db.exec('COMMIT');
    console.log('\n✨ All data cleared successfully!\n');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('❌ Error clearing data:', error.message);
  }
}

function resetDatabase() {
  console.log('🔄 Resetting database...\n');
  
  // Drop all tables
  const tables = ['refresh_tokens', 'leaderboards', 'kv_store', 'users'];
  
  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
    console.log(`✅ Dropped table: ${table}`);
  }
  
  // Recreate schema
  console.log('\n📦 Recreating schema...\n');
  initializeDatabase();
  console.log('✨ Database reset complete!\n');
}

function exportData() {
  console.log('📤 Exporting database to JSON...\n');
  
  const data = {
    exported_at: new Date().toISOString(),
    users: db.prepare('SELECT * FROM users').all(),
    kv_store: db.prepare('SELECT * FROM kv_store').all(),
    leaderboards: db.prepare('SELECT * FROM leaderboards').all(),
  };
  
  const filename = `db-export-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  
  console.log(`✅ Data exported to: ${filename}`);
  console.log(`   - ${data.users.length} users`);
  console.log(`   - ${data.kv_store.length} KV entries`);
  console.log(`   - ${data.leaderboards.length} leaderboard entries\n`);
}

// Main command handler
switch (command) {
  case 'stats':
    showStats();
    break;
    
  case 'clear':
    clearData();
    break;
    
  case 'reset':
    console.log('⚠️  WARNING: This will delete ALL data and reset the database!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    resetDatabase();
    break;
    
  case 'export':
    exportData();
    break;
    
  default:
    console.log(`
🛠️  Database Tools

Usage:
  bun db-tools.js <command>

Commands:
  stats     - Show database statistics
  clear     - Clear all data (keeps schema)
  reset     - Reset database (drops & recreates tables)
  export    - Export all data to JSON file

Examples:
  bun db-tools.js stats
  bun db-tools.js export
    `);
}

// Close database connection
db.close();

