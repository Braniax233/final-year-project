/**
 * middleware/deviceAuth.js
 * API-key authentication middleware for IoT devices (ESP32).
 *
 * Devices must include the shared secret in the `x-api-key` header.
 * This key is configured via the DEVICE_API_KEY environment variable.
 *
 * Usage: router.post('/reading', deviceAuth, handler)
 */

/**
 * deviceAuth
 * Validates the `x-api-key` header against the configured DEVICE_API_KEY.
 * Returns 401 if the header is absent or the key does not match.
 */
const deviceAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Device authentication required. Missing x-api-key header.',
    });
  }

  if (apiKey !== process.env.DEVICE_API_KEY) {
    // Use a generic message to avoid leaking information about the key
    return res.status(401).json({
      success: false,
      message: 'Invalid device API key. Access denied.',
    });
  }

  // Attach a device-context flag so downstream handlers know this is a device request
  req.isDeviceRequest = true;
  next();
};

module.exports = deviceAuth;
