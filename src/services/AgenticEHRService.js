/**
 * AgenticEHRService.js
 * Contextual risk analysis: correlates image diagnosis with patient history
 * and live environmental data (weather + AQI).
 */

const LUNG_CONDITIONS = ['Asthma', 'COPD'];
const IMMUNE_GUT_CONDITIONS = ['Immunocompromised', 'Diabetes'];
const HEAT_VULNERABLE_CONDITIONS = ['Hypertension', 'Coronary Artery Disease'];

// ─── Alzheimer Severity Ordering ─────────────────────────────────────────────
const ALZHEIMER_SEVERITY = {
  'Non Demented': 0,
  'Very Mild Demented': 1,
  'Mild Demented': 2,
  'Moderate Demented': 3,
};

/**
 * Generate a human-readable history comparison text for a given model type.
 */
export const generateHistoryComparison = (patient, currentPrediction, modelType) => {
  const history = patient.diagnosisHistory?.filter(h => h.modelType === modelType) ?? [];
  if (history.length === 0) return 'First recorded scan for this patient.';

  const last = history[history.length - 1];
  const prev = last.prediction;

  if (modelType === 'alzheimer') {
    const prevScore = ALZHEIMER_SEVERITY[prev] ?? -1;
    const currScore = ALZHEIMER_SEVERITY[currentPrediction] ?? -1;
    if (prevScore === -1 || currScore === -1) return `Previous scan result: ${prev}.`;
    if (currScore > prevScore) return `⚠ Condition has progressed from "${prev}" → "${currentPrediction}".`;
    if (currScore < prevScore) return `✅ Condition has improved from "${prev}" → "${currentPrediction}".`;
    return `Stable: Same classification as last scan ("${prev}").`;
  }

  if (modelType === 'tb') {
    if (prev === 'Tuberculosis' && currentPrediction === 'Normal') return '✅ Improvement detected — previous scan showed Tuberculosis. Continue treatment monitoring.';
    if (prev === 'Normal' && currentPrediction === 'Tuberculosis') return '⚠ New TB detection — previous scan was Normal. Immediate action required.';
    if (prev === 'Tuberculosis' && currentPrediction === 'Tuberculosis') return '⚠ Tuberculosis persists across scans. Treatment review recommended.';
    return `Stable compared to last scan ("${prev}").`;
  }

  if (modelType === 'skin') {
    if (prev === currentPrediction) return `Stable: Same finding as previous scan ("${prev}").`;
    return `Previous finding was "${prev}". Current scan shows "${currentPrediction}" — consult dermatologist for trend evaluation.`;
  }

  if (modelType === 'brain') {
    if (prev === 'No Tumor' && currentPrediction !== 'No Tumor') return `⚠ New tumor finding — previous scan showed No Tumor. Urgent specialist referral.`;
    if (prev !== 'No Tumor' && currentPrediction === 'No Tumor') return '✅ No tumor detected — improvement from prior scan.';
    if (prev === currentPrediction) return `Stable: Same classification as previous scan ("${prev}").`;
    return `Type changed from "${prev}" → "${currentPrediction}". Multidisciplinary review advised.`;
  }

  return `Previous result: ${prev}.`;
};

/**
 * Generate environmental insight based on model type, AQI, and disease.
 */
const generateEnvironmentalInsight = (patient, aqi, prediction, modelType) => {
  if (!aqi || aqi.european_aqi == null) {
    return 'Environmental data unavailable for this location.';
  }

  const aqiScore = aqi.european_aqi;
  const isPoorAir = aqiScore > 60;
  const isVeryPoorAir = aqiScore > 80;

  if (modelType === 'tb' || modelType === 'brain') {
    if (prediction !== 'Normal' && prediction !== 'No Tumor') {
      if (isVeryPoorAir) return `⚠ Very poor air quality (AQI: ${aqiScore}) in ${patient.city} is a significant risk amplifier. Particulate matter (PM2.5: ${aqi.pm2_5?.toFixed(1)} µg/m³) may directly worsen pulmonary and systemic inflammation.`;
      if (isPoorAir) return `Moderate air quality concern (AQI: ${aqiScore}) in ${patient.city}. PM2.5 levels at ${aqi.pm2_5?.toFixed(1)} µg/m³ may contribute to respiratory stress.`;
    }
    return `Air quality in ${patient.city} is ${aqi.label} (AQI: ${aqiScore}). No strong environmental correlation detected.`;
  }

  if (modelType === 'skin') {
    const hasHighUV = patient.city === 'Chennai' || patient.city === 'Madurai' || patient.city === 'Tiruchirappalli';
    const isHighRiskSkin = ['Melanoma', 'Basal Cell Carcinoma', 'Actinic Keratosis', 'Squamous Cell Carcinoma'].includes(prediction);
    if (isHighRiskSkin && hasHighUV) {
      return `⚠ High ambient UV radiation typical for ${patient.city} is a known risk accelerator for ${prediction}. Sun-protective measures strongly recommended.`;
    }
    if (isPoorAir) return `Poor air quality (AQI: ${aqiScore}) may contribute to systemic oxidative stress, potentially worsening skin conditions.`;
    return `No significant environmental correlation with current skin finding in ${patient.city} (AQI: ${aqiScore} — ${aqi.label}).`;
  }

  if (modelType === 'alzheimer') {
    if (isVeryPoorAir) return `⚠ Emerging research links chronic air pollution exposure (PM2.5: ${aqi.pm2_5?.toFixed(1)} µg/m³) to accelerated neurodegeneration. Current AQI in ${patient.city} is ${aqi.label} (${aqiScore}).`;
    return `Air quality in ${patient.city} is ${aqi.label} (AQI: ${aqiScore}). No direct environmental trigger identified for current Alzheimer's classification.`;
  }

  return `Environmental AQI in ${patient.city}: ${aqiScore} (${aqi.label}).`;
};

/**
 * Primary function: analyze image diagnosis against patient profile + environment.
 * Returns enriched result compatible with the requested JSON output format.
 */
export const analyzeImageDiagnosisRisk = (patient, envData, imageDiagnosis, modelType = 'brain') => {
  if (!patient || !imageDiagnosis) return null;

  const { aqi, weather } = envData || {};
  const conditions = patient.preExistingConditions || [];
  const olderAdult = patient.age >= 60;
  const veryOld = patient.age >= 75;

  const historyComparison = generateHistoryComparison(patient, imageDiagnosis.prediction, modelType);
  const environmentalInsight = generateEnvironmentalInsight(patient, aqi, imageDiagnosis.prediction, modelType);

  let agenticReasoning = '';
  let agenticRiskLevel = imageDiagnosis.requires_attention ? 'Critical Warning' : 'Safe';
  let hasWarning = !!imageDiagnosis.requires_attention;

  // Base reasoning from image result
  if (imageDiagnosis.requires_attention) {
    agenticReasoning += `AI identified: ${imageDiagnosis.prediction} (${imageDiagnosis.confidence?.toFixed?.(1) ?? imageDiagnosis.confidence}% confidence). `;
    if (veryOld) agenticReasoning += `Advanced age (${patient.age}) increases risk of rapid progression. `;
    else if (olderAdult) agenticReasoning += `Patient age (${patient.age}) is a contributing risk factor. `;
  } else {
    agenticReasoning += `AI classified as ${imageDiagnosis.prediction} — no acute findings. `;
  }

  // Condition-specific cross-correlation
  if (modelType === 'tb' || modelType === 'brain') {
    const hasLungIssue = conditions.some(c => LUNG_CONDITIONS.includes(c));
    if (hasLungIssue && imageDiagnosis.requires_attention) {
      agenticReasoning += `Pre-existing lung condition (${conditions.filter(c => LUNG_CONDITIONS.includes(c)).join(', ')}) significantly compounds this finding. `;
      agenticRiskLevel = 'Critical Warning';
      hasWarning = true;
    }
  }

  if (modelType === 'skin') {
    const hasImmune = conditions.some(c => IMMUNE_GUT_CONDITIONS.includes(c));
    if (hasImmune && imageDiagnosis.requires_attention) {
      agenticReasoning += `Immunocompromised status elevates risk of malignant progression for skin conditions. `;
      agenticRiskLevel = 'Critical Warning';
      hasWarning = true;
    }
  }

  if (modelType === 'alzheimer') {
    const hasNeuro = conditions.some(c =>
      c.toLowerCase().includes('neurological') || c.toLowerCase().includes('seizure') || c.toLowerCase().includes('migraine')
    );
    if (hasNeuro && imageDiagnosis.requires_attention) {
      agenticReasoning += `Prior neurological history is a significant compounding factor. `;
    }
    // Progression note
    const prevHistory = patient.diagnosisHistory?.filter(h => h.modelType === 'alzheimer') ?? [];
    if (prevHistory.length > 0) {
      const prev = prevHistory[prevHistory.length - 1].prediction;
      const prevScore = ALZHEIMER_SEVERITY[prev] ?? -1;
      const currScore = ALZHEIMER_SEVERITY[imageDiagnosis.prediction] ?? -1;
      if (currScore > prevScore) { hasWarning = true; agenticRiskLevel = 'Progression Detected'; }
    }
  }

  // AQI amplification
  if (aqi && aqi.european_aqi > 80 && imageDiagnosis.requires_attention) {
    agenticReasoning += `Severe air quality in ${patient.city} (AQI: ${aqi.european_aqi}) adds environmental stress. `;
    if (agenticRiskLevel === 'Safe') agenticRiskLevel = 'Elevated Alert';
    hasWarning = true;
  }

  return {
    patient_id: patient.id,
    prediction: imageDiagnosis.prediction,
    confidence: imageDiagnosis.confidence,
    history_comparison: historyComparison,
    environmental_insight: environmentalInsight,
    level: agenticRiskLevel,
    reason: agenticReasoning.trim(),
    hasWarning,
  };
};

/**
 * Legacy function for backward compatibility with existing BrainTumorDashboard calls.
 */
export const analyzePatientRisk = (patient, cityPrediction) => {
  if (!cityPrediction || !cityPrediction.primaryRisk || cityPrediction.primaryRisk.riskLevel === 'Low') {
    return { hasWarning: false, reason: 'No elevated environmental risk in their area.', level: 'Safe' };
  }
  const { category, diseases, riskLevel } = cityPrediction.primaryRisk;
  const conditions = patient.preExistingConditions;
  if (patient.age >= 75 && (riskLevel === 'High' || riskLevel === 'Critical')) {
    return { hasWarning: true, reason: `Patient age (${patient.age}) plus a ${riskLevel} ${category} outbreak poses severe systemic risk.`, level: 'Critical Warning' };
  }
  if (category === 'Respiratory' && conditions.some(c => LUNG_CONDITIONS.includes(c))) {
    return { hasWarning: true, reason: `Pre-existing lung condition matches predicted ${category} spread in ${patient.city}.`, level: 'Critical Warning' };
  }
  if ((category === 'Vector-Borne' || category === 'Water-Borne') && conditions.some(c => IMMUNE_GUT_CONDITIONS.includes(c))) {
    return { hasWarning: true, reason: `Compromised immunity or diabetes makes patient highly susceptible to ${diseases[0]}.`, level: 'High Warning' };
  }
  if (category === 'Heat-Related' && conditions.some(c => HEAT_VULNERABLE_CONDITIONS.includes(c))) {
    return { hasWarning: true, reason: `Cardiovascular condition increases vulnerability during extreme heatwaves.`, level: 'High Warning' };
  }
  if (riskLevel === 'Critical') {
    return { hasWarning: true, reason: `Area is facing a critical ${category} outbreak. Standard precautions advised.`, level: 'Elevated Alert' };
  }
  return { hasWarning: false, reason: `Patient conditions do not strongly correlate with the ${category} risk.`, level: 'Monitoring' };
};
