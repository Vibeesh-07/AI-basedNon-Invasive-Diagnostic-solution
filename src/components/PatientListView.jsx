import React, { useState, useEffect } from 'react';
import {
  Shield, Search, Users, AlertTriangle, Activity, Plus,
  ChevronRight, Thermometer, Wind, Loader2, RefreshCw
} from 'lucide-react';
import { getEnvironmentalData, getAQILabel } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';

const MODEL_COLORS = {
  brain: '#8b5cf6',
  skin: '#3b82f6',
  alzheimer: '#f97316',
  tb: '#dc2626',
};

const CONDITION_COLORS = {
  Asthma: '#f97316', COPD: '#dc2626', Diabetes: '#eab308',
  Hypertension: '#ef4444', Immunocompromised: '#a855f7',
  'Coronary Artery Disease': '#dc2626', Anemia: '#f59e0b',
  Arthritis: '#64748b', None: '#64748b',
};

function OutbreakWidget({ city }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aqi, setAqi] = useState(null);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    Promise.all([
      getEnvironmentalData(city),
      fetchLocalNews(city),
    ]).then(([envData, news]) => {
      const pred = generatePrediction(envData.weather, news);
      setData({ pred, weather: envData.weather });
      setAqi(envData.aqi);
    }).catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [city]);

  const riskColor = {
    Low: 'var(--risk-low)', Moderate: 'var(--risk-moderate)',
    High: 'var(--risk-high)', Critical: 'var(--risk-critical)',
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <AlertTriangle size={18} color="var(--accent-orange)" />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Disease Outbreak Radar
        </h3>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Region: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{city || 'Select a patient'}</span>
      </p>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem' }}>Analyzing environment…</span>
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.4s ease' }}>
          {/* Primary Risk */}
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${riskColor[data.pred.primaryRisk.riskLevel]}33`,
            borderLeft: `3px solid ${riskColor[data.pred.primaryRisk.riskLevel]}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Threat</p>
              <span className={`risk-badge risk-level-${data.pred.primaryRisk.riskLevel.toLowerCase()}`}>
                {data.pred.primaryRisk.riskLevel}
              </span>
            </div>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{data.pred.primaryRisk.category}</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {data.pred.primaryRisk.diseases.slice(0, 2).join(', ')}
            </p>
          </div>

          {/* Weather Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Thermometer size={12} /> Temperature
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.weather?.temperature}°C</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Wind size={12} /> Humidity
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.weather?.humidity}%</p>
            </div>
          </div>

          {/* AQI */}
          {aqi && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: aqi.bg,
              border: `1px solid ${aqi.color}33`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wind size={15} color={aqi.color} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Air Quality Index</span>
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: aqi.color }}>
                {aqi.european_aqi ?? '–'} · {aqi.label}
              </span>
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
          Click a patient to load their city's outbreak data.
        </p>
      )}
    </div>
  );
}

function PatientListView({ patients, loading, navigate }) {
  const [search, setSearch] = useState('');
  const [hoveredCity, setHoveredCity] = useState('Chennai');

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.id?.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase())
  );

  const latestDiagnosis = (p) => {
    const h = p.diagnosisHistory ?? [];
    if (h.length === 0) return null;
    return h[h.length - 1];
  };

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Sentinel 3
            </h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1 }}>
              AI Diagnostic EHR · Agentic
            </p>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--risk-low)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--risk-low)', display: 'inline-block', boxShadow: '0 0 8px var(--risk-low)' }} />
            Backend Online
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--accent-purple)' }}>
            <Activity size={12} />
            Agentic Engine Active
          </span>
        </div>
      </nav>

      <div className="page-content">
        {/* Page Header */}
        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.4s ease' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Patient Registry
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Select a patient to view their profile or add a new diagnostic.
          </p>
        </div>

        {/* Layout: Patient list + Outbreak widget */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── Left: Patient List ── */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', animation: 'fadeIn 0.45s ease' }}>
            {/* Search + Add header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search patients by name, ID, or city…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', fontSize: '0.875rem', borderRadius: '8px' }}
                />
              </div>
              
              <button 
                onClick={() => navigate('create')}
                className="btn-primary" 
                style={{ height: '38px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                <Plus size={16} />
                Add Patient
              </button>

              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                <Users size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                {filtered.length} patients
              </span>
            </div>

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 1.5fr 1.2fr 1.8fr 1fr',
              padding: '0.6rem 1.5rem',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {['Patient', 'City', 'Age / Sex', 'Conditions', 'Last Scan'].map(h => (
                <span key={h} style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="skeleton" style={{ width: '55%', height: 14 }} />
                    <div className="skeleton" style={{ width: '35%', height: 11 }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No patients match your search.
              </div>
            ) : (
              filtered.map((p, i) => {
                const last = latestDiagnosis(p);
                const initials = p.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const bgHues = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#eab308'];
                const avatarBg = bgHues[i % bgHues.length];

                return (
                  <div
                    key={p.id}
                    className="patient-row"
                    style={{
                      gridTemplateColumns: '2.5fr 1.5fr 1.2fr 1.8fr 1fr',
                      paddingLeft: '1.5rem',
                      paddingRight: '1.5rem',
                    }}
                    onClick={() => navigate('profile', p.id)}
                    onMouseEnter={() => setHoveredCity(p.city)}
                  >
                    {/* Name + Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${avatarBg}22`, border: `1px solid ${avatarBg}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: avatarBg, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0 }}>{p.name}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{p.id}</p>
                      </div>
                    </div>

                    {/* City */}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.city}</span>

                    {/* Age / Sex */}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {p.age} · {p.gender?.[0]}
                    </span>

                    {/* Conditions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(p.preExistingConditions || ['None']).slice(0, 2).map((c, ci) => (
                        <span key={ci} className="tag" style={{ color: CONDITION_COLORS[c] || 'var(--text-secondary)', borderColor: `${CONDITION_COLORS[c]}33` || 'rgba(255,255,255,0.08)' }}>
                          {c}
                        </span>
                      ))}
                      {(p.preExistingConditions || []).length > 2 && (
                        <span className="tag">+{(p.preExistingConditions || []).length - 2}</span>
                      )}
                    </div>

                    {/* Last Scan */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {last ? (
                        <span className="risk-badge" style={{
                          background: (last.requiresAttention ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'),
                          color: last.requiresAttention ? 'var(--risk-high)' : 'var(--risk-low)',
                          border: `1px solid ${last.requiresAttention ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                          fontSize: '0.68rem',
                        }}>
                          {last.prediction?.slice(0, 10)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No scans</span>
                      )}
                      <ChevronRight size={15} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Right: Outbreak widget ── */}
          <div style={{ position: 'sticky', top: 'calc(var(--navbar-height) + 1.5rem)', animation: 'slideInLeft 0.45s ease' }}>
            <OutbreakWidget city={hoveredCity} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientListView;
