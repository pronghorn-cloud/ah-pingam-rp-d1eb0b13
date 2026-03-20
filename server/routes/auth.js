/**
 * Authentication Routes
 * E-014: User authentication endpoints (login, register, logout, token refresh)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { getDatabase } = require('../database/init');
const { AppError } = require('../middleware/errorHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  authorize,
  ROLES
} = require('../middleware/auth');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username must be 3-50 characters, alphanumeric with underscores/hyphens'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ max: 100 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { username, email, password, fullName } = req.body;
      const db = getDatabase();

      // Check if username or email already exists
      const existingUser = db.prepare(
        'SELECT id FROM users WHERE username = ? OR email = ?'
      ).get(username, email);

      if (existingUser) {
        throw new AppError('Username or email already exists', 409, 'USER_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const userId = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO users (user_id, username, email, password_hash, full_name, role, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `);

      // All registered users are viewers by default
      // Superadmin is seeded on database initialization
      // Admins can be promoted by superadmin only
      const role = ROLES.VIEWER;

      const result = stmt.run(userId, username, email, passwordHash, fullName || null, role);

      logger.info('User registered', { userId, username, role });

      res.status(201).json({
        success: true,
        data: {
          userId,
          username,
          email,
          role,
          message: 'Registration successful. Please login.'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { username, password } = req.body;
      const db = getDatabase();

      // Find user by username or email
      const user = db.prepare(`
        SELECT id, user_id, username, email, password_hash, full_name, role, status
        FROM users
        WHERE (username = ? OR email = ?) AND status = 'active'
      `).get(username, username);

      if (!user) {
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        // Log failed attempt
        logger.warn('Failed login attempt', { username, ip: req.ip });
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const userPayload = {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      const accessToken = generateAccessToken(userPayload);
      const refreshToken = generateRefreshToken(userPayload);

      // Store refresh token hash in database
      const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
      const tokenId = uuidv4();
      
      db.prepare(`
        INSERT INTO user_sessions (session_id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, datetime('now', '+7 days'), ?, ?)
      `).run(tokenId, user.user_id, refreshTokenHash, req.ip, req.get('User-Agent'));

      // Update last login
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      logger.info('User logged in', { userId: user.user_id, username: user.username });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          expiresIn: '24h',
          user: {
            id: user.user_id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { refreshToken } = req.body;
      
      // Verify refresh token
      const decoded = verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
      }

      const db = getDatabase();

      // Get user
      const user = db.prepare(`
        SELECT id, user_id, username, email, full_name, role, status
        FROM users
        WHERE user_id = ? AND status = 'active'
      `).get(decoded.userId);

      if (!user) {
        throw new AppError('User not found', 401, 'USER_NOT_FOUND');
      }

      // Generate new access token
      const userPayload = {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      };

      const accessToken = generateAccessToken(userPayload);

      res.json({
        success: true,
        data: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: '24h'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/logout
 * Invalidate user session
 */
router.post('/logout',
  authenticate,
  async (req, res, next) => {
    try {
      const db = getDatabase();

      // Invalidate all sessions for user (or specific session if provided)
      db.prepare(`
        UPDATE user_sessions 
        SET revoked_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND revoked_at IS NULL
      `).run(req.user.id);

      logger.info('User logged out', { userId: req.user.id });

      res.json({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me',
  authenticate,
  async (req, res, next) => {
    try {
      const db = getDatabase();

      const user = db.prepare(`
        SELECT user_id, username, email, full_name, role, status, created_at, last_login
        FROM users
        WHERE user_id = ?
      `).get(req.user.id);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          id: user.user_id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLogin: user.last_login
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /auth/me
 * Update current user profile
 */
router.put('/me',
  authenticate,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('fullName').optional().trim().isLength({ max: 100 }),
    body('currentPassword').optional().notEmpty(),
    body('newPassword').optional().isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { email, fullName, currentPassword, newPassword } = req.body;
      const db = getDatabase();

      const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const updates = [];
      const values = [];

      if (email && email !== user.email) {
        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ? AND user_id != ?').get(email, req.user.id);
        if (existing) {
          throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
        }
        updates.push('email = ?');
        values.push(email);
      }

      if (fullName !== undefined) {
        updates.push('full_name = ?');
        values.push(fullName);
      }

      if (newPassword) {
        if (!currentPassword) {
          throw new AppError('Current password required to change password', 400, 'CURRENT_PASSWORD_REQUIRED');
        }
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) {
          throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
        }
        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        updates.push('password_hash = ?');
        values.push(newHash);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(req.user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
      }

      logger.info('User profile updated', { userId: req.user.id });

      res.json({
        success: true,
        data: {
          message: 'Profile updated successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /auth/users (Admin only)
 * List all users
 */
router.get('/users',
  authenticate,
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const db = getDatabase();
      const { page = 1, limit = 20, status, role } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const params = [];

      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }
      if (role) {
        whereClause += ' AND role = ?';
        params.push(role);
      }

      const total = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`).get(...params);
      
      params.push(limit, offset);
      const users = db.prepare(`
        SELECT user_id, username, email, full_name, role, status, created_at, last_login
        FROM users
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params);

      res.json({
        success: true,
        data: {
          users: users.map(u => ({
            id: u.user_id,
            username: u.username,
            email: u.email,
            fullName: u.full_name,
            role: u.role,
            status: u.status,
            createdAt: u.created_at,
            lastLogin: u.last_login
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total.count,
            pages: Math.ceil(total.count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /auth/users/:userId (Admin/Superadmin only)
 * Update user role or status
 * Note: Only superadmin can modify superadmin users or assign admin/superadmin roles
 */
router.put('/users/:userId',
  authenticate,
  authorize(ROLES.ADMIN),
  [
    body('role').optional().isIn([ROLES.VIEWER, ROLES.OPERATOR, ROLES.ADMIN]),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { userId } = req.params;
      const { role, status } = req.body;
      const db = getDatabase();

      const targetUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
      if (!targetUser) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Protect superadmin users - only superadmin can modify them
      if (targetUser.role === ROLES.SUPERADMIN && req.user.role !== ROLES.SUPERADMIN) {
        throw new AppError('Cannot modify superadmin user', 403, 'FORBIDDEN');
      }

      // Only superadmin can assign admin role
      if (role === ROLES.ADMIN && req.user.role !== ROLES.SUPERADMIN) {
        throw new AppError('Only superadmin can assign admin role', 403, 'FORBIDDEN');
      }

      // Prevent self-demotion
      if (userId === req.user.id && role && role !== req.user.role) {
        throw new AppError('Cannot change your own role', 400, 'SELF_ROLE_CHANGE');
      }

      // Prevent deactivating yourself
      if (userId === req.user.id && status && status !== 'active') {
        throw new AppError('Cannot deactivate yourself', 400, 'SELF_DEACTIVATION');
      }

      const updates = [];
      const values = [];

      if (role) {
        updates.push('role = ?');
        values.push(role);
      }
      if (status) {
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
      }

      logger.info('User updated', { 
        targetUserId: userId, 
        updatedBy: req.user.id,
        updatedByRole: req.user.role,
        changes: { role, status } 
      });

      res.json({
        success: true,
        data: {
          message: 'User updated successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
