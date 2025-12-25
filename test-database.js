#!/usr/bin/env bun
/**
 * Database Test Script
 * Tests all database operations to ensure everything is working
 */

import { initializeDatabase, queries, db } from './utils/database.js';

console.log('🧪 Testing Database Operations\n');

// Initialize database
console.log('1️⃣  Initializing database...');
initializeDatabase();
console.log('✅ Database initialized\n');

// Test 1: Create users
console.log('2️⃣  Testing user creation...');
try {
  const guestId = `guest_test_${Date.now()}`;
  const userId = `user_test_${Date.now()}`;
  
  queries.createUser.run(guestId, null, null, 'guest');
  queries.createUser.run(userId, 'test@example.com', 'password123', 'registered');
  
  const guest = queries.getUserById.get(guestId);
  const user = queries.getUserByEmail.get('test@example.com');
  
  console.log(`✅ Created guest: ${guest.id}`);
  console.log(`✅ Created user: ${user.id} (${user.email})`);
  console.log('');
} catch (error) {
  console.error('❌ User creation failed:', error.message);
  process.exit(1);
}

// Test 2: KV Store
console.log('3️⃣  Testing KV store...');
try {
  const testUserId = `user_kv_test_${Date.now()}`;
  queries.createUser.run(testUserId, null, null, 'guest');
  
  // Set value
  const testData = JSON.stringify({ level: 5, coins: 100 });
  queries.setKV.run(testUserId, 'player_data', testData, 1);
  
  // Get value
  const result = queries.getKV.get(testUserId, 'player_data');
  const parsed = JSON.parse(result.value);
  
  console.log(`✅ Stored KV: ${result.key} (v${result.version})`);
  console.log(`✅ Retrieved data: level=${parsed.level}, coins=${parsed.coins}`);
  
  // Update value
  const updatedData = JSON.stringify({ level: 10, coins: 500 });
  queries.setKV.run(testUserId, 'player_data', updatedData, 2);
  
  const updated = queries.getKV.get(testUserId, 'player_data');
  console.log(`✅ Updated KV version: ${updated.version}`);
  
  // Delete value
  queries.deleteKV.run(testUserId, 'player_data');
  const deleted = queries.getKV.get(testUserId, 'player_data');
  console.log(`✅ Deleted KV: ${!deleted ? 'success' : 'failed'}`);
  console.log('');
} catch (error) {
  console.error('❌ KV store test failed:', error.message);
  process.exit(1);
}

// Test 3: Leaderboards
console.log('4️⃣  Testing leaderboards...');
try {
  const user1 = `user_lb1_${Date.now()}`;
  const user2 = `user_lb2_${Date.now()}`;
  const user3 = `user_lb3_${Date.now()}`;
  
  queries.createUser.run(user1, null, null, 'guest');
  queries.createUser.run(user2, null, null, 'guest');
  queries.createUser.run(user3, null, null, 'guest');
  
  // Submit scores
  queries.submitScore.run('test_board', user1, 1000);
  queries.submitScore.run('test_board', user2, 2000);
  queries.submitScore.run('test_board', user3, 1500);
  
  console.log('✅ Submitted 3 scores');
  
  // Get top scores
  const topScores = queries.getTopScores.all('test_board', 10);
  console.log(`✅ Top scores retrieved: ${topScores.length} entries`);
  console.log('   Leaderboard:');
  topScores.forEach(entry => {
    console.log(`   #${entry.rank}: ${entry.user_id.substring(0, 20)}... - ${entry.score} points`);
  });
  
  // Get user rank
  const userRank = queries.getUserRank.get('test_board', user2);
  console.log(`✅ User rank: #${userRank.rank} with ${userRank.score} points`);
  console.log('');
} catch (error) {
  console.error('❌ Leaderboard test failed:', error.message);
  console.error(error);
  process.exit(1);
}

// Test 4: Database stats
console.log('5️⃣  Database statistics...');
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
const kvCount = db.prepare('SELECT COUNT(*) as count FROM kv_store').get();
const lbCount = db.prepare('SELECT COUNT(*) as count FROM leaderboards').get();

console.log(`✅ Total users: ${userCount.count}`);
console.log(`✅ Total KV entries: ${kvCount.count}`);
console.log(`✅ Total leaderboard entries: ${lbCount.count}`);
console.log('');

console.log('✨ All tests passed! Database is working correctly.\n');

// Close database
db.close();

