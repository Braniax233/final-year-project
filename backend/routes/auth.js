/**
 * routes/auth.js
 * Authentication routes for the Vital X API.
 *
 * POST /api/auth/login   — email + password → JWT
 * POST /api/auth/logout  — stateless logout acknowledgement
 * GET  /api/auth/me      — return current authenticated user
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ─── Helper: sign JWT ──────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return a signed JWT + user profile
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate payload
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password.",
      });
    }

    // Find user — explicitly select passwordHash so we can compare
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+passwordHash");

    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been deactivated. Please contact your administrator.",
      });
    }

    // Verify password against stored bcrypt hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Sign and return token
    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        patientId: user.patientId,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("POST /auth/login error:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error during login." });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/logout
 * @desc    Stateless logout — the client is responsible for discarding the token.
 *          Returns 200 so the frontend can cleanly clear local state.
 * @access  Public
 */
router.post("/logout", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully. Please discard your token.",
  });
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
/**
 * @route   GET /api/auth/me
 * @desc    Return the currently authenticated user's profile.
 *          If the user has role 'patient', also populate their Patient record.
 * @access  Protected
 */
router.get("/me", protect, async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select("-passwordHash");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Populate Patient record for users with the patient role
    if (user.role === "patient" && user.patientId) {
      user = await User.findById(req.user._id)
        .select("-passwordHash")
        .populate("patientId");
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("GET /auth/me error:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching profile." });
  }
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────
/**
 * @route   POST /api/auth/register
 * @desc    Create a new user account for any supported role.
 *          For the 'patient' role a linked Patient document is created automatically
 *          and a unique membershipId (GH-YYYY-XXXX) is generated.
 * @access  Public (restrict in production with a guard or remove this route)
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, department, dob, gender } =
      req.body;

    // ── Basic validation ────────────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, and role are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const VALID_ROLES = ["clinician", "provider", "patient"];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${VALID_ROLES.join(", ")}.`,
      });
    }

    // ── Email uniqueness ────────────────────────────────────────────────────────
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A user with that email already exists.",
      });
    }

    // ── Patient record (role === 'patient' only) ────────────────────────────────
    let patientId = null;

    if (role === "patient") {
      // Generate a collision-free membershipId in the format GH-YYYY-XXXX
      const year = new Date().getFullYear();
      let membershipId;
      do {
        const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        membershipId = `GH-${year}-${rand}`;
      } while (await Patient.findOne({ membershipId })); // retry on collision

      const patient = await Patient.create({
        membershipId,
        name,
        dob: dob || null,
        // Patient schema enum: ['male', 'female', 'other', '']; use '' when not supplied
        gender: gender || "",
        phone: phone || "",
        isActive: true,
        threshold: {
          spo2Min: 95,
          spo2Max: 100,
          hrMin: 60,
          hrMax: 100,
          warningMargin: 2,
          trendWindow: 5,
        },
      });

      patientId = patient._id;
    }

    // ── Create User ─────────────────────────────────────────────────────────────
    // passwordHash is stored plain here — the pre-save hook in User.js bcrypt-hashes it
    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role,
      phone: phone || "",
      department: department || "",
      patientId,
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        patientId: user.patientId,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("POST /auth/register error:", err.message);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    res
      .status(500)
      .json({ success: false, message: "Server error during registration." });
  }
});

module.exports = router;
