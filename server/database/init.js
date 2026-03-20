/**
 * SQLite Database Initialization
 * Creates tables and seeds initial data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_PATH, 'pingam.db');

// Default superadmin credentials (should be changed on first login)
const DEFAULT_SUPERADMIN = {
  username: process.env.SUPERADMIN_USERNAME || 'superadmin',
  email: process.env.SUPERADMIN_EMAIL || 'superadmin@localhost',
  password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123',
  fullName: 'System Super Administrator'
};

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
  return new Promise(async (resolve, reject) => {
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

        -- Users Table (E-014: Authentication)
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT,
          role TEXT NOT NULL DEFAULT 'viewer',
          status TEXT NOT NULL DEFAULT 'active',
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- User Sessions Table (E-014: Session Management)
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          refresh_token_hash TEXT,
          ip_address TEXT,
          user_agent TEXT,
          expires_at DATETIME NOT NULL,
          revoked_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        -- System Configuration Table (E-020: Configuration Management)
        CREATE TABLE IF NOT EXISTS system_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id TEXT UNIQUE NOT NULL,
          config_key TEXT UNIQUE NOT NULL,
          config_value TEXT,
          category TEXT NOT NULL,
          description TEXT,
          updated_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- PingAM Instances Table (Multiple PingAM connections)
        CREATE TABLE IF NOT EXISTS pingam_instances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instance_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          base_url TEXT NOT NULL,
          realm TEXT DEFAULT '/alpha',
          admin_username TEXT,
          admin_password_encrypted TEXT,
          api_key_encrypted TEXT,
          connection_timeout INTEGER DEFAULT 30000,
          retry_attempts INTEGER DEFAULT 3,
          verify_ssl INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          is_primary INTEGER DEFAULT 0,
          last_health_check DATETIME,
          health_status TEXT DEFAULT 'unknown',
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

        -- Indexes for new tables
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
        CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
        CREATE INDEX IF NOT EXISTS idx_pingam_instances_active ON pingam_instances(is_active);
        CREATE INDEX IF NOT EXISTS idx_pingam_instances_primary ON pingam_instances(is_primary);
      `);

      // Seed default superadmin user if no users exist
      await seedDefaultSuperadmin(database);

      logger.info('Database schema initialized successfully');
      resolve(database);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      reject(error);
    }
  });
}

/**
 * Seed default superadmin user if not exists
 */
async function seedDefaultSuperadmin(database) {
  try {
    // Check if superadmin already exists
    const existingSuperadmin = database.prepare(
      "SELECT id FROM users WHERE role = 'superadmin' OR username = ?"
    ).get(DEFAULT_SUPERADMIN.username);

    if (existingSuperadmin) {
      logger.debug('Superadmin user already exists, skipping seed');
      return;
    }

    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_SUPERADMIN.password, 12);
    const userId = uuidv4();

    database.prepare(`
      INSERT INTO users (user_id, username, email, password_hash, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, 'superadmin', 'active')
    `).run(
      userId,
      DEFAULT_SUPERADMIN.username,
      DEFAULT_SUPERADMIN.email,
      passwordHash,
      DEFAULT_SUPERADMIN.fullName
    );

    logger.info('Default superadmin user created', {
      username: DEFAULT_SUPERADMIN.username,
      email: DEFAULT_SUPERADMIN.email,
      note: 'Please change the default password on first login!'
    });

    // Log warning about default credentials
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  DEFAULT SUPERADMIN CREDENTIALS CREATED');
    console.log('='.repeat(60));
    console.log(`Username: ${DEFAULT_SUPERADMIN.username}`);
    console.log(`Password: ${DEFAULT_SUPERADMIN.password}`);
    console.log('\n⚠️  IMPORTANT: Change these credentials immediately!');
    console.log('Set environment variables to customize:');
    console.log('  - SUPERADMIN_USERNAME');
    console.log('  - SUPERADMIN_EMAIL');
    console.log('  - SUPERADMIN_PASSWORD');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    logger.error('Failed to seed superadmin user:', error);
    throw error;
  }
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
  closeDatabase,
  DEFAULT_SUPERADMIN
};
