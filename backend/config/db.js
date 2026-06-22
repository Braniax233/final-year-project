/**
 * config/db.js
 * Mongoose connection module for Vital X backend.
 * Establishes a connection to MongoDB and logs the outcome.
 */

const mongoose = require("mongoose");

/**
 * connectDB — attempts to connect to MongoDB using MONGO_URI from environment.
 * Exits the process with code 1 on failure so the server doesn't start
 * in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 7+ no longer needs these flags, but they are safe to include
      // for older driver compatibility.
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);

    // Mongoose connection event listeners for runtime issues
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️   MongoDB disconnected. Attempting to reconnect…");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅  MongoDB reconnected.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌  MongoDB runtime error:", err.message);
    });
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`);
    console.warn(
      "⚠️   Running without MongoDB — fix Atlas IP whitelist or resume the cluster.",
    );
    // Don't exit: Firebase/vitals routes work without MongoDB
  }
};

module.exports = connectDB;
