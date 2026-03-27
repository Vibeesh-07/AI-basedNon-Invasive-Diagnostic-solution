import { useState, useEffect } from 'react';
import { getCoordinates, getWeatherData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { Search, Thermometer, Droplets, CloudRain, AlertTriangle, Newspaper, Server, Copy, Check } from 'lucide-react';

function Radar() {
  const [location, setLocation] = useState('Chennai');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [predictionData, setPredictionData] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchAllData = async (loc) => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCoordinates(loc);
      const [weather, news] = await Promise.all([
        getWeatherData(coords.lat, coords.lon),
        fetchLocalNews(coords.name)
      ]);
      const result = generatePrediction(weather, news);
      result.locationInfo = coords;
      setPredictionData(result);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch data. Please try another location.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData(location);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setLocation(searchInput);
    fetchAllData(searchInput);
    setSearchInput('');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(predictionData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRiskColorClass = (level) => {
    switch(level) {
      case 'Low': return 'risk-level-low';
      case 'Moderate': return 'risk-level-moderate';
      case 'High': return 'risk-level-high';
      case 'Critical': return 'risk-level-critical';
      default: return 'risk-level-low';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Global Environmental Radar</h2>
          <p>Real-time environment & news disease risk analysis</p>
        </div>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', maxWidth: '300px', width: '100%' }}>
          <input 
            type="text" 
            placeholder="Search city..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={18} />
          </button>
        </form>
      </div>

      {error && (
        <div className="glass-panel" style={{ borderLeft: '4px solid var(--risk-critical)', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--risk-critical)' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <p className="animate-fade-in" style={{ fontSize: '1.2rem', color: 'var(--accent-blue)' }}>Analyzing environment data...</p>
        </div>
      ) : predictionData ? (
        <div className="animate-fade-in">
          <div className="glass-panel" style={{ 
            marginBottom: '1.5rem', 
            background: 'linear-gradient(145deg, rgba(25, 28, 41, 0.8), rgba(15, 17, 26, 0.9))',
            borderTop: `4px solid ${predictionData.primaryRisk.riskLevel === 'Low' ? 'var(--risk-low)' : 
                                    predictionData.primaryRisk.riskLevel === 'Moderate' ? 'var(--risk-moderate)' : 
                                    predictionData.primaryRisk.riskLevel === 'High' ? 'var(--risk-high)' : 'var(--risk-critical)'}`
          }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
              Primary Threat Assessment for <span style={{ color: 'var(--text-primary)' }}>{predictionData.locationInfo.name}, {predictionData.locationInfo.country}</span>
            </h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <AlertTriangle size={32} color={
                predictionData.primaryRisk.riskLevel === 'Low' ? 'var(--risk-low)' : 
                predictionData.primaryRisk.riskLevel === 'Moderate' ? 'var(--risk-moderate)' : 
                predictionData.primaryRisk.riskLevel === 'High' ? 'var(--risk-high)' : 'var(--risk-critical)'
              } />
              <div>
                <h3 style={{ fontSize: '2rem', margin: 0 }}>{predictionData.primaryRisk.category}</h3>
                <p style={{ margin: 0, marginTop: '0.25rem' }}>
                  <span className={`risk-badge ${getRiskColorClass(predictionData.primaryRisk.riskLevel)}`}>
                    {predictionData.primaryRisk.riskLevel} Risk
                  </span>
                </p>
              </div>
            </div>

             <div style={{ marginTop: '1.5rem' }}>
              <p style={{ marginBottom: '0.5rem' }}><strong>Potential Diseases:</strong> {predictionData.primaryRisk.diseases.join(', ')}</p>
              <p><strong>Trigger Factors:</strong> {predictionData.primaryRisk.factors.join(', ')}</p>
            </div>
          </div>

          <div className="grid-layout">
            <div className="glass-panel">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Thermometer size={20} color="var(--accent-blue)" />
                Current Environment
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Temperature</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{predictionData.weatherContext.temperature}°C</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Droplets size={16}/> Humidity</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{predictionData.weatherContext.humidity}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><CloudRain size={16}/> Precipitation</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{predictionData.weatherContext.precipitation} mm</span>
                </div>
              </div>
            </div>

            <div className="glass-panel col-span-2">
               <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Newspaper size={20} color="var(--accent-purple)" />
                Local Health News Signals (Simulated)
              </h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {predictionData.newsContext.articles.map((article, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <p style={{ fontWeight: 500, margin: 0 }}>"{article.title}"</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Source: {article.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

           <div className="glass-panel" style={{ marginTop: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
               <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)' }}>
                <Server size={20} />
                JSON Payload Export
              </h3>
              <button 
                onClick={copyToClipboard} 
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {copied ? <Check size={16} color="var(--risk-low)"/> : <Copy size={16} />}
                {copied ? 'Copied JSON!' : 'Copy Payload'}
              </button>
             </div>
             <pre style={{ 
               background: '#090a0f', 
               padding: '1rem', 
               borderRadius: '8px', 
               overflowX: 'auto', 
               fontSize: '0.85rem',
               border: '1px solid var(--surface-border)'
             }}>
{JSON.stringify(predictionData, null, 2)}
             </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Radar;
