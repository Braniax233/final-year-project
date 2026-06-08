/**
 * engines/bmiEngine.js
 * BMI calculation engine for the Vital X system.
 *
 * Provides:
 *   calculateBMI(weight, height)            → rounded BMI value (kg/m²)
 *   classifyBMI(bmi)                        → classification string
 *   generateThresholdRecommendation(class)  → { spo2Min, spo2Max, hrMin, hrMax }
 *
 * Clinical rationale for threshold recommendations:
 *   - Underweight patients often have compromised lung capacity; standard SpO2
 *     thresholds apply but careful HR monitoring is warranted.
 *   - Overweight and Obese patients are at higher risk of sleep apnoea and
 *     hypoventilation, so SpO2 minimum thresholds are slightly relaxed and
 *     the acceptable HR upper limit is raised to account for resting tachycardia.
 */

// ─── BMI Categories ───────────────────────────────────────────────────────────
const CATEGORIES = {
  UNDERWEIGHT: 'Underweight', // BMI < 18.5
  NORMAL:      'Normal',      // 18.5 ≤ BMI < 25
  OVERWEIGHT:  'Overweight',  // 25 ≤ BMI < 30
  OBESE:       'Obese',       // BMI ≥ 30
};

/**
 * calculateBMI
 * Computes Body Mass Index from weight (kg) and height (cm).
 *
 * Formula: BMI = weight / (height_m)²
 *
 * @param {number} weight — body weight in kilograms
 * @param {number} height — body height in centimetres
 * @returns {number} BMI rounded to 2 decimal places
 * @throws {Error} if weight or height are not positive numbers
 */
function calculateBMI(weight, height) {
  if (typeof weight !== 'number' || weight <= 0) {
    throw new Error('calculateBMI: weight must be a positive number (kg).');
  }
  if (typeof height !== 'number' || height <= 0) {
    throw new Error('calculateBMI: height must be a positive number (cm).');
  }

  const heightMetres = height / 100;
  const bmi = weight / (heightMetres * heightMetres);
  return parseFloat(bmi.toFixed(2));
}

/**
 * classifyBMI
 * Maps a numeric BMI value to its WHO classification string.
 *
 * @param {number} bmi — BMI value in kg/m²
 * @returns {'Underweight'|'Normal'|'Overweight'|'Obese'}
 * @throws {Error} if bmi is not a positive number
 */
function classifyBMI(bmi) {
  if (typeof bmi !== 'number' || bmi <= 0) {
    throw new Error('classifyBMI: bmi must be a positive number.');
  }

  if (bmi < 18.5)  return CATEGORIES.UNDERWEIGHT;
  if (bmi < 25.0)  return CATEGORIES.NORMAL;
  if (bmi < 30.0)  return CATEGORIES.OVERWEIGHT;
  return CATEGORIES.OBESE;
}

/**
 * generateThresholdRecommendation
 * Returns personalised SpO2 and heart-rate monitoring thresholds based on
 * the patient's BMI classification.
 *
 * The warningMargin and trendWindow defaults are not included here — those
 * remain at the system-level defaults unless overridden by the clinician.
 *
 * Rationale per category:
 *   Underweight — standard SpO2 floor (95%); standard HR range (60–100 bpm)
 *   Normal      — standard SpO2 floor (95%); standard HR range (60–100 bpm)
 *   Overweight  — lowered SpO2 floor (94%) reflecting common mild hypoxaemia
 *                 risk; standard HR range (60–100 bpm)
 *   Obese       — further lowered SpO2 floor (93%) for OHS/OSA risk;
 *                 raised HR ceiling (110 bpm) for obesity-related tachycardia
 *
 * @param {'Underweight'|'Normal'|'Overweight'|'Obese'} classification
 * @returns {{ spo2Min: number, spo2Max: number, hrMin: number, hrMax: number }}
 * @throws {Error} for unknown classification strings
 */
function generateThresholdRecommendation(classification) {
  const recommendations = {
    [CATEGORIES.UNDERWEIGHT]: {
      spo2Min: 95,
      spo2Max: 100,
      hrMin: 60,
      hrMax: 100,
    },
    [CATEGORIES.NORMAL]: {
      spo2Min: 95,
      spo2Max: 100,
      hrMin: 60,
      hrMax: 100,
    },
    [CATEGORIES.OVERWEIGHT]: {
      spo2Min: 94,
      spo2Max: 100,
      hrMin: 60,
      hrMax: 100,
    },
    [CATEGORIES.OBESE]: {
      spo2Min: 93,
      spo2Max: 100,
      hrMin: 60,
      hrMax: 110,
    },
  };

  const rec = recommendations[classification];
  if (!rec) {
    throw new Error(
      `generateThresholdRecommendation: unknown classification "${classification}". ` +
      `Expected one of: ${Object.values(CATEGORIES).join(', ')}.`
    );
  }

  return rec;
}

module.exports = { calculateBMI, classifyBMI, generateThresholdRecommendation };
