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

/**
 * Analyzes an image diagnosis result contextually against the patient's existing EHR parameters
 * and the local environmental risk predictions.
 */
export const analyzeImageDiagnosisRisk = (patient, cityPrediction, imageDiagnosis) => {
  if (!patient || !cityPrediction || !imageDiagnosis) return null;

  const hasBrainCondition = patient.preExistingConditions.some(c => 
    c.toLowerCase().includes('neurological') || 
    c.toLowerCase().includes('seizure') || 
    c.toLowerCase().includes('migraine')
  );
  
  const olderAdult = patient.age >= 60;
  
  let agenticReasoning = '';
  // Base risk level on the image diagnosis primarily
  let agenticRiskLevel = imageDiagnosis.requires_attention ? 'Critical Warning' : 'Safe';
  let hasWarning = imageDiagnosis.requires_attention;

  const { primaryRisk } = cityPrediction;

  if (imageDiagnosis.requires_attention) {
    agenticReasoning += `AI identified a high-confidence ${imageDiagnosis.prediction} pattern. `;
    
    if (olderAdult) {
      agenticReasoning += `Given the patient's advanced age (${patient.age}), they are at higher risk for rapid progression. `;
    }
    
    if (hasBrainCondition) {
      agenticReasoning += `History of neurological conditions strongly compounds this finding. `;
    }
    
    if (primaryRisk && (primaryRisk.riskLevel === 'High' || primaryRisk.riskLevel === 'Critical')) {
      agenticReasoning += `Furthermore, the current ${primaryRisk.riskLevel} ${primaryRisk.category} environmental hazard in ${patient.city} causes severe physiological stress, which may unexpectedly worsen symptoms. `;
    }
  } else {
    agenticReasoning += `AI categorized scan as ${imageDiagnosis.prediction}. No acute imaging abnormalities detected. `;
    
    if (primaryRisk && (primaryRisk.riskLevel === 'High' || primaryRisk.riskLevel === 'Critical')) {
      agenticReasoning += `However, due to a severe ${primaryRisk.category} hazard in ${patient.city}, the patient should still be monitored for generalized environmental stress affecting immunity.`;
      hasWarning = true;
      agenticRiskLevel = 'Elevated Alert';
    } else {
      agenticReasoning += `Overall profile is stable with no immediate compounding environmental threats in ${patient.city}.`;
    }
  }

  return {
    level: agenticRiskLevel,
    reason: agenticReasoning.trim(),
    hasWarning
  };
};
