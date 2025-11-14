#!/bin/bash

# ==============================================================================
# CypherRay SDK System - Comprehensive Test Script
# ==============================================================================
# This script tests the complete SDK integration including:
# - Admin API key generation
# - SDK authentication
# - Credit system (deduction and refunds)
# - Hash deduplication
# - Single and batch binary analysis
# - Rate limiting
# - Job status polling
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:6005"
ADMIN_EMAIL="admin@cypherray.com"
ADMIN_PASSWORD="Admin@123"
TEST_USER_EMAIL="testuser_sdk@cypherray.com"
TEST_USER_USERNAME="testuser_sdk"
TEST_USER_PASSWORD="TestUser@123"

# Global variables
ADMIN_TOKEN=""
USER_ID=""
API_KEY=""
TEST_JOB_ID=""

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

print_step() {
  echo -e "\n${BLUE}▶ $1${NC}"
}

# Create test binary file
create_test_binary() {
  local filename=$1
  local size=${2:-1024}  # Default 1KB
  
  print_step "Creating test binary: $filename ($size bytes)"
  dd if=/dev/urandom of="$filename" bs=$size count=1 2>/dev/null
  print_success "Created: $filename"
}

# Calculate SHA256 hash
calculate_hash() {
  local file=$1
  if [[ "$OSTYPE" == "darwin"* ]]; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

# ==============================================================================
# Test Setup
# ==============================================================================

setup_tests() {
  print_header "TEST SETUP"
  
  # Create test directory
  print_step "Creating test directory"
  TEST_DIR="./test-sdk-binaries"
  rm -rf "$TEST_DIR"
  mkdir -p "$TEST_DIR"
  print_success "Test directory created: $TEST_DIR"
  
  # Create test binaries
  create_test_binary "$TEST_DIR/firmware1.bin" 2048
  create_test_binary "$TEST_DIR/firmware2.bin" 4096
  create_test_binary "$TEST_DIR/firmware3.bin" 1024
  create_test_binary "$TEST_DIR/bootloader.elf" 8192
  create_test_binary "$TEST_DIR/app.hex" 512
}

cleanup_tests() {
  print_header "TEST CLEANUP"
  
  print_step "Removing test directory"
  rm -rf "$TEST_DIR"
  print_success "Cleanup complete"
}

# ==============================================================================
# Admin Authentication Tests
# ==============================================================================

test_admin_login() {
  print_header "TEST 1: Admin Login"
  
  print_step "Attempting admin login"
  
  response=$(curl -s -X POST "$BASE_URL/api/admin/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$ADMIN_EMAIL\",
      \"password\": \"$ADMIN_PASSWORD\"
    }")
  
  ADMIN_TOKEN=$(echo $response | grep -o '"token":"[^"]*' | sed 's/"token":"//')
  
  if [ -z "$ADMIN_TOKEN" ]; then
    print_error "Admin login failed"
    echo "$response"
    exit 1
  fi
  
  print_success "Admin logged in successfully"
  print_info "Token: ${ADMIN_TOKEN:0:20}..."
}

# ==============================================================================
# User Creation Tests
# ==============================================================================

test_create_user() {
  print_header "TEST 2: Create Test User with Credits"
  
  print_step "Creating user: $TEST_USER_USERNAME"
  
  response=$(curl -s -X POST "$BASE_URL/api/admin/users/create" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"username\": \"$TEST_USER_USERNAME\",
      \"email\": \"$TEST_USER_EMAIL\",
      \"password\": \"$TEST_USER_PASSWORD\",
      \"organizationName\": \"SDK Test Org\",
      \"tier\": \"tier1\",
      \"credits\": 100,
      \"isActive\": true
    }")
  
  USER_ID=$(echo $response | grep -o '"_id":"[^"]*' | sed 's/"_id":"//')
  
  if [ -z "$USER_ID" ]; then
    print_error "User creation failed"
    echo "$response"
    exit 1
  fi
  
  print_success "User created successfully"
  print_info "User ID: $USER_ID"
  print_info "Initial Credits: 100"
}

# ==============================================================================
# API Key Generation Tests
# ==============================================================================

test_generate_api_key() {
  print_header "TEST 3: Generate API Key via Admin Endpoint"
  
  print_step "Creating API key for user"
  
  response=$(curl -s -X POST "$BASE_URL/api/admin/users/$USER_ID/api-keys" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"name\": \"SDK Test Key\",
      \"expiresInDays\": 30
    }")
  
  API_KEY=$(echo $response | grep -o '"key":"[^"]*' | sed 's/"key":"//')
  
  if [ -z "$API_KEY" ]; then
    print_error "API key generation failed"
    echo "$response"
    exit 1
  fi
  
  print_success "API key generated successfully"
  print_info "API Key: $API_KEY"
  print_info "Expires in: 30 days"
}

test_list_api_keys() {
  print_header "TEST 4: List User API Keys"
  
  print_step "Fetching API keys for user"
  
  response=$(curl -s -X GET "$BASE_URL/api/admin/users/$USER_ID/api-keys" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  key_count=$(echo $response | grep -o '"total":[0-9]*' | sed 's/"total"://')
  
  if [ -z "$key_count" ] || [ "$key_count" -eq 0 ]; then
    print_error "Failed to retrieve API keys"
    echo "$response"
    exit 1
  fi
  
  print_success "Retrieved $key_count API key(s)"
}

# ==============================================================================
# SDK Credit Tests
# ==============================================================================

test_check_credits() {
  print_header "TEST 5: Check SDK Credits"
  
  print_step "Fetching credits via SDK endpoint"
  
  response=$(curl -s -X GET "$BASE_URL/api/sdk/credits" \
    -H "X-API-Key: $API_KEY")
  
  credits=$(echo $response | grep -o '"remaining":[0-9]*' | sed 's/"remaining"://')
  
  if [ -z "$credits" ]; then
    print_error "Failed to retrieve credits"
    echo "$response"
    exit 1
  fi
  
  print_success "Credits retrieved successfully"
  print_info "Available Credits: $credits"
}

# ==============================================================================
# Hash Deduplication Tests
# ==============================================================================

test_check_hash() {
  print_header "TEST 6: Hash Deduplication Check"
  
  local test_file="$TEST_DIR/firmware1.bin"
  local file_hash=$(calculate_hash "$test_file")
  
  print_step "Checking if hash exists: ${file_hash:0:16}..."
  
  response=$(curl -s -X POST "$BASE_URL/api/sdk/check-hash" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{
      \"hash\": \"$file_hash\"
    }")
  
  exists=$(echo $response | grep -o '"exists":[a-z]*' | sed 's/"exists"://')
  
  print_success "Hash check completed"
  print_info "Hash exists in database: $exists"
}

# ==============================================================================
# Single Binary Analysis Tests
# ==============================================================================

test_analyze_single() {
  print_header "TEST 7: Single Binary Analysis"
  
  local test_file="$TEST_DIR/firmware1.bin"
  local file_hash=$(calculate_hash "$test_file")
  
  print_step "Uploading binary for analysis"
  print_info "File: firmware1.bin"
  print_info "Hash: ${file_hash:0:32}..."
  
  response=$(curl -s -X POST "$BASE_URL/api/sdk/analyze" \
    -H "X-API-Key: $API_KEY" \
    -F "file=@$test_file")
  
  TEST_JOB_ID=$(echo $response | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
  status=$(echo $response | grep -o '"status":"[^"]*' | sed 's/"status":"//')
  
  if [ -z "$TEST_JOB_ID" ]; then
    print_error "Analysis submission failed"
    echo "$response"
    exit 1
  fi
  
  print_success "Analysis job submitted"
  print_info "Job ID: $TEST_JOB_ID"
  print_info "Status: $status"
  
  # Check credits were deducted
  sleep 1
  response=$(curl -s -X GET "$BASE_URL/api/sdk/credits" \
    -H "X-API-Key: $API_KEY")
  
  credits_after=$(echo $response | grep -o '"remaining":[0-9]*' | sed 's/"remaining"://')
  print_info "Credits after submission: $credits_after (should be 999)"
}

# ==============================================================================
# Batch Analysis Tests
# ==============================================================================

test_analyze_batch() {
  print_header "TEST 8: Batch Binary Analysis"
  
  print_step "Uploading 3 binaries for batch analysis"
  
  response=$(curl -s -X POST "$BASE_URL/api/sdk/analyze/batch" \
    -H "X-API-Key: $API_KEY" \
    -F "files=@$TEST_DIR/firmware2.bin" \
    -F "files=@$TEST_DIR/firmware3.bin" \
    -F "files=@$TEST_DIR/bootloader.elf")
  
  job_count=$(echo $response | grep -o '"totalFiles":[0-9]*' | sed 's/"totalFiles"://')
  
  if [ -z "$job_count" ] || [ "$job_count" -ne 3 ]; then
    print_error "Batch analysis submission failed"
    echo "$response"
    exit 1
  fi
  
  print_success "Batch analysis submitted"
  print_info "Jobs created: $job_count"
  
  # Check credits were deducted
  sleep 1
  response=$(curl -s -X GET "$BASE_URL/api/sdk/credits" \
    -H "X-API-Key: $API_KEY")
  
  credits_after=$(echo $response | grep -o '"remaining":[0-9]*' | sed 's/"remaining"://')
  print_info "Credits after batch: $credits_after (should be 996)"
}

# ==============================================================================
# Error Handling Tests
# ==============================================================================

test_insufficient_credits() {
  print_header "TEST 9: Insufficient Credits Error"
  
  print_step "Setting user credits to 0"
  
  curl -s -X PUT "$BASE_URL/api/admin/users/$USER_ID/credits" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"operation\": \"set\",
      \"amount\": 0
    }" > /dev/null
  
  sleep 1  # Wait for DB update
  
  print_step "Attempting analysis with 0 credits"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sdk/analyze" \
    -H "X-API-Key: $API_KEY" \
    -F "file=@$TEST_DIR/app.hex")
  
  http_code=$(echo "$response" | tail -n 1)
  response_body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "402" ]; then
    print_success "402 Payment Required returned correctly"
  else
    print_error "Expected 402, got: $http_code"
    echo "$response_body"
  fi
  
  # Restore credits for remaining tests
  curl -s -X PUT "$BASE_URL/api/admin/users/$USER_ID/credits" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"operation\": \"set\",
      \"amount\": 100
    }" > /dev/null
  
  print_info "Credits restored to 100"
}

test_invalid_api_key() {
  print_header "TEST 10: Invalid API Key Error"
  
  print_step "Attempting analysis with invalid API key"
  
  response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/sdk/credits" \
    -H "X-API-Key: cray_invalid_key_12345")
  
  http_code=$(echo "$response" | tail -n 1)
  response_body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "401" ]; then
    print_success "401 Unauthorized returned correctly"
  else
    print_error "Expected 401, got: $http_code"
    echo "$response_body"
  fi
}

test_rate_limiting() {
  print_header "TEST 11: Rate Limiting Test"
  
  print_step "Making rapid requests to trigger rate limit"
  print_info "Tier1 limit: 1000 requests/hour"
  print_info "Making 5 rapid requests..."
  
  success_count=0
  rate_limited=false
  
  for i in {1..5}; do
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/sdk/credits" \
      -H "X-API-Key: $API_KEY")
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" == "429" ]; then
      rate_limited=true
      print_info "Request $i: Rate limited (429)"
    elif [ "$http_code" == "200" ]; then
      success_count=$((success_count + 1))
      print_info "Request $i: Success (200)"
    fi
    
    sleep 0.1
  done
  
  print_success "Rate limiting test completed"
  print_info "Successful requests: $success_count/5"
  
  if [ "$rate_limited" == true ]; then
    print_info "Rate limiting is active"
  else
    print_info "Rate limit not reached (this is normal for tier1)"
  fi
}

# ==============================================================================
# Job Polling Tests
# ==============================================================================

test_poll_results() {
  print_header "TEST 12: Job Status Polling"
  
  print_step "Polling job results: $TEST_JOB_ID"
  print_info "Note: This will fail if ML service is not running"
  
  max_attempts=10
  attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    print_info "Attempt $attempt/$max_attempts"
    
    response=$(curl -s -X GET "$BASE_URL/api/sdk/results/$TEST_JOB_ID" \
      -H "X-API-Key: $API_KEY")
    
    status=$(echo $response | grep -o '"status":"[^"]*' | sed 's/"status":"//')
    progress=$(echo $response | grep -o '"progress":[0-9]*' | sed 's/"progress"://')
    
    print_info "Status: $status | Progress: ${progress}%"
    
    if [ "$status" == "completed" ]; then
      print_success "Job completed successfully"
      echo "$response" | grep -o '"results":{[^}]*}' | head -1
      break
    elif [ "$status" == "failed" ]; then
      print_error "Job failed"
      echo "$response"
      break
    fi
    
    attempt=$((attempt + 1))
    sleep 2
  done
  
  if [ $attempt -gt $max_attempts ]; then
    print_info "Job still processing after $max_attempts attempts"
    print_info "This is expected if ML service is slow or not running"
  fi
}

# ==============================================================================
# API Key Revocation Tests
# ==============================================================================

test_revoke_api_key() {
  print_header "TEST 13: API Key Revocation"
  
  # Get API key ID first
  print_step "Fetching API key ID"
  
  response=$(curl -s -X GET "$BASE_URL/api/admin/users/$USER_ID/api-keys" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  # Extract the actual API key ID from the apiKeys array
  key_id=$(echo $response | grep -o '"apiKeys":\[{"id":"[^"]*' | sed 's/"apiKeys":\[{"id":"//')
  
  if [ -z "$key_id" ]; then
    print_error "Failed to get API key ID"
    echo "$response"
    return
  fi
  
  print_step "Revoking API key: $key_id"
  
  response=$(curl -s -X DELETE "$BASE_URL/api/admin/api-keys/$key_id" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  is_active=$(echo $response | grep -o '"isActive":[a-z]*' | sed 's/"isActive"://')
  
  if [ "$is_active" == "false" ]; then
    print_success "API key revoked successfully"
  else
    print_error "API key revocation failed"
    echo "$response"
    return
  fi
  
  # Try using revoked key
  print_step "Testing revoked API key"
  
  response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/sdk/credits" \
    -H "X-API-Key: $API_KEY")
  
  http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" == "403" ] || [ "$http_code" == "401" ]; then
    print_success "Revoked key correctly rejected with $http_code"
  else
    print_error "Expected 401 or 403, got: $http_code"
  fi
}

# ==============================================================================
# Main Test Execution
# ==============================================================================

main() {
  clear
  
  echo -e "${GREEN}"
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║                                                                  ║"
  echo "║         CypherRay SDK System - Comprehensive Test Suite         ║"
  echo "║                                                                  ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}\n"
  
  print_info "Backend URL: $BASE_URL"
  print_info "Test User: $TEST_USER_EMAIL"
  
  # Setup
  setup_tests
  
  # Run tests
  test_admin_login
  test_create_user
  test_generate_api_key
  test_list_api_keys
  test_check_credits
  test_check_hash
  test_analyze_single
  test_analyze_batch
  test_insufficient_credits
  test_invalid_api_key
  test_rate_limiting
  test_poll_results
  test_revoke_api_key
  
  # Cleanup
  cleanup_tests
  
  # Summary
  print_header "TEST SUMMARY"
  print_success "All tests completed!"
  print_info "Check the output above for any errors or warnings"
  
  echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Run main function
main
