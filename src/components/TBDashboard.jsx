import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, X, Wind, Layers, ShieldAlert, TrendingUp } from 'lucide-react';
import PatientPanel from './PatientPanel';
import { getEnvironmentalData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzeImageDiagnosisRisk } from '../services/AgenticEHRService';

const API_URL = 'http://localhost:5000';

const SEVERITY = {
  'Normal':       { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  text: 'var(--risk-low)',      badge: '#10b981' },
  'Tuberculosis': { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   text: 'var(--risk-critical)', badge: '#ef4444' },
};

const CLINICAL_NOTE = {
  'Normal':       'No signs of Tuberculosis detected in this X-ray. Lung fields appear clear.',
  'Tuberculosis': 'Clear indicators of Tuberculosis detected. Immediate respiratory isolation and pulmonologist referral is essential.',
};

const ACCENT = '#dc2626';

const TBDashboard = ({ patients = [], recordDiagnosis }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [agenticResult, setAgenticResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [envData, setEnvData] = useState(null);
  const [envLoading, setEnvLoading] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    if (!selectedPatient) { setEnvData(null); return; }
    setEnvLoading(true);
    getEnvironmentalData(selectedPatient.city)
      .then(data => setEnvData(data))
      .catch(() => setEnvData(null))
      .finally(() => setEnvLoading(false));
  }, [selectedPatientId]);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    setError(null); setResult(null); setAgenticResult(null); setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null); setSelectedFile(null); setResult(null); setAgenticResult(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeScan = async () => {
    if (!selectedFile) return;
    if (!selectedPatientId) { setError('Please select a patient before running analysis.'); return; }

    setIsAnalyzing(true); setResult(null); setAgenticResult(null); setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(`${API_URL}/predict/tb`, { method: 'POST', body: formData });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      const data = await response.json();
      setResult(data);

      const currentPatient = patients.find(p => p.id === selectedPatientId);

      let weatherPrediction = null;
      if (envData) {
        const news = await fetchLocalNews(selectedPatient.city).catch(() => ({ articles: [] }));
        weatherPrediction = generatePrediction(envData.weather, news);
      }

      const agEnvData = {
        aqi: envData?.aqi ?? null,
        weather: envData?.weather ?? null,
        cityPrediction: weatherPrediction,
      };

      const enriched = analyzeImageDiagnosisRisk(currentPatient, agEnvData, data, 'tb');
      setAgenticResult(enriched);

      if (recordDiagnosis) {
        recordDiagnosis(selectedPatientId, 'tb', data.prediction, data.confidence, data.requires_attention);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to the diagnosis server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sev = result ? (SEVERITY[result.prediction] || SEVERITY['Normal']) : null;
  const isTB = result?.prediction === 'Tuberculosis';

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Wind color={ACCENT} size={28} />
            Tuberculosis Detection
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
            Custom CNN · Grayscale Input
          </p>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          Patient-linked TB detection with AQI-driven environmental correlation and cross-session history tracking.
          Binary Normal / Tuberculosis classification from chest X-rays.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.4rem 0.9rem', background: 'rgba(220,38,38,0.08)', borderRadius: '20px', border: '1px solid rgba(220,38,38,0.15)', fontSize: '0.8rem', color: ACCENT }}>
          Model: tb_classifier_v2.h5 &nbsp;|&nbsp; Binary sigmoid &nbsp;|&nbsp; 500×500 grayscale
        </div>
      </header>

      {/* Patient Panel */}
      <PatientPanel
        patients={patients}
        selectedPatientId={selectedPatientId}
        onSelectPatient={(id) => { setSelectedPatientId(id); setResult(null); setAgenticResult(null); setError(null); }}
        aqi={envData?.aqi}
        envLoading={envLoading}
        modelType="tb"
        accentColor={ACCENT}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Chest X-Ray</h3>

          {!selectedImage ? (
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag}
              onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'rgba(220,38,38,0.05)' : 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                flex: 1, justifyContent: 'center', transition: 'all 0.3s ease'
              }}
            >
              <UploadCloud size={48} color={dragActive ? ACCENT : 'var(--text-secondary)'} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Click or drag Chest X-Ray here</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>JPEG, PNG — automatically converted to grayscale</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: '200px' }}>
              <img src={selectedImage} alt="Chest X-Ray" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', filter: 'grayscale(60%)' }} />
              <button onClick={removeImage} disabled={isAnalyzing}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                <X size={18} />
              </button>
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '4px' }}>
                Preview — converted to grayscale during analysis
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--risk-critical)', fontSize: '0.85rem' }}>
              ⚠ {error}
            </div>
          )}

          <button onClick={analyzeScan} disabled={!selectedFile || isAnalyzing || !selectedPatientId}
            style={{
              marginTop: '1.5rem', width: '100%', padding: '1rem',
              background: !selectedFile || isAnalyzing || !selectedPatientId ? 'rgba(255,255,255,0.1)' : ACCENT,
              color: !selectedFile || isAnalyzing || !selectedPatientId ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: '8px', fontWeight: '600',
              cursor: !selectedFile || isAnalyzing || !selectedPatientId ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
            {isAnalyzing ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Analyzing with CNN v2…
              </>
            ) : (
              <>
                <FileImage size={18} />
                {selectedPatientId ? 'Run TB Detection' : 'Select a Patient First'}
              </>
            )}
          </button>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            🎛 <strong>Preprocessing pipeline:</strong> Any image → Grayscale → 500×500 → /255 normalization → CNN inference
          </div>
        </div>

        {/* Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Diagnosis Results</h3>

            <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              {!result && !isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Wind size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>{selectedPatientId ? 'Upload a Chest X-Ray to classify using the custom grayscale CNN.' : 'Select a patient, then upload a Chest X-Ray.'}</p>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ textAlign: 'center', color: ACCENT }}>
                  <Wind size={48} style={{ opacity: 0.8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
                  <p>Running CNN inference + AQI correlation…</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: ACCENT, width: '65%', animation: 'slide 1.5s linear infinite' }} />
                  </div>
                </div>
              )}

              {result && sev && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  {/* Patient ID strip */}
                  {agenticResult?.patient_id && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Patient: <strong style={{ color: 'var(--text-primary)' }}>{agenticResult.patient_id}</strong></span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                  )}

                  {/* Primary badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
                    {isTB ? <AlertTriangle size={32} color={sev.text} /> : <CheckCircle size={32} color={sev.text} />}
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>CNN Classification</p>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: sev.text, margin: 0 }}>{result.prediction}</h4>
                    </div>
                    <div style={{ marginLeft: 'auto', background: sev.badge, borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', color: '#fff', fontWeight: '700' }}>
                      {result.confidence?.toFixed(1)}%
                    </div>
                  </div>

                  {/* Raw score meter */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>TB Probability Score</span>
                      <span style={{ color: isTB ? '#dc2626' : '#10b981', fontWeight: 'bold' }}>{result.raw_score?.toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${result.raw_score}%`, background: `linear-gradient(to right, #10b981, #ef4444)`, transition: 'width 1s ease', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span>Normal (0%)</span>
                      <span style={{ color: '#f59e0b' }}>Threshold (50%)</span>
                      <span>TB (100%)</span>
                    </div>
                  </div>

                  {/* History Comparison */}
                  {agenticResult?.history_comparison && (
                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <TrendingUp size={18} color={ACCENT} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>History Comparison</p>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{agenticResult.history_comparison}</p>
                      </div>
                    </div>
                  )}

                  {/* Environmental Insight (AQI — key for TB) */}
                  {agenticResult?.environmental_insight && (
                    <div style={{ padding: '1rem', borderRadius: '10px', background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`, marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <Layers size={18} color={agenticResult.hasWarning ? 'var(--risk-critical)' : '#10b981'} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>AQI · Environmental Insight</p>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{agenticResult.environmental_insight}</p>
                      </div>
                    </div>
                  )}

                  {/* Agentic Assessment */}
                  {agenticResult?.reason && (
                    <div style={{ padding: '1rem', borderRadius: '10px', border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : 'rgba(220,38,38,0.04)', marginBottom: '1rem' }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: agenticResult.hasWarning ? 'var(--risk-critical)' : ACCENT, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <ShieldAlert size={16} /> Agentic Assessment · <span style={{ fontSize: '0.8rem' }}>{agenticResult.level}</span>
                      </h4>
                      <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>{agenticResult.reason}</p>
                    </div>
                  )}

                  {/* Probability table */}
                  {result.all_probabilities && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Predictive Probabilities</p>
                      {Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, prob]) => {
                          const s = SEVERITY[label] || SEVERITY['Normal'];
                          return (
                            <div key={label} style={{ marginBottom: '0.6rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                <span style={{ color: label === result.prediction ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: label === result.prediction ? '600' : '400' }}>{label}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{prob}%</span>
                              </div>
                              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${prob}%`, background: label === result.prediction ? s.badge : 'rgba(255,255,255,0.12)' }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Clinical note */}
                  <div style={{ marginTop: '1.25rem', padding: '1rem', borderLeft: `3px solid ${sev.badge}`, background: sev.bg, borderRadius: '0 8px 8px 0' }}>
                    <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Clinical Recommendation</h5>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {CLINICAL_NOTE[result.prediction] || 'Please consult a specialist for further evaluation.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grad-CAM */}
          {result?.heatmap && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                🎯 Grad-CAM Heatmap
              </h3>
              <img src={result.heatmap} alt="Grad-CAM" style={{ width: '100%', borderRadius: '8px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Regions of the X-ray that most influenced the CNN's classification decision.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TBDashboard;
