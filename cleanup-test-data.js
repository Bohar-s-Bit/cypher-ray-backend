#!/usr/bin/env node

/**
 * Cleanup Test Data Script
 * 
 * This script removes all test data created during SDK testing.
 * Run this when tests fail or you want to reset the test environment.
 * 
 * Usage: node cleanup-test-data.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TEST_USER_EMAIL = 'testuser_sdk@cypherray.com';
const TEST_USER_USERNAME = 'testuser_sdk';

async function cleanupTestData() {
  try {
    console.log('\n🧹 Starting test data cleanup...\n');

    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cypher_ray';
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Find test user
    const usersCollection = db.collection('users');
    const testUser = await usersCollection.findOne({
      $or: [
        { email: TEST_USER_EMAIL },
        { username: TEST_USER_USERNAME }
      ]
    });

    if (!testUser) {
      console.log('ℹ No test user found. Database is clean.');
      await mongoose.connection.close();
      return;
    }

    console.log(`✓ Found test user: ${testUser.username} (${testUser._id})`);

    // 2. Delete API keys for test user
    const apiKeysCollection = db.collection('apikeys');
    const apiKeysResult = await apiKeysCollection.deleteMany({ userId: testUser._id });
    console.log(`✓ Deleted ${apiKeysResult.deletedCount} API key(s)`);

    // 3. Delete analysis jobs for test user
    const analysisJobsCollection = db.collection('analysisjobs');
    const jobsResult = await analysisJobsCollection.deleteMany({ userId: testUser._id });
    console.log(`✓ Deleted ${jobsResult.deletedCount} analysis job(s)`);

    // 4. Delete credit transactions for test user
    const creditTransactionsCollection = db.collection('credittransactions');
    const transactionsResult = await creditTransactionsCollection.deleteMany({ userId: testUser._id });
    console.log(`✓ Deleted ${transactionsResult.deletedCount} credit transaction(s)`);

    // 5. Delete test user
    const userResult = await usersCollection.deleteOne({ _id: testUser._id });
    console.log(`✓ Deleted test user: ${testUser.username}`);

    // 6. Delete test binaries from uploads directory
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'sdk');
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deletedFiles = 0;
      
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        fs.unlinkSync(filePath);
        deletedFiles++;
      });
      
      console.log(`✓ Deleted ${deletedFiles} uploaded binary file(s)`);
    }

    console.log('\n✅ Test data cleanup completed successfully!\n');

    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanupTestData();
