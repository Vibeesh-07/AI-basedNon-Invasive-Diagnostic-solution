import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, Plus, User, MapPin, Calendar,
  Heart, Activity, Wind, ChevronRight,
  AlertTriangle, CheckCircle, TrendingUp, Loader2,
  FileText, Sparkles, Copy, Check, RotateCcw
} from 'lucide-react';
import { getEnvironmentalData } from '../services/WeatherService';
import { getDiagnoses } from '../services/PatientDBService';
import { summarizeTranscription } from '../services/OllamaService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzePatientRisk } from '../services/AgenticEHRService';
import { sendRiskAlertEmail } from '../services/EmailService';


const MODEL_META = {
  brain:     { label: 'Brain Tumor MRI',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  skin:      { label: 'Skin Cancer',         color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  alzheimer: { label: "Alzheimer's MRI",     color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  tb:        { label: 'Tuberculosis X-Ray',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)'   },
};



function PatientProfileView({ patient, navigate }) {
  const [envData, setEnvData] = useState(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [firestoreDiagnoses, setFirestoreDiagnoses] = useState([]);
  const [diagLoading, setDiagLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking' | 'ok' | 'fallback'

  // Risk state
  const [environmentalRisk, setEnvironmentalRisk] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertStatus, setAlertStatus] = useState(null);

  // Transcription state
  const [transcriptionText, setTranscriptionText] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [transcriptionError, setTranscriptionError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!patient?.city) return;
    setEnvLoading(true);

    Promise.all([
      getEnvironmentalData(patient.city),
      fetchLocalNews(patient.city).catch(() => ({ articles: [] }))
    ]).then(([env, news]) => {
      setEnvData(env);
      const prediction = generatePrediction(env.weather, news);
      let riskAnalysis = analyzePatientRisk(patient, prediction);
      
      // Overriding Agentic check for AQI-Specific Vulnerabilities (Since PredictionEngine only tracks weather/temp)
      if (env.aqi && env.aqi.european_aqi > 60 && patient.preExistingConditions?.some(c => ['COPD', 'Asthma'].includes(c))) {
        riskAnalysis = {
           hasWarning: true,
           level: 'Critical Warning',
           reason: `Severely poor air quality in ${patient.city} (AQI: ${env.aqi.european_aqi}) poses an immediate acute threat to your pre-existing respiratory conditions.`
        };
        if (!prediction.primaryRisk) prediction.primaryRisk = {};
        prediction.primaryRisk.category = 'Respiratory';
      }
      
      // If there's an actual risk payload, we bind the category for the email service
      if (riskAnalysis) {
        riskAnalysis.category = prediction?.primaryRisk?.category || 'General';
      }
      setEnvironmentalRisk(riskAnalysis);
    })
    .catch(() => setEnvData(null))
    .finally(() => setEnvLoading(false));

  }, [patient?.city, patient]);

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

        {/* ── Environmental Risk Banner & Email Alert ────────────────────── */}
        {environmentalRisk?.hasWarning && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} color="var(--risk-high)" />
              </div>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--risk-high)', marginBottom: '0.25rem' }}>
                  Action Required: Elevated {environmentalRisk.category} Risk
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {environmentalRisk.reason}
                </p>
                
                {alertStatus && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: alertStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${alertStatus.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {alertStatus.type === 'success' ? <CheckCircle size={16} color="var(--risk-low)" /> : <AlertTriangle size={16} color="var(--risk-high)" />}
                    <span style={{ fontSize: '0.85rem', color: alertStatus.type === 'success' ? 'var(--risk-low)' : 'var(--risk-high)' }}>
                      {alertStatus.message}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                <button
                  onClick={async () => {
                    setSendingAlert(true);
                    setAlertStatus(null);
                    try {
                      const res = await sendRiskAlertEmail(patient, {
                        ...environmentalRisk,
                        diseases: environmentalRisk.diseases || [environmentalRisk.category],
                        reasoning: environmentalRisk.reason
                      });
                      setAlertStatus({ type: 'success', message: res.simulated ? 'Placeholder simulation successful.' : 'Risk alert securely dispatched to patient.' });
                    } catch (err) {
                      setAlertStatus({ type: 'error', message: err.message });
                    } finally {
                      setSendingAlert(false);
                    }
                  }}
                  disabled={sendingAlert || (alertStatus?.type === 'success')}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--risk-high)', padding: '12px 20px', borderRadius: '10px' }}
                >
                  {sendingAlert ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Dispatching Alert…</>
                  ) : (
                    <><Wind size={16} /> Send Risk Alert via Email</>
                  )}
                </button>
              </div>
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

        {/* ── Transcription Section ─────────────────────────────────────── */}
        <div
          className="glass-panel"
          style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem', animation: 'fadeIn 0.6s ease' }}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--accent-purple)" />
              Clinical Transcription
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.2)', fontWeight: 500 }}>
                gemma3:4b · Ollama
              </span>
            </h3>
            {transcriptionResult && (
              <button
                onClick={() => { setTranscriptionResult(null); setTranscriptionText(''); setTranscriptionError(null); }}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <RotateCcw size={14} /> New Transcription
              </button>
            )}
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Input area */}
            {!transcriptionResult && (
              <>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={transcriptionText}
                    onChange={e => setTranscriptionText(e.target.value)}
                    placeholder={`Paste or type clinical notes, doctor's observations, consultation summaries, or any medical text here…\n\nExample: Patient presented with persistent dry cough for 3 weeks, low-grade fever (38.1°C), and mild fatigue. Chest X-ray shows right upper lobe infiltrates. SpO₂ at 96%.`}
                    rows={8}
                    disabled={transcribing}
                    style={{
                      resize: 'vertical',
                      minHeight: '160px',
                      fontFamily: 'inherit',
                      fontSize: '0.88rem',
                      lineHeight: '1.6',
                      padding: '1rem',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)',
                      width: '100%',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    bottom: '0.6rem',
                    right: '0.75rem',
                    fontSize: '0.7rem',
                    color: transcriptionText.length > 4000 ? 'var(--risk-high)' : 'var(--text-muted)',
                  }}>
                    {transcriptionText.length} chars
                  </span>
                </div>

                {transcriptionError && (
                  <div style={{ padding: '0.875rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <AlertTriangle size={16} color="var(--risk-high)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--risk-high)', fontWeight: 600, marginBottom: '0.2rem' }}>Summarization Failed</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{transcriptionError}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Make sure Ollama is running: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px' }}>ollama serve</code></p>
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!transcriptionText.trim()) return;
                    setTranscribing(true);
                    setTranscriptionError(null);
                    try {
                      const result = await summarizeTranscription(transcriptionText, patient);
                      setTranscriptionResult(result);
                    } catch (err) {
                      setTranscriptionError(err.message || 'Unknown error from Ollama.');
                    } finally {
                      setTranscribing(false);
                    }
                  }}
                  disabled={!transcriptionText.trim() || transcribing}
                  style={{
                    alignSelf: 'flex-end',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '11px 24px',
                    borderRadius: '10px',
                    background: !transcriptionText.trim() || transcribing
                      ? 'rgba(255,255,255,0.07)'
                      : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: !transcriptionText.trim() || transcribing ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: !transcriptionText.trim() || transcribing ? 'not-allowed' : 'pointer',
                    boxShadow: !transcriptionText.trim() || transcribing ? 'none' : '0 6px 20px rgba(139,92,246,0.4)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {transcribing ? (
                    <>
                      <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                      Summarizing with gemma3…
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />
                      Generate Summary
                    </>
                  )}
                </button>

                {transcribing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', width: '70%', animation: 'slide 1.8s ease-in-out infinite', borderRadius: '2px' }} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', textAlign: 'center' }}>
                      gemma3:4b is reading the clinical notes…
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Results */}
            {transcriptionResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.4s ease' }}>

                {/* Flags — shown first if present */}
                {transcriptionResult.flags?.length > 0 && (
                  <div style={{ padding: '1rem 1.25rem', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--risk-high)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={15} /> Critical Flags
                    </h4>
                    <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {transcriptionResult.flags.map((f, i) => (
                        <li key={i} style={{ fontSize: '0.87rem', color: 'var(--risk-high)', lineHeight: 1.5 }}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                <div style={{ padding: '1.25rem', borderRadius: '10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} /> AI Summary
                    </h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(transcriptionResult.summary);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copied ? <Check size={13} color="var(--risk-low)" /> : <Copy size={13} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.65 }}>
                    {transcriptionResult.summary}
                  </p>
                </div>

                {/* Key points */}
                {transcriptionResult.keyPoints?.length > 0 && (
                  <div style={{ padding: '1.25rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} /> Key Clinical Points
                    </h4>
                    <ul style={{ paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none' }}>
                      {transcriptionResult.keyPoints.map((kp, i) => (
                        <li key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.87rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)', flexShrink: 0, marginTop: '0.45rem' }} />
                          {kp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Model attribution */}
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Generated by <strong style={{ color: 'var(--text-secondary)' }}>gemma3:4b</strong> via local Ollama · Not a substitute for clinical judgment.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PatientProfileView;
