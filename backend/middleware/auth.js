/**
 * middleware/auth.js
 * JWT authentication middleware for the Vital X API.
 *
 * Exports:
 *   protect       — verifies Bearer token; attaches user to req.user
 *   restrictTo    — role-based access control gate (variadic roles)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect
 * Validates the Bearer JWT sent in the Authorization header.
 * On success, attaches the full user document (minus passwordHash) to req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      const message =
        jwtErr.name === 'TokenExpiredError'
          ? 'Your session has expired. Please log in again.'
          : 'Invalid token. Please log in again.';
      return res.status(401).json({ success: false, message });
    }

    // Fetch fresh user from DB (catches deactivated accounts)
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The account belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Contact your administrator.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('protect middleware error:', err.message);
    res.status(500).json({ success: false, message: 'Internal authentication error.' });
  }
};

/**
 * restrictTo
 * Role-based access control factory. Returns a middleware that only permits
 * users whose role is included in the provided roles list.
 *
 * Usage: router.get('/admin-only', protect, restrictTo('provider'), handler)
 *
 * @param {...string} roles — one or more allowed role strings
 * @returns {Function} Express middleware
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this resource.',
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. This action requires one of the following roles: ${roles.join(', ')}.`,
    });
  }

  next();
};

module.exports = { protect, restrictTo };
