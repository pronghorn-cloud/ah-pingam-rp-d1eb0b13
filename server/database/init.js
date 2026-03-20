/**
 * SQLite Database Initialization
 * Creates tables and seeds initial data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_PATH, 'pingam.db');

let db = null;

/**
 * Get database instance (singleton)
 */
function getDatabase() {
  if (!db) {
    // Ensure data directory exists
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }
    
    db = new Database(DB_FILE, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });
    
    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Initialize database schema
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const database = getDatabase();
      
      // Create tables
      database.exec(`
        -- Authentication Events Table
        CREATE TABLE IF NOT EXISTS auth_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT UNIQUE NOT NULL,
          event_type TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT,
          username TEXT,
          client_ip TEXT,
          user_agent TEXT,
          realm TEXT,
          application TEXT,
          status TEXT NOT NULL,
          error_code TEXT,
          error_message TEXT,
          session_id TEXT,
          duration_ms INTEGER,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Sessions Table
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT,
          client_ip TEXT,
          user_agent TEXT,
          realm TEXT,
          application TEXT,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME,
          status TEXT DEFAULT 'active',
          metadata TEXT
        );

        -- API Access Logs Table
        CREATE TABLE IF NOT EXISTS api_access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id TEXT UNIQUE NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          method TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          client_ip TEXT,
          user_agent TEXT,
          user_id TEXT,
          status_code INTEGER,
          response_time_ms INTEGER,
          request_size INTEGER,
          response_size INTEGER,
          error_message TEXT
        );

        -- Metrics Aggregation Table (hourly)
        CREATE TABLE IF NOT EXISTS metrics_hourly (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          dimension TEXT,
          dimension_value TEXT,
          hour_timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(metric_type, metric_name, dimension, dimension_value, hour_timestamp)
        );

        -- Alerts Table
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id TEXT UNIQUE NOT NULL,
          alert_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          source TEXT,
          status TEXT DEFAULT 'active',
          triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          acknowledged_at DATETIME,
          acknowledged_by TEXT,
          resolved_at DATETIME,
          resolved_by TEXT,
          metadata TEXT
        );

        -- Dashboard Configurations Table
        CREATE TABLE IF NOT EXISTS dashboard_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          config_json TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_auth_events_status ON auth_events(status);
        CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
        
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
        
        CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_access_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_access_logs(endpoint);
        
        CREATE INDEX IF NOT EXISTS idx_metrics_hourly_type ON metrics_hourly(metric_type, hour_timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      `);

      logger.info('Database schema initialized successfully');
      resolve(database);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      reject(error);
    }
  });
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
