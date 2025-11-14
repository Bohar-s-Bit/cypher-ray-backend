#!/bin/bash

# ==============================================================================
# CypherRay Complete Cleanup Script
# ==============================================================================
# This script removes ALL data except admin user:
# - MongoDB: Users, API keys, Jobs, Credit transactions (except admin)
# - Redis: All cache and queue data
# - File System: Uploaded binary files
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                  ║${NC}"
echo -e "${CYAN}║           CypherRay Complete System Cleanup                      ║${NC}"
echo -e "${CYAN}║                                                                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}⚠️  This will remove:${NC}"
echo -e "  ${RED}✗${NC} All non-admin users"
echo -e "  ${RED}✗${NC} All API keys"
echo -e "  ${RED}✗${NC} All analysis jobs (cache cleared)"
echo -e "  ${RED}✗${NC} All credit transactions"
echo -e "  ${RED}✗${NC} All Redis cache & queue data"
echo -e "  ${RED}✗${NC} All uploaded binary files"
echo -e "  ${RED}✗${NC} All SDK local cache (.cypherray-cache)"
echo -e "\n${GREEN}✓${NC} Admin user will be preserved\n"

# Ask for confirmation
read -p "$(echo -e ${YELLOW}Are you sure you want to continue? \(y/N\): ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Cleanup cancelled${NC}\n"
    exit 0
fi

echo -e "\n${BLUE}Starting cleanup...${NC}\n"

# ==============================================================================
# Step 1: Clear Redis
# ==============================================================================

echo -e "${BLUE}▶ Step 1/4: Clearing Redis cache & queue data${NC}"

if command -v redis-cli &> /dev/null; then
    redis-cli FLUSHALL > /dev/null 2>&1
    echo -e "${GREEN}  ✓ Redis cleared (all keys removed)${NC}"
else
    echo -e "${YELLOW}  ⚠ Redis CLI not found, skipping Redis cleanup${NC}"
fi

# ==============================================================================
# Step 2: Clear MongoDB (except admin)
# ==============================================================================

echo -e "\n${BLUE}▶ Step 2/4: Clearing MongoDB data${NC}"

node -e "
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cypher_ray';

mongoose.connect(MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // 1. Delete all non-admin users
  const usersResult = await db.collection('users').deleteMany({ 
    userType: { \$ne: 'admin' } 
  });
  console.log('  ✓ Deleted', usersResult.deletedCount, 'non-admin users');
  
  // 2. Delete all API keys
  const apiKeysResult = await db.collection('apikeys').deleteMany({});
  console.log('  ✓ Deleted', apiKeysResult.deletedCount, 'API keys');
  
  // 3. Delete all analysis jobs (THIS CLEARS THE CACHE)
  const jobsResult = await db.collection('analysisjobs').deleteMany({});
  console.log('  ✓ Deleted', jobsResult.deletedCount, 'analysis jobs (cache cleared)');
  
  // 4. Delete all credit transactions (except admin's)
  const adminUser = await db.collection('users').findOne({ userType: 'admin' });
  const creditsResult = await db.collection('credittransactions').deleteMany({
    userId: { \$ne: adminUser._id }
  });
  console.log('  ✓ Deleted', creditsResult.deletedCount, 'credit transactions');
  
  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('MongoDB Error:', err.message);
  process.exit(1);
});
"

# ==============================================================================
# Step 3: Clear uploaded files
# ==============================================================================

echo -e "\n${BLUE}▶ Step 3/4: Clearing uploaded binary files${NC}"

UPLOAD_DIR="./uploads/sdk"

if [ -d "$UPLOAD_DIR" ]; then
    FILE_COUNT=$(find "$UPLOAD_DIR" -type f | wc -l | xargs)
    
    if [ "$FILE_COUNT" -gt 0 ]; then
        find "$UPLOAD_DIR" -type f -delete
        echo -e "${GREEN}  ✓ Deleted $FILE_COUNT uploaded files${NC}"
    else
        echo -e "${YELLOW}  ℹ No files to delete${NC}"
    fi
else
    echo -e "${YELLOW}  ℹ Upload directory doesn't exist${NC}"
fi

# ==============================================================================
# Step 4: Clear SDK local cache
# ==============================================================================

echo -e "\n${BLUE}▶ Step 4/5: Clearing SDK local cache${NC}"

# Clear cache in cypherray-test project
TEST_CACHE="../cypherray-test/.cypherray-cache"
if [ -d "$TEST_CACHE" ]; then
    CACHE_FILES=$(find "$TEST_CACHE" -type f | wc -l | xargs)
    rm -rf "$TEST_CACHE"
    echo -e "${GREEN}  ✓ Deleted SDK cache from cypherray-test ($CACHE_FILES files)${NC}"
else
    echo -e "${YELLOW}  ℹ No SDK cache in cypherray-test${NC}"
fi

# Clear cache in current directory (if SDK used here)
if [ -d ".cypherray-cache" ]; then
    rm -rf ".cypherray-cache"
    echo -e "${GREEN}  ✓ Deleted SDK cache from current directory${NC}"
fi

# Clear cache in cypherray-sdk directory
SDK_CACHE="../cypherray-sdk/.cypherray-cache"
if [ -d "$SDK_CACHE" ]; then
    rm -rf "$SDK_CACHE"
    echo -e "${GREEN}  ✓ Deleted SDK cache from cypherray-sdk${NC}"
fi

# ==============================================================================
# Step 5: Verify cleanup
# ==============================================================================

echo -e "\n${BLUE}▶ Step 5/5: Verifying cleanup${NC}"

# Check Redis
if command -v redis-cli &> /dev/null; then
    REDIS_KEYS=$(redis-cli DBSIZE | grep -o '[0-9]*')
    echo -e "${GREEN}  ✓ Redis keys remaining: $REDIS_KEYS (should be 0-1)${NC}"
fi

# Check MongoDB
node -e "
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cypher_ray';

mongoose.connect(MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const usersCount = await db.collection('users').countDocuments();
  const adminCount = await db.collection('users').countDocuments({ userType: 'admin' });
  const apiKeysCount = await db.collection('apikeys').countDocuments();
  const jobsCount = await db.collection('analysisjobs').countDocuments();
  
  console.log('  ✓ Users remaining:', usersCount, '(Admin:', adminCount + ')');
  console.log('  ✓ API keys remaining:', apiKeysCount);
  console.log('  ✓ Analysis jobs remaining:', jobsCount);
  
  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Verification Error:', err.message);
  process.exit(1);
});
"

# ==============================================================================
# Summary
# ==============================================================================

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║                  ✓ Cleanup Completed!                            ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "\n${CYAN}System is now in clean state:${NC}"
echo -e "  ${GREEN}✓${NC} All cache cleared (MongoDB + Redis + SDK local)"
echo -e "  ${GREEN}✓${NC} All test data removed"
echo -e "  ${GREEN}✓${NC} All uploaded files deleted"
echo -e "  ${GREEN}✓${NC} Admin user preserved"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Create a test user and API key"
echo -e "  2. Run your tests/demo"
echo -e "\n${BLUE}💡 Tip:${NC} Use ${CYAN}./test-sdk-system.sh${NC} or ${CYAN}cd cypherray-test && ./setup-and-test.sh${NC}\n"
