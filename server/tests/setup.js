/**
 * Jest Test Setup for Server Tests
 */

const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '../.test-data');
process.env.LOG_LEVEL = 'error';

// Clean up test database before each test suite
beforeAll(() => {
  const testDbPath = process.env.DB_PATH;
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { recursive: true });
  }
  fs.mkdirSync(testDbPath, { recursive: true });
});

// Clean up after all tests
afterAll(() => {
  const testDbPath = process.env.DB_PATH;
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { recursive: true });
  }
});
