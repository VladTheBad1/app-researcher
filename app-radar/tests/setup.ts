import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { database } from '../src/database/index.js';
import { browserManager } from '../src/utils/browser.js';

// Test database path
const TEST_DB_PATH = './tests/test-opportunities.db';

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.LOG_LEVEL = 'error';
  process.env.HEADLESS = 'true';
  
  // Ensure test directories exist
  const testDirs = ['./tests/data', './tests/logs'];
  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
});

afterAll(async () => {
  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  // Clean up test directories
  const testDirs = ['./tests/data', './tests/logs'];
  for (const dir of testDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

beforeEach(async () => {
  // Clean database before each test
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

afterEach(async () => {
  // Clean up after each test
  try {
    await database.close();
  } catch (error) {
    // Ignore cleanup errors
  }
  
  try {
    await browserManager.shutdown();
  } catch (error) {
    // Ignore cleanup errors
  }
});