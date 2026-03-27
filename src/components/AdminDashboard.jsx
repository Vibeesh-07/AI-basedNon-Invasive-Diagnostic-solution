import { useState, useEffect } from 'react';
import { VALID_TN_CITIES } from '../data/mockPatients';
import { getCoordinates, getWeatherData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { MapPin, Activity, AlertTriangle, Users, Globe } from 'lucide-react';

function AdminDashboard() {
  const [cityStats, setCityStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTNStatus = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(VALID_TN_CITIES.map(async (city) => {
        const coords = await getCoordinates(city);
        const [weather, news] = await Promise.all([
          getWeatherData(coords.lat, coords.lon),
          fetchLocalNews(coords.name)
        ]);
        const prediction = generatePrediction(weather, news);
        return { city, prediction, weather };
      }));
      setCityStats(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTNStatus();
  }, []);

  const getRiskColor = (level) => {
    if (level === 'Critical') return 'var(--risk-critical)';
    if (level === 'High') return 'var(--risk-high)';
    if (level === 'Moderate') return 'var(--risk-moderate)';
    return 'var(--risk-low)';
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={24} color="var(--accent-blue)" />
          Tamil Nadu Regional Health Oversight
        </h2>
        <p>Live environmental monitoring across primary administrative districts.</p>
      </header>

      <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <Users size={24} color="var(--accent-blue)" />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Registered Patients</p>
            <h3 style={{ fontSize: '1.5rem' }}>142</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <AlertTriangle size={24} color="var(--risk-high)" />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Outbreak Alerts</p>
            <h3 style={{ fontSize: '1.5rem' }}>{cityStats.filter(s => s.prediction.primaryRisk.riskLevel !== 'Low').length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(20, 184, 166, 0.1)', padding: '12px', borderRadius: '12px' }}>
             <Globe size={24} color="var(--accent-teal)" />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monitoring Coverage</p>
            <h3 style={{ fontSize: '1.5rem' }}>100%</h3>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>District Health Status</h3>
      
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <p className="animate-fade-in" style={{ fontSize: '1.1rem', color: 'var(--accent-blue)' }}>Syncing regional city nodes...</p>
        </div>
      ) : (
        <div className="grid-layout">
          {cityStats.map((stat, i) => (
            <div key={i} className="glass-panel" style={{ borderTop: `4px solid ${getRiskColor(stat.prediction.primaryRisk.riskLevel)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <MapPin size={18} color="var(--text-secondary)" />
                  {stat.city}
                </h4>
                <span style={{ 
                  fontSize: '0.7rem', 
                  background: getRiskColor(stat.prediction.primaryRisk.riskLevel), 
                  color: 'white', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  fontWeight: 600
                }}>
                  {stat.prediction.primaryRisk.riskLevel.toUpperCase()}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.7rem' }}>Primary Risk</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.prediction.primaryRisk.category}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.7rem' }}>Temperature</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.weather.temperature}°C</p>
                </div>
              </div>

               <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                <p><strong>Common Threats:</strong> {stat.prediction.primaryRisk.diseases.slice(0, 2).join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
