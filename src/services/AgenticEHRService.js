/**
 * Analyzes a patient's pre-existing conditions against the current predicted risk in their city
 * to determine if they are at an elevated, personalized risk.
 */

const LUNG_CONDITIONS = ['Asthma', 'COPD'];
const IMMUNE_GUT_CONDITIONS = ['Immunocompromised', 'Diabetes'];
const HEAT_VULNERABLE_CONDITIONS = ['Hypertension', 'Coronary Artery Disease'];

export const analyzePatientRisk = (patient, cityPrediction) => {
  // If there's no serious risk in the area, the patient is fine.
  if (!cityPrediction || !cityPrediction.primaryRisk || cityPrediction.primaryRisk.riskLevel === 'Low') {
    return {
      hasWarning: false,
      reason: 'No elevated environmental risk in their area.',
      level: 'Safe'
    };
  }

  const { category, diseases, riskLevel } = cityPrediction.primaryRisk;
  const conditions = patient.preExistingConditions;

  // Extremely old patients are generally vulnerable to any major outbreak.
  if (patient.age >= 75 && (riskLevel === 'High' || riskLevel === 'Critical')) {
    return {
      hasWarning: true,
      reason: `Patient age (${patient.age}) plus a ${riskLevel} ${category} outbreak poses severe systemic risk.`,
      level: 'Critical Warning'
    };
  }

  // 1. Respiratory/Airborne Risk check
  if (category === 'Respiratory') {
    const hasLungIssue = conditions.some(c => LUNG_CONDITIONS.includes(c));
    if (hasLungIssue) {
      return {
        hasWarning: true,
        reason: `Pre-existing lung condition matches predicted ${category} spread in ${patient.city}. Severe exacerbation risk.`,
        level: 'Critical Warning'
      };
    }
  }

  // 2. Vector-Borne or Water-Borne Risk check
  if (category === 'Vector-Borne' || category === 'Water-Borne') {
    const hasImmuneIssue = conditions.some(c => IMMUNE_GUT_CONDITIONS.includes(c));
    if (hasImmuneIssue) {
      return {
        hasWarning: true,
        reason: `Compromised immunity or diabetes makes patient highly susceptible to ${category} diseases like ${diseases[0]}.`,
        level: 'High Warning'
      };
    }
  }

  // 3. Heat-Related Risk check
  if (category === 'Heat-Related') {
    const hasHeartIssue = conditions.some(c => HEAT_VULNERABLE_CONDITIONS.includes(c));
    if (hasHeartIssue) {
      return {
        hasWarning: true,
        reason: `Cardiovascular condition increases vulnerability during extreme heatwaves.`,
        level: 'High Warning'
      };
    }
  }

  // If no specific vulnerabilities match, but risk is very high overall
  if (riskLevel === 'Critical') {
    return {
      hasWarning: true,
      reason: `Area is facing a critical ${category} outbreak. Standard precautions advised.`,
      level: 'Elevated Alert'
    };
  }

  return {
    hasWarning: false,
    reason: `Patient conditions (${conditions.join(', ')}) do not strongly correlate with the ${category} risk.`,
    level: 'Monitoring'
  };
};
