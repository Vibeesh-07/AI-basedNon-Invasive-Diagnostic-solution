import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, Plus, User, MapPin, Calendar,
  Heart, Activity, Clock, Wind, ChevronRight,
  AlertTriangle, CheckCircle, TrendingUp, Loader2
} from 'lucide-react';
import { getEnvironmentalData } from '../services/WeatherService';
import { getDiagnoses } from '../services/PatientDBService';

const MODEL_META = {
  brain:     { label: 'Brain Tumor MRI',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  skin:      { label: 'Skin Cancer',         color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  alzheimer: { label: "Alzheimer's MRI",     color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  tb:        { label: 'Tuberculosis X-Ray',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)'   },
};

const VITAL_icons = {
  bp: '💉', heartRate: '❤️', spo2: '🫁', temp: '🌡️',
};

function PatientProfileView({ patient, navigate }) {
  const [envData, setEnvData] = useState(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [firestoreDiagnoses, setFirestoreDiagnoses] = useState([]);
  const [diagLoading, setDiagLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking' | 'ok' | 'fallback'

  useEffect(() => {
    if (!patient?.city) return;
    getEnvironmentalData(patient.city)
      .then(setEnvData)
      .catch(() => setEnvData(null))
      .finally(() => setEnvLoading(false));
  }, [patient?.city]);

  useEffect(() => {
    if (!patient?.id) return;
    getDiagnoses(patient.id)
      .then(data => {
        setFirestoreDiagnoses(data);
        setDbStatus(data.length >= 0 ? 'ok' : 'fallback');
      })
      .catch(() => setDbStatus('fallback'))
      .finally(() => setDiagLoading(false));
  }, [patient?.id]);

  if (!patient) return null;

  // Merge session history + Firestore history (Firestore first as it's persisted)
  const allHistory = [
    ...firestoreDiagnoses.map(d => ({ ...d, source: 'firestore' })),
    ...(patient.diagnosisHistory ?? []).map(d => ({ ...d, source: 'session' })),
  ].sort((a, b) => new Date(b.savedAt || b.timestamp) - new Date(a.savedAt || a.timestamp));

  const initials = patient.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const aqi = envData?.aqi;
  const weather = envData?.weather;

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
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span
            onClick={() => navigate('list')}
            style={{ cursor: 'pointer', color: 'var(--accent-teal)', fontWeight: 500 }}
          >
            Patients
          </span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{patient.name}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* DB Status chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: dbStatus === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${dbStatus === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, fontSize: '0.72rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dbStatus === 'ok' ? 'var(--risk-low)' : dbStatus === 'checking' ? 'var(--risk-moderate)' : 'var(--risk-moderate)', display: 'inline-block' }} />
          <span style={{ color: dbStatus === 'ok' ? 'var(--risk-low)' : 'var(--risk-moderate)' }}>
            {dbStatus === 'checking' ? 'Checking DB…' : dbStatus === 'ok' ? 'Firestore Connected' : 'Session Only'}
          </span>
        </div>
      </nav>

      <div className="page-content">
        {/* Back */}
        <button
          onClick={() => navigate('list')}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', padding: '7px 14px' }}
        >
          <ArrowLeft size={16} />
          Back to Patient List
        </button>

        {/* Hero Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start', marginBottom: '1.5rem', animation: 'fadeIn 0.4s ease' }}>
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{ width: 72, height: 72, borderRadius: '18px', background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>
                {initials}
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>{patient.name}</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={13} /> {patient.id}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} /> {patient.city}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> Last Visit: {patient.lastVisit}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {patient.age} yrs · {patient.gender}
                  </span>
                  {(patient.preExistingConditions || []).map((c, i) => (
                    <span key={i} className="tag">{c}</span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => navigate('diagnostic', patient.id)}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 20px', borderRadius: '12px', fontSize: '0.9rem', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Plus size={18} />
                Add Diagnostic
              </button>
            </div>
          </div>

          {/* AQI Card */}
          {aqi && (
            <div className="glass-panel" style={{ padding: '1.25rem', minWidth: '200px', animation: 'slideInLeft 0.4s ease' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Wind size={12} /> Live Environment
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: aqi.color }}>{aqi.european_aqi ?? '–'}</span>
                <span style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '20px', background: aqi.bg, color: aqi.color, border: `1px solid ${aqi.color}33`, fontWeight: 600 }}>
                  {aqi.label}
                </span>
              </div>
              {aqi.pm2_5 && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PM2.5: <strong style={{ color: aqi.color }}>{aqi.pm2_5.toFixed(1)} µg/m³</strong></p>}
              {weather && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  {weather.temperature}°C · {weather.humidity}% humidity
                </p>
              )}
            </div>
          )}
        </div>

        {/* Vitals + Conditions */}
        {patient.vitals && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Heart size={16} color="var(--risk-high)" />
              Vitals
            </h3>
            <div className="grid-4">
              {Object.entries(patient.vitals).map(([key, val]) => (
                <div key={key} style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{VITAL_icons[key] || '📊'}</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{val}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.2rem' }}>
                    {key === 'bp' ? 'Blood Pressure' : key === 'heartRate' ? 'Heart Rate' : key === 'spo2' ? 'SpO₂' : 'Temperature'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diagnosis History */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', animation: 'fadeIn 0.55s ease' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--accent-blue)" />
              Diagnosis History
              {firestoreDiagnoses.length > 0 && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: 'var(--risk-low)', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 500 }}>
                  {firestoreDiagnoses.length} in Firestore
                </span>
              )}
            </h3>
            <button
              onClick={() => navigate('diagnostic', patient.id)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              Add Diagnostic
            </button>
          </div>

          {diagLoading ? (
            <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem' }}>Loading diagnosis records…</span>
            </div>
          ) : allHistory.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Activity size={24} color="var(--accent-blue)" />
              </div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>No diagnostic records yet</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Upload the first scan to create a diagnostic history.
              </p>
              <button
                onClick={() => navigate('diagnostic', patient.id)}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '10px 20px' }}
              >
                <Plus size={16} /> Add First Diagnostic
              </button>
            </div>
          ) : (
            <>
              {/* History table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 1fr 1fr', padding: '0.6rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['Prediction', 'Type', 'Assessment', 'Confidence', 'Date'].map(h => (
                  <span key={h} style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>

              {allHistory.map((d, i) => {
                const meta = MODEL_META[d.modelType] || MODEL_META.brain;
                const isWarning = d.requiresAttention || d.hasWarning;
                const dateStr = d.savedAt || d.timestamp || '';
                const displayDate = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 1fr 1fr', padding: '0.875rem 1.5rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Prediction */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isWarning
                        ? <AlertTriangle size={14} color="var(--risk-high)" />
                        : <CheckCircle size={14} color="var(--risk-low)" />}
                      <span style={{ fontSize: '0.87rem', fontWeight: 600, color: isWarning ? 'var(--risk-high)' : 'var(--risk-low)' }}>
                        {d.prediction}
                      </span>
                    </div>

                    {/* Model type */}
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, fontWeight: 500, display: 'inline-block', width: 'fit-content' }}>
                      {meta.label}
                    </span>

                    {/* Assessment snippet */}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.reason || d.history_comparison || '—'}
                    </span>

                    {/* Confidence */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="progress-track" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${d.confidence ?? 0}%`, background: isWarning ? 'var(--risk-high)' : 'var(--risk-low)' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '32px' }}>
                        {typeof d.confidence === 'number' ? `${d.confidence}%` : '—'}
                      </span>
                    </div>

                    {/* Date */}
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{displayDate}</p>
                      {d.source === 'firestore' && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--accent-teal)', marginTop: '2px' }}>● Firestore</p>
                      )}
                      {d.source === 'session' && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>○ Session</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientProfileView;
