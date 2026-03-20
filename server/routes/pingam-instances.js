/**
 * PingAM Instances Management Routes
 * API-only routes for managing multiple PingAM instance configurations
 * Only accessible by superadmin users
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const { getDatabase } = require('../database/init');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const logger = require('../utils/logger');

// Encryption key for sensitive data (should be set via environment variable)
const ENCRYPTION_KEY = process.env.PINGAM_ENCRYPTION_KEY || 'default-encryption-key-change-me!';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Mask sensitive fields in response
 */
function maskInstance(instance) {
  return {
    id: instance.instance_id,
    name: instance.name,
    description: instance.description,
    baseUrl: instance.base_url,
    realm: instance.realm,
    adminUsername: instance.admin_username,
    hasPassword: !!instance.admin_password_encrypted,
    hasApiKey: !!instance.api_key_encrypted,
    connectionTimeout: instance.connection_timeout,
    retryAttempts: instance.retry_attempts,
    verifySsl: !!instance.verify_ssl,
    isActive: !!instance.is_active,
    isPrimary: !!instance.is_primary,
    lastHealthCheck: instance.last_health_check,
    healthStatus: instance.health_status,
    createdBy: instance.created_by,
    createdAt: instance.created_at,
    updatedAt: instance.updated_at
  };
}

/**
 * GET /api/pingam-instances
 * List all PingAM instances
 */
router.get('/',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  async (req, res, next) => {
    try {
      const db = getDatabase();
      const { active } = req.query;

      let whereClause = '1=1';
      const params = [];

      if (active !== undefined) {
        whereClause += ' AND is_active = ?';
        params.push(active === 'true' ? 1 : 0);
      }

      const instances = db.prepare(`
        SELECT * FROM pingam_instances
        WHERE ${whereClause}
        ORDER BY is_primary DESC, name ASC
      `).all(...params);

      res.json({
        success: true,
        data: {
          instances: instances.map(maskInstance),
          total: instances.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/pingam-instances/:instanceId
 * Get a specific PingAM instance
 */
router.get('/:instanceId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { instanceId } = req.params;
      const db = getDatabase();

      const instance = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      if (!instance) {
        throw new AppError('PingAM instance not found', 404, 'INSTANCE_NOT_FOUND');
      }

      res.json({
        success: true,
        data: maskInstance(instance)
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/pingam-instances
 * Create a new PingAM instance
 */
router.post('/',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required (max 100 characters)'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }),
    body('baseUrl')
      .trim()
      .isURL({ require_protocol: true })
      .withMessage('Valid base URL with protocol is required'),
    body('realm')
      .optional()
      .trim()
      .default('/alpha'),
    body('adminUsername')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('adminPassword')
      .optional()
      .isLength({ max: 500 }),
    body('apiKey')
      .optional()
      .isLength({ max: 500 }),
    body('connectionTimeout')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .default(30000),
    body('retryAttempts')
      .optional()
      .isInt({ min: 0, max: 10 })
      .default(3),
    body('verifySsl')
      .optional()
      .isBoolean()
      .default(true),
    body('isActive')
      .optional()
      .isBoolean()
      .default(true),
    body('isPrimary')
      .optional()
      .isBoolean()
      .default(false)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const {
        name,
        description,
        baseUrl,
        realm = '/alpha',
        adminUsername,
        adminPassword,
        apiKey,
        connectionTimeout = 30000,
        retryAttempts = 3,
        verifySsl = true,
        isActive = true,
        isPrimary = false
      } = req.body;

      const db = getDatabase();
      const instanceId = uuidv4();

      // If this is set as primary, unset other primary instances
      if (isPrimary) {
        db.prepare('UPDATE pingam_instances SET is_primary = 0').run();
      }

      // Encrypt sensitive data
      const encryptedPassword = encrypt(adminPassword);
      const encryptedApiKey = encrypt(apiKey);

      db.prepare(`
        INSERT INTO pingam_instances (
          instance_id, name, description, base_url, realm,
          admin_username, admin_password_encrypted, api_key_encrypted,
          connection_timeout, retry_attempts, verify_ssl,
          is_active, is_primary, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        instanceId,
        name,
        description || null,
        baseUrl,
        realm,
        adminUsername || null,
        encryptedPassword,
        encryptedApiKey,
        connectionTimeout,
        retryAttempts,
        verifySsl ? 1 : 0,
        isActive ? 1 : 0,
        isPrimary ? 1 : 0,
        req.user.username
      );

      logger.info('PingAM instance created', {
        instanceId,
        name,
        baseUrl,
        createdBy: req.user.username
      });

      const newInstance = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      res.status(201).json({
        success: true,
        data: {
          message: 'PingAM instance created successfully',
          instance: maskInstance(newInstance)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/pingam-instances/:instanceId
 * Update a PingAM instance
 */
router.put('/:instanceId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }),
    body('baseUrl')
      .optional()
      .trim()
      .isURL({ require_protocol: true }),
    body('realm')
      .optional()
      .trim(),
    body('adminUsername')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('adminPassword')
      .optional()
      .isLength({ max: 500 }),
    body('apiKey')
      .optional()
      .isLength({ max: 500 }),
    body('connectionTimeout')
      .optional()
      .isInt({ min: 1000, max: 300000 }),
    body('retryAttempts')
      .optional()
      .isInt({ min: 0, max: 10 }),
    body('verifySsl')
      .optional()
      .isBoolean(),
    body('isActive')
      .optional()
      .isBoolean(),
    body('isPrimary')
      .optional()
      .isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { instanceId } = req.params;
      const db = getDatabase();

      const existing = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      if (!existing) {
        throw new AppError('PingAM instance not found', 404, 'INSTANCE_NOT_FOUND');
      }

      const {
        name,
        description,
        baseUrl,
        realm,
        adminUsername,
        adminPassword,
        apiKey,
        connectionTimeout,
        retryAttempts,
        verifySsl,
        isActive,
        isPrimary
      } = req.body;

      // If this is set as primary, unset other primary instances
      if (isPrimary === true) {
        db.prepare('UPDATE pingam_instances SET is_primary = 0 WHERE instance_id != ?').run(instanceId);
      }

      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (baseUrl !== undefined) {
        updates.push('base_url = ?');
        values.push(baseUrl);
      }
      if (realm !== undefined) {
        updates.push('realm = ?');
        values.push(realm);
      }
      if (adminUsername !== undefined) {
        updates.push('admin_username = ?');
        values.push(adminUsername);
      }
      if (adminPassword !== undefined) {
        updates.push('admin_password_encrypted = ?');
        values.push(encrypt(adminPassword));
      }
      if (apiKey !== undefined) {
        updates.push('api_key_encrypted = ?');
        values.push(encrypt(apiKey));
      }
      if (connectionTimeout !== undefined) {
        updates.push('connection_timeout = ?');
        values.push(connectionTimeout);
      }
      if (retryAttempts !== undefined) {
        updates.push('retry_attempts = ?');
        values.push(retryAttempts);
      }
      if (verifySsl !== undefined) {
        updates.push('verify_ssl = ?');
        values.push(verifySsl ? 1 : 0);
      }
      if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }
      if (isPrimary !== undefined) {
        updates.push('is_primary = ?');
        values.push(isPrimary ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(instanceId);

        db.prepare(`
          UPDATE pingam_instances 
          SET ${updates.join(', ')}
          WHERE instance_id = ?
        `).run(...values);
      }

      logger.info('PingAM instance updated', {
        instanceId,
        updatedBy: req.user.username
      });

      const updatedInstance = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      res.json({
        success: true,
        data: {
          message: 'PingAM instance updated successfully',
          instance: maskInstance(updatedInstance)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/pingam-instances/:instanceId
 * Delete a PingAM instance
 */
router.delete('/:instanceId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { instanceId } = req.params;
      const db = getDatabase();

      const existing = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      if (!existing) {
        throw new AppError('PingAM instance not found', 404, 'INSTANCE_NOT_FOUND');
      }

      db.prepare('DELETE FROM pingam_instances WHERE instance_id = ?').run(instanceId);

      logger.info('PingAM instance deleted', {
        instanceId,
        name: existing.name,
        deletedBy: req.user.username
      });

      res.json({
        success: true,
        data: {
          message: 'PingAM instance deleted successfully',
          instanceId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/pingam-instances/:instanceId/test
 * Test connection to a PingAM instance
 */
router.post('/:instanceId/test',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { instanceId } = req.params;
      const db = getDatabase();

      const instance = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      if (!instance) {
        throw new AppError('PingAM instance not found', 404, 'INSTANCE_NOT_FOUND');
      }

      // Test connection
      const https = require('https');
      const http = require('http');
      const url = instance.base_url;
      const protocol = url.startsWith('https') ? https : http;

      const testConnection = () => {
        return new Promise((resolve, reject) => {
          const timeout = instance.connection_timeout || 30000;
          const testReq = protocol.get(`${url}/json/serverinfo/*`, {
            timeout,
            rejectUnauthorized: !!instance.verify_ssl
          }, (response) => {
            resolve({
              status: response.statusCode,
              reachable: true
            });
          });
          testReq.on('error', (err) => {
            reject(err);
          });
          testReq.on('timeout', () => {
            testReq.destroy();
            reject(new Error('Connection timeout'));
          });
        });
      };

      let healthStatus = 'unhealthy';
      let connectionResult;

      try {
        connectionResult = await testConnection();
        healthStatus = connectionResult.status === 200 ? 'healthy' : 'degraded';
        
        // Update health status in database
        db.prepare(`
          UPDATE pingam_instances 
          SET last_health_check = CURRENT_TIMESTAMP, health_status = ?
          WHERE instance_id = ?
        `).run(healthStatus, instanceId);

        res.json({
          success: true,
          data: {
            connected: true,
            status: connectionResult.status,
            healthStatus,
            url: instance.base_url,
            message: 'Connection successful'
          }
        });
      } catch (connError) {
        // Update health status in database
        db.prepare(`
          UPDATE pingam_instances 
          SET last_health_check = CURRENT_TIMESTAMP, health_status = 'unhealthy'
          WHERE instance_id = ?
        `).run(instanceId);

        res.json({
          success: true,
          data: {
            connected: false,
            healthStatus: 'unhealthy',
            url: instance.base_url,
            error: connError.message,
            message: 'Connection failed'
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/pingam-instances/:instanceId/set-primary
 * Set an instance as the primary PingAM connection
 */
router.post('/:instanceId/set-primary',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { instanceId } = req.params;
      const db = getDatabase();

      const instance = db.prepare(
        'SELECT * FROM pingam_instances WHERE instance_id = ?'
      ).get(instanceId);

      if (!instance) {
        throw new AppError('PingAM instance not found', 404, 'INSTANCE_NOT_FOUND');
      }

      // Unset all primary instances and set this one
      const transaction = db.transaction(() => {
        db.prepare('UPDATE pingam_instances SET is_primary = 0').run();
        db.prepare('UPDATE pingam_instances SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE instance_id = ?').run(instanceId);
      });

      transaction();

      logger.info('PingAM instance set as primary', {
        instanceId,
        name: instance.name,
        setBy: req.user.username
      });

      res.json({
        success: true,
        data: {
          message: `Instance "${instance.name}" is now the primary PingAM connection`,
          instanceId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
