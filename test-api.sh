#!/bin/bash

# Simple test script for GameBackend API
# Make sure the server is running on http://localhost:3000

API_URL="http://localhost:3000"

echo "🧪 Testing GameBackend API"
echo "=========================="
echo ""

# Test 1: Health Check
echo "1️⃣ Testing health endpoint..."
curl -s "$API_URL/health" | jq '.'
echo ""

# Test 2: Create Guest
echo "2️⃣ Creating guest session..."
GUEST_RESPONSE=$(curl -s -X POST "$API_URL/v1/auth/guest")
echo $GUEST_RESPONSE | jq '.'
ACCESS_TOKEN=$(echo $GUEST_RESPONSE | jq -r '.access_token')
USER_ID=$(echo $GUEST_RESPONSE | jq -r '.user_id')
echo "Access Token: $ACCESS_TOKEN"
echo "User ID: $USER_ID"
echo ""

# Test 3: Save Cloud Data
echo "3️⃣ Saving cloud data..."
curl -s -X PUT "$API_URL/v1/kv/test_data" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": {"level": 5, "coins": 100}}' | jq '.'
echo ""

# Test 4: Get Cloud Data
echo "4️⃣ Getting cloud data..."
curl -s -X GET "$API_URL/v1/kv/test_data" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test 5: Submit Score
echo "5️⃣ Submitting score..."
curl -s -X POST "$API_URL/v1/leaderboards/global/submit" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 1000}' | jq '.'
echo ""

# Test 6: Get Top Scores
echo "6️⃣ Getting top scores..."
curl -s "$API_URL/v1/leaderboards/global/top?limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test 7: Get Config
echo "7️⃣ Getting config..."
curl -s "$API_URL/v1/config?platform=windows&app_version=1.0.0" | jq '.'
echo ""

echo "✅ All tests completed!"

