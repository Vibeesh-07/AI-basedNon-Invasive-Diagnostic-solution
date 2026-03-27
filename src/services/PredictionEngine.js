// Core logic for predicting disease outbreaks based on weather data and news sentiment.
// In a real production system, this would be an ML model running in the backend.

export const generatePrediction = (weather, news) => {
  const risks = [];

  const temp = weather.temperature;
  const humidity = weather.humidity;
  const rain = weather.precipitation;

  // 1. Vector-Borne Diseases (Dengue, Malaria, Zika)
  // Thrive in high temperature and high humidity
  if (temp > 25 && humidity > 65) {
    let riskLevel = 'Moderate';
    if (temp > 28 && humidity > 75) riskLevel = 'High';
    if (temp > 30 && humidity > 85) riskLevel = 'Critical';
    
    risks.push({
      category: 'Vector-Borne',
      diseases: ['Dengue', 'Malaria', 'Zika'],
      riskLevel,
      factors: ['High Temperature', 'High Humidity'],
      score: temp * humidity / 100 // Abstract score for sorting
    });
  }

  // 2. Water-Borne Diseases (Cholera, Typhoid)
  // Triggered by heavy rainfall / flooding
  if (rain > 10 || (humidity > 80 && temp > 20)) {
    let riskLevel = 'Moderate';
    if (rain > 25) riskLevel = 'High';
    if (rain > 50) riskLevel = 'Critical';

    risks.push({
      category: 'Water-Borne',
      diseases: ['Cholera', 'Typhoid', 'Leptospirosis'],
      riskLevel,
      factors: ['Recent Precipitation', 'Stagnant Water Risks'],
      score: rain * 2
    });
  }

  // 3. Respiratory Diseases (Flu, Airborne viruses)
  // Thrive in lower temperatures and varying humidity
  if (temp < 15) {
    let riskLevel = 'Moderate';
    if (temp < 5) riskLevel = 'High';

    risks.push({
      category: 'Respiratory',
      diseases: ['Influenza', 'Common Cold', 'Pneumonia'],
      riskLevel,
      factors: ['Low Temperature'],
      score: (20 - temp) * 2
    });
  }

  // 4. Heat-Related Illnesses
  if (temp > 35) {
    risks.push({
      category: 'Heat-Related',
      diseases: ['Heatstroke', 'Dehydration'],
      riskLevel: temp > 40 ? 'Critical' : 'High',
      factors: ['Extreme Heat'],
      score: temp
    });
  }

  // Sort risks by score descending
  risks.sort((a, b) => b.score - a.score);

  // Fallback if no specific high risk
  if (risks.length === 0) {
    risks.push({
      category: 'General',
      diseases: ['Standard Seasonal Ailments'],
      riskLevel: 'Low',
      factors: ['Normal Weather Conditions'],
      score: 0
    });
  }

  // Create the final JSON Payload that the EHR / Main system will consume
  const predictionPayload = {
    timestamp: new Date().toISOString(),
    primaryRisk: risks[0],
    allRisks: risks,
    weatherContext: weather,
    newsContext: news
  };

  return predictionPayload;
};
