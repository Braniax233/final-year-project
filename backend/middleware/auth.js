/**
 * middleware/auth.js
 * Authentication middleware — DISABLED for demo / main-feature testing.
 *
 * protect and restrictTo are both no-ops that simply call next().
 * A default "clinician" user is attached to req.user so downstream
 * route handlers that reference req.user._id still work.
 *
 * Re-enable real JWT auth later by swapping this file with the
 * original implementation.
 */

const protect = (req, _res, next) => {
  // Attach a default user so routes that read req.user don't crash
  req.user = {
    _id: "000000000000000000000000",
    name: "Demo Clinician",
    email: "demo@vitalx.com",
    role: "clinician",
    isActive: true,
  };
  next();
};

const restrictTo =
  (..._roles) =>
  (_req, _res, next) =>
    next();

module.exports = { protect, restrictTo };
