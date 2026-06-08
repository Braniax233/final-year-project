/**
 * engines/classificationEngine.js
 * Core clinical classification engine for the Vital X system.
 *
 * Analyses a SpO2 / heart-rate pair against a patient's personalised thresholds,
 * applies a linear-regression trend analysis on recent readings, and returns a
 * structured classification result with a suggested clinical action.
 *
 * Exported functions:
 *   classifyReading(spo2, heartRate, threshold, recentReadings) → ClassificationResult
 */

// ─── Trend Analysis ───────────────────────────────────────────────────────────

/**
 * linearRegressionSlope
 * Calculates the slope of a simple ordinary least-squares (OLS) linear
 * regression on an array of numeric y-values.
 *
 * x is implicitly [0, 1, 2, ..., n-1] (index = time).
 * A positive slope means the values are increasing over time.
 *
 * @param {number[]} values
 * @returns {number} slope (Δy per index step)
 */
function linearRegressionSlope(values) {
  const n = values.length;
  if (n < 2) return 0; // Cannot compute slope with a single point

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0; // All x-values are identical (shouldn't happen)

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * analyzeTrend
 * Uses linear regression on the most recent `trendWindow` SpO2 readings
 * (sorted oldest → newest) to determine whether the patient's oxygenation
 * is improving, stable, or declining.
 *
 * Thresholds:
 *   slope < -0.3  → 'declining'   (SpO2 dropping ~0.3% per reading)
 *   slope >  0.3  → 'improving'
 *   otherwise     → 'stable'
 *
 * @param {Array<{spo2: number}>} readings  — recent readings, oldest first
 * @param {number}               trendWindow — max number of readings to include
 * @returns {'declining'|'stable'|'improving'|'unknown'}
 */
function analyzeTrend(readings, trendWindow) {
  if (!readings || readings.length === 0) return 'unknown';

  // Take the most recent trendWindow readings (they arrive newest-first from DB)
  // We reverse so index 0 is the oldest → slope direction is meaningful
  const window = readings
    .slice(0, trendWindow)  // newest first (as returned by DB sort -1)
    .reverse();             // oldest first for regression

  if (window.length < 2) return 'unknown';

  const spo2Values = window.map((r) => r.spo2);
  const slope = linearRegressionSlope(spo2Values);

  if (slope < -0.3) return 'declining';
  if (slope > 0.3) return 'improving';
  return 'stable';
}

// ─── Single-metric status classifiers ────────────────────────────────────────

/**
 * classifySpO2
 * Returns the severity level for a single SpO2 reading against the patient's
 * threshold configuration.
 *
 * CRITICAL : spo2 < threshold.spo2Min
 * WARNING  : spo2 < threshold.spo2Min + warningMargin  (approaching critical)
 * WARNING  : spo2 > threshold.spo2Max                  (sensor/polycythaemia concern)
 * NORMAL   : otherwise
 *
 * @param {number} spo2
 * @param {{ spo2Min: number, spo2Max: number, warningMargin: number }} threshold
 * @returns {'NORMAL'|'WARNING'|'CRITICAL'}
 */
function classifySpO2(spo2, threshold) {
  const { spo2Min, spo2Max = 100, warningMargin = 2 } = threshold;

  if (spo2 < spo2Min) return 'CRITICAL';
  if (spo2 < spo2Min + warningMargin) return 'WARNING';
  if (spo2 > spo2Max) return 'WARNING'; // Unexpectedly high — potential sensor error
  return 'NORMAL';
}

/**
 * classifyHeartRate
 * Returns the severity level for a single heart-rate reading.
 *
 * CRITICAL : hr < hrMin  OR  hr > hrMax
 * WARNING  : hr < hrMin + warningMargin  (approaching bradycardia threshold)
 *            hr > hrMax - warningMargin  (approaching tachycardia threshold)
 * NORMAL   : otherwise
 *
 * @param {number} hr
 * @param {{ hrMin: number, hrMax: number, warningMargin: number }} threshold
 * @returns {'NORMAL'|'WARNING'|'CRITICAL'}
 */
function classifyHeartRate(hr, threshold) {
  const { hrMin, hrMax, warningMargin = 2 } = threshold;

  if (hr < hrMin || hr > hrMax) return 'CRITICAL';
  if (hr < hrMin + warningMargin || hr > hrMax - warningMargin) return 'WARNING';
  return 'NORMAL';
}

// ─── Status severity ordering ─────────────────────────────────────────────────
const SEVERITY_RANK = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };

/**
 * worstStatus
 * Returns whichever status has the highest severity rank.
 *
 * @param {...string} statuses
 * @returns {'NORMAL'|'WARNING'|'CRITICAL'}
 */
function worstStatus(...statuses) {
  return statuses.reduce((worst, current) =>
    SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst
  );
}

// ─── Suggested clinical actions ───────────────────────────────────────────────
const SUGGESTED_ACTIONS = {
  NORMAL: 'Vitals are within acceptable range. Continue routine monitoring.',
  WARNING:
    'Vitals are approaching threshold limits. Increase monitoring frequency and notify the assigned clinician.',
  CRITICAL:
    'Vitals are critically abnormal. Immediate clinical intervention is required. Emergency contacts have been notified.',
};

// ─── Main export: classifyReading ────────────────────────────────────────────

/**
 * classifyReading
 * Full pipeline: trend analysis → SpO2 classification → HR classification →
 * composite status → trend escalation → result.
 *
 * @param {number}  spo2           — current SpO2 percentage (0–100)
 * @param {number}  heartRate      — current heart rate in bpm
 * @param {object}  threshold      — patient threshold config (from Patient.threshold)
 * @param {Array}   recentReadings — recent readings array, newest first (may be empty)
 *
 * @returns {{
 *   status: 'NORMAL'|'WARNING'|'CRITICAL',
 *   trendDirection: 'improving'|'stable'|'declining'|'unknown',
 *   suggestedAction: string,
 *   details: {
 *     spo2Status: string,
 *     hrStatus: string,
 *     trendEscalated: boolean,
 *     slope: number|null,
 *     spo2,
 *     heartRate,
 *   }
 * }}
 */
function classifyReading(spo2, heartRate, threshold, recentReadings = []) {
  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  if (typeof spo2 !== 'number' || typeof heartRate !== 'number') {
    throw new Error('classifyReading: spo2 and heartRate must be numbers.');
  }

  // Merge defaults so the engine works even with partial threshold objects
  const t = {
    spo2Min: 95,
    spo2Max: 100,
    hrMin: 60,
    hrMax: 100,
    warningMargin: 2,
    trendWindow: 5,
    ...threshold,
  };

  // ── 2. Trend analysis ───────────────────────────────────────────────────────
  const trendDirection = analyzeTrend(recentReadings, t.trendWindow);

  // Calculate slope for reporting purposes
  let slope = null;
  if (recentReadings && recentReadings.length >= 2) {
    const window = recentReadings.slice(0, t.trendWindow).reverse();
    slope = linearRegressionSlope(window.map((r) => r.spo2));
  }

  // ── 3. Classify each metric independently ──────────────────────────────────
  const spo2Status = classifySpO2(spo2, t);
  const hrStatus = classifyHeartRate(heartRate, t);

  // ── 4. Composite status — worst of the two ─────────────────────────────────
  let compositeStatus = worstStatus(spo2Status, hrStatus);

  // ── 5. Trend escalation ────────────────────────────────────────────────────
  // A WARNING reading with a clearly declining SpO2 trend is escalated to
  // CRITICAL to give clinical staff earlier intervention opportunity.
  let trendEscalated = false;
  if (compositeStatus === 'WARNING' && trendDirection === 'declining') {
    compositeStatus = 'CRITICAL';
    trendEscalated = true;
  }

  // ── 6. Build result ────────────────────────────────────────────────────────
  return {
    status: compositeStatus,
    trendDirection,
    suggestedAction: SUGGESTED_ACTIONS[compositeStatus],
    details: {
      spo2Status,
      hrStatus,
      trendEscalated,
      slope: slope !== null ? parseFloat(slope.toFixed(4)) : null,
      spo2,
      heartRate,
    },
  };
}

module.exports = { classifyReading, analyzeTrend };
