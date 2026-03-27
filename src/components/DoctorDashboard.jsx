import { useState, useEffect } from 'react';
import { VALID_TN_CITIES } from '../data/mockPatients';
import { getAllPatients, seedMockPatients } from '../services/PatientDBService';
import { getCoordinates, getWeatherData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzePatientRisk } from '../services/AgenticEHRService';
import { 
  Users, Search, User, Calendar, Activity, 
  ChevronRight, Thermometer, Heart, Droplets, 
  Wind, ShieldAlert, ArrowLeft, Pill, FileText 
} from 'lucide-react';

function DoctorDashboard() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const cityPredictions = {};
      const cityData = await Promise.all(VALID_TN_CITIES.map(async (city) => {
        const coords = await getCoordinates(city);
        const [weather, news] = await Promise.all([
          getWeatherData(coords.lat, coords.lon),
          fetchLocalNews(coords.name)
        ]);
        const result = generatePrediction(weather, news);
        cityPredictions[city] = result;
      }));

      const fetchedPatients = await getAllPatients();
      const evaluated = fetchedPatients.map(p => ({
        ...p,
        riskAnalysis: analyzePatientRisk(p, cityPredictions[p.city]),
        prediction: cityPredictions[p.city]
      }));

      setPatients(evaluated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskStatusColor = (level) => {
    if (level === 'Critical Warning') return 'var(--risk-critical)';
    if (level === 'High Warning') return 'var(--risk-high)';
    if (level === 'Elevated Alert') return 'var(--risk-moderate)';
    return 'var(--text-secondary)';
  };

  if (selectedPatient) {
    return (
      <div className="animate-fade-in">
        <button 
          onClick={() => setSelectedPatient(null)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            background: 'transparent', color: 'var(--text-secondary)',
            marginBottom: '1.5rem', padding: '0.5rem 0'
          }}
        >
          <ArrowLeft size={18}/> Back to Roster
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
          {/* Patient Profile Card */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--accent-purple)', padding: '16px', borderRadius: '50%' }}>
                <User size={32} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{selectedPatient.name}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Patient ID: {selectedPatient.id}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Age / Gender</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.age} / {selectedPatient.gender}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Primary Location</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.city}, TN</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Last Visit</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.lastVisit}</p>
              </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Pill size={14}/> Pre-Existing Conditions
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
              {selectedPatient.preExistingConditions.map((c, i) => (
                <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>{c}</span>
              ))}
            </div>

            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={14}/> Current Vitals
            </h4>
            <div className="grid-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
               <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                 <p style={{ fontSize: '0.7rem' }}>BP</p>
                 <p style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>{selectedPatient.vitals.bp}</p>
               </div>
               <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                 <p style={{ fontSize: '0.7rem' }}>HR</p>
                 <p style={{ fontWeight: 600, color: 'var(--risk-high)' }}>{selectedPatient.vitals.heartRate} bpm</p>
               </div>
               <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                 <p style={{ fontSize: '0.7rem' }}>Temp</p>
                 <p style={{ fontWeight: 600, color: 'var(--risk-moderate)' }}>{selectedPatient.vitals.temp}</p>
               </div>
               <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                 <p style={{ fontSize: '0.7rem' }}>SpO2</p>
                 <p style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{selectedPatient.vitals.spo2}</p>
               </div>
            </div>
          </div>

          {/* AI Analysis View */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ 
              border: `1px solid ${selectedPatient.riskAnalysis.hasWarning ? 'var(--risk-critical)' : 'var(--surface-border)'}`,
              boxShadow: selectedPatient.riskAnalysis.hasWarning ? '0 0 20px rgba(239, 68, 68, 0.1)' : 'var(--glass-shadow)'
            }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--accent-purple)' }}>
                <ShieldAlert size={20} />
                Agentic EHR Autonomous Risk Scan
              </h3>
              
              {selectedPatient.riskAnalysis.hasWarning ? (
                <div>
                   <span style={{ 
                     background: 'rgba(239, 68, 68, 0.1)', color: 'var(--risk-critical)',
                     padding: '6px 12px', borderRadius: '999px', fontSize: '0.85rem',
                     fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.3)',
                     display: 'inline-block', marginBottom: '1rem'
                   }}>
                     {selectedPatient.riskAnalysis.level.toUpperCase()}
                   </span>
                   <p style={{ fontSize: '1.1rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                     {selectedPatient.riskAnalysis.reason}
                   </p>

                   <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                     <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Environmental Evidence</h4>
                     <div style={{ display: 'flex', gap: '2rem' }}>
                       <div>
                         <p style={{ fontSize: '0.75rem' }}>Primary Risk</p>
                         <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPatient.prediction.primaryRisk.category}</p>
                       </div>
                       <div>
                         <p style={{ fontSize: '0.75rem' }}>City Heat Index</p>
                         <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPatient.prediction.weatherContext.temperature}°C</p>
                       </div>
                     </div>
                   </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Heart size={48} color="var(--risk-low)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No immediate personalized environmental threats identified for this patient profile.</p>
                </div>
              )}
            </div>

            <div className="glass-panel">
               <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1rem' }}>
                <FileText size={18} color="var(--text-secondary)" />
                Recent Clinical Notes
              </h3>
              <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
                "Patient stable. Chronic management of {selectedPatient.preExistingConditions[0]}. 
                Suggested maintaining monitoring of local weather due to airborne sensitivity."
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>Doctor Workstation</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <p style={{ margin: 0 }}>Tamil Nadu Health Region Patient Roster</p>
            <button 
              onClick={async () => {
                await seedMockPatients();
                alert("Database seeded! Reloading patients...");
                loadAllData();
              }} 
              style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              Seed DB
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} size={18} />
          <input 
            type="text" 
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <p className="animate-fade-in" style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }}>Loading Clinical Records...</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--surface-border)' }}>
              <tr>
                <th style={{ padding: '16px 24px' }}>Patient Name</th>
                <th style={{ padding: '16px 24px' }}>ID</th>
                <th style={{ padding: '16px 24px' }}>Age</th>
                <th style={{ padding: '16px 24px' }}>Location</th>
                <th style={{ padding: '16px 24px' }}>Agentic Flag</th>
                <th style={{ padding: '16px 24px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedPatient(p)}
                  style={{ 
                    borderBottom: '1px solid var(--surface-border)', 
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  className="patient-row"
                >
                  <td style={{ padding: '16px 24px', fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{p.id}</td>
                  <td style={{ padding: '16px 24px' }}>{p.age}</td>
                  <td style={{ padding: '16px 24px' }}>{p.city}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      color: getRiskStatusColor(p.riskAnalysis.level),
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.85rem', fontWeight: 600
                    }}>
                      {p.riskAnalysis.hasWarning ? <ShieldAlert size={16}/> : <Heart size={16}/>}
                      {p.riskAnalysis.level}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <ChevronRight size={20} color="var(--text-secondary)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
