/**
 * server.js
 * Entry point for the Vital X Medical IoT Monitoring backend.
 * Configures Express, connects to MongoDB, mounts all API routes,
 * and starts the HTTP server.
 */

const dotenv = require("dotenv");
dotenv.config(); // Load .env before any other module reads process.env

// Force Google public DNS so MongoDB Atlas SRV records resolve correctly
// on machines whose local DNS server does not support SRV lookups.
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// ─── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ─── App Initialisation ────────────────────────────────────────────────────────
const app = express();

// ─── Global Middleware ─────────────────────────────────────────────────────────
// Allow requests from the Vite dev server (frontend)
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
);

// Parse incoming JSON request bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Vital X API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/readings", require("./routes/readings"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/bmi", require("./routes/bmi"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/device", require("./routes/device"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/vitals", require("./routes/vitals"));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must have exactly 4 parameters so Express recognises it as an error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log full stack in development; suppress in production
  if (process.env.NODE_ENV !== "production") {
    console.error("🔴  Unhandled error:", err.stack || err.message);
  }

  // Mongoose validation error — surface friendly messages
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res
      .status(400)
      .json({ success: false, message: messages.join(", ") });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired." });
  }

  res.status(err.status || err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  Vital X API listening on http://localhost:${PORT}`);
  console.log(`    Environment : ${process.env.NODE_ENV || "development"}`);
});

module.exports = app; // export for testing
