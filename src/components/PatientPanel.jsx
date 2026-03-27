import React from 'react';
import { User, Wind, Clock, ChevronDown } from 'lucide-react';

/**
 * PatientPanel — Shared reusable component for all diagnostic dashboards.
 * Displays patient selector, patient card, AQI indicator, and session history.
 *
 * Props:
 *  - patients: Array of patient objects
 *  - selectedPatientId: string
 *  - onSelectPatient: (id) => void
 *  - aqi: AQI data object from WeatherService { label, color, bg, european_aqi, pm2_5 }
 *  - envLoading: boolean
 *  - modelType: 'brain' | 'skin' | 'alzheimer' | 'tb'
 *  - accentColor: CSS color string for theming
 */
const PatientPanel = ({
  patients = [],
  selectedPatientId,
  onSelectPatient,
  aqi,
  envLoading = false,
  modelType = 'brain',
  accentColor = 'var(--accent-blue)',
}) => {
  const patient = patients.find(p => p.id === selectedPatientId);

  // Get diagnosis history filtered by modelType from the patient's diagnosisHistory
  const sessionHistory = patient?.diagnosisHistory
    ?.filter(h => h.modelType === modelType)
    .slice(-3)
    .reverse() ?? [];

  const modelLabel = {
    brain: 'Brain Tumor',
    skin: 'Skin Cancer',
    alzheimer: "Alzheimer's",
    tb: 'Tuberculosis',
  }[modelType] ?? modelType;

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.5rem', marginBottom: '2rem' }}
    >
      {/* Header */}
      <h3
        style={{
          fontSize: '1.05rem',
          marginBottom: '1rem',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <User size={18} color={accentColor} />
        Patient Assignment
      </h3>

      {/* Selector */}
      <div style={{ position: 'relative' }}>
        <select
          value={selectedPatientId}
          onChange={e => onSelectPatient(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 2.5rem 0.75rem 0.875rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.25)',
            color: 'var(--text-primary)',
            border: `1px solid ${selectedPatientId ? accentColor : 'var(--surface-border)'}`,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            fontSize: '0.9rem',
            transition: 'border-color 0.2s ease',
          }}
        >
          <option value="">— Select a Patient Profile —</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id}) · {p.city}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--text-secondary)',
          }}
        />
      </div>

      {/* Patient Card */}
      {patient && (
        <div
          style={{
            marginTop: '1rem',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}
        >
          {/* Top strip */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <p
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                {patient.name}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {patient.id} · {patient.city}
              </p>
            </div>
            {/* AQI Pill */}
            {envLoading ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  padding: '0.3rem 0.75rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Fetching AQI…
              </span>
            ) : aqi ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: aqi.color,
                  padding: '0.3rem 0.75rem',
                  background: aqi.bg,
                  border: `1px solid ${aqi.color}44`,
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Wind size={12} />
                AQI {aqi.european_aqi ?? '–'} · {aqi.label}
              </span>
            ) : null}
          </div>

          {/* Details grid */}
          <div
            style={{
              padding: '0.85rem 1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                Demographics
              </p>
              <p style={{ fontSize: '0.87rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                {patient.age} yrs · {patient.gender}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                Last Visit
              </p>
              <p style={{ fontSize: '0.87rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                {patient.lastVisit}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Pre-existing Conditions
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {patient.preExistingConditions.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '1px 7px',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {patient.vitals && (
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  Vitals
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  BP: {patient.vitals.bp} · HR: {patient.vitals.heartRate}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  SpO₂: {patient.vitals.spo2} · Temp: {patient.vitals.temp}
                </p>
              </div>
            )}
          </div>

          {/* PM details row */}
          {aqi && aqi.pm2_5 != null && (
            <div
              style={{
                padding: '0.6rem 1rem',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                gap: '1.5rem',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>PM2.5: <strong style={{ color: aqi.color }}>{aqi.pm2_5?.toFixed(1)} µg/m³</strong></span>
              {aqi.pm10 != null && <span>PM10: <strong>{aqi.pm10?.toFixed(1)} µg/m³</strong></span>}
              {aqi.nitrogen_dioxide != null && <span>NO₂: <strong>{aqi.nitrogen_dioxide?.toFixed(1)} µg/m³</strong></span>}
            </div>
          )}

          {/* Session History Timeline */}
          {sessionHistory.length > 0 && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Clock size={11} />
                {modelLabel} History (this session)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {sessionHistory.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      background: i === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        color: h.requiresAttention ? 'var(--risk-critical)' : 'var(--risk-low)',
                        fontWeight: i === 0 ? '600' : '400',
                      }}
                    >
                      {i === 0 ? '● ' : '○ '}
                      {h.prediction}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientPanel;
