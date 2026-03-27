import { useState, useEffect } from 'react';
import { VALID_TN_CITIES } from '../data/mockPatients';
import { getAllPatients } from '../services/PatientDBService';
import { getCoordinates, getWeatherData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzePatientRisk } from '../services/AgenticEHRService';
import { Activity, Wind, AlertCircle, ShieldAlert, HeartPulse, Stethoscope } from 'lucide-react';

function EHR() {
  const [patientsWithRisk, setPatientsWithRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  // We fetch predictions for all valid cities in TN, cache them, then evaluate patients
  const fetchAllVulnerabilities = async () => {
    setLoading(true);
    try {
      // 1. Fetch predictions for all TN cities in parallel
      const cityPredictions = {};
      const promises = VALID_TN_CITIES.map(async (city) => {
        const coords = await getCoordinates(city);
        const [weather, news] = await Promise.all([
          getWeatherData(coords.lat, coords.lon),
          fetchLocalNews(coords.name)
        ]);
        const result = generatePrediction(weather, news);
        cityPredictions[city] = result;
      });

      await Promise.all(promises);

      // 2. Evaluate each patient using the AgenticEHRService
      const fetchedPatients = await getAllPatients();
      const evaluatedPatients = fetchedPatients.map(patient => {
        const prediction = cityPredictions[patient.city];
        const riskAnalysis = analyzePatientRisk(patient, prediction);
        return {
          ...patient,
          riskAnalysis,
          environmentalContext: prediction
        };
      });

      // Sort by risk priority
      evaluatedPatients.sort((a, b) => {
        if (a.riskAnalysis.hasWarning && !b.riskAnalysis.hasWarning) return -1;
        if (!a.riskAnalysis.hasWarning && b.riskAnalysis.hasWarning) return 1;
        if (a.riskAnalysis.level === 'Critical Warning') return -1;
        return 0;
      });

      setPatientsWithRisk(evaluatedPatients);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllVulnerabilities();
  }, []);

  const getWarningColor = (level) => {
    if (level === 'Critical Warning') return 'var(--risk-critical)';
    if (level === 'High Warning') return 'var(--risk-high)';
    if (level === 'Elevated Alert') return 'var(--risk-moderate)';
    return 'var(--text-secondary)';
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Stethoscope size={24} />
          Tamil Nadu Agentic EHR Roster
        </h2>
        <p>Autonomously evaluating patient vulnerability against local environmental threats.</p>
      </div>

      {loading ? (
         <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <p className="animate-fade-in" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }}>Agentic Engine evaluating patient records...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {patientsWithRisk.map(patient => (
            <div 
              key={patient.id} 
              className="glass-panel animate-fade-in"
              style={{
                borderLeft: patient.riskAnalysis.hasWarning ? `4px solid ${getWarningColor(patient.riskAnalysis.level)}` : '1px solid var(--surface-border)',
                background: patient.riskAnalysis.hasWarning ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-color)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                
                {/* Patient Profile */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{patient.name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({patient.age} y/o)</span></h3>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <Activity size={14} color="var(--accent-blue)"/> ID: {patient.id} | City: {patient.city}
                  </p>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Conditions: </span>
                    {patient.preExistingConditions.map((cond, i) => (
                      <span key={i} style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem', 
                        marginRight: '6px' 
                      }}>
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Agentic Warning Assessment */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                  {patient.riskAnalysis.hasWarning ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                       <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          color: getWarningColor(patient.riskAnalysis.level),
                          fontWeight: 600,
                          background: 'rgba(0,0,0,0.3)',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '0.85rem',
                          border: `1px solid ${getWarningColor(patient.riskAnalysis.level)}`
                       }}>
                         <ShieldAlert size={16} />
                         AGENTIC FLAG: {patient.riskAnalysis.level.toUpperCase()}
                       </span>
                       <p style={{ fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4, color: 'var(--text-primary)' }}>
                          {patient.riskAnalysis.reason}
                       </p>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <HeartPulse size={16} /> Patient is not uniquely vulnerable to local conditions.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EHR;
