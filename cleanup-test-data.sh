#!/bin/bash

# ==============================================================================
# CypherRay Test Data Cleanup Script
# ==============================================================================
# This script cleans up all test data from the database and file system
# Run this after failed tests or to reset the test environment
# ==============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                                                                  ║${NC}"
echo -e "${YELLOW}║           CypherRay Test Data Cleanup                            ║${NC}"
echo -e "${YELLOW}║                                                                  ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${NC}\n"

# Run the Node.js cleanup script
node cleanup-test-data.js

# Remove test binaries directory
if [ -d "./test-sdk-binaries" ]; then
  echo -e "${BLUE}🗑️  Removing test binaries directory...${NC}"
  rm -rf ./test-sdk-binaries
  echo -e "${GREEN}✓ Test binaries directory removed${NC}\n"
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All test data has been cleaned up!${NC}"
echo -e "${GREEN}  You can now run tests again with: ./test-sdk-system.sh${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
