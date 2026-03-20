/**
 * Authentication & Authorization Middleware
 * E-014: JWT tokens, session management, role-based access control
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Available roles in the system
 */
const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

/**
 * Role hierarchy - higher roles inherit permissions from lower ones
 */
const ROLE_HIERARCHY = {
  [ROLES.SUPERADMIN]: [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER],
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER],
  [ROLES.OPERATOR]: [ROLES.OPERATOR, ROLES.VIEWER],
  [ROLES.VIEWER]: [ROLES.VIEWER]
};

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    type: 'access'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw new AppError('Token verification failed', 401, 'TOKEN_ERROR');
  }
}

/**
 * Authentication middleware - validates JWT token
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AppError('No authorization header provided', 401, 'NO_AUTH_HEADER');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Invalid authorization format. Use Bearer token', 401, 'INVALID_AUTH_FORMAT');
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };
    
    logger.debug('User authenticated', { userId: decoded.userId, username: decoded.username });
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded.type === 'access') {
        req.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role
        };
      }
    }
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
}

/**
 * Role-based access control middleware
 * @param {string|string[]} allowedRoles - Role(s) that are allowed to access the route
 */
function authorize(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }
      
      const userRole = req.user.role;
      const userPermissions = ROLE_HIERARCHY[userRole] || [];
      
      const hasPermission = roles.some(role => userPermissions.includes(role));
      
      if (!hasPermission) {
        logger.warn('Access denied', {
          userId: req.user.id,
          userRole,
          requiredRoles: roles,
          path: req.path
        });
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user has specific role
 */
function hasRole(user, role) {
  if (!user || !user.role) return false;
  const userPermissions = ROLE_HIERARCHY[user.role] || [];
  return userPermissions.includes(role);
}

/**
 * Middleware to check resource ownership or admin access
 * @param {Function} getResourceOwnerId - Function to extract owner ID from request
 */
function authorizeOwnerOrAdmin(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }
      
      // Admins can access any resource
      if (hasRole(req.user, ROLES.ADMIN)) {
        return next();
      }
      
      const ownerId = await getResourceOwnerId(req);
      
      if (req.user.id !== ownerId) {
        throw new AppError('Access denied - not resource owner', 403, 'NOT_OWNER');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  // Token functions
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  
  // Middleware
  authenticate,
  optionalAuth,
  authorize,
  authorizeOwnerOrAdmin,
  
  // Utilities
  hasRole,
  ROLES,
  ROLE_HIERARCHY,
  
  // Constants
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};
