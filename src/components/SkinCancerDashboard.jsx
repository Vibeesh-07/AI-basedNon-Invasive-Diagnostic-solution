import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, X, Scan, ShieldAlert, TrendingUp } from 'lucide-react';
import PatientPanel from './PatientPanel';
import { getEnvironmentalData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzeImageDiagnosisRisk } from '../services/AgenticEHRService';

const API_URL = 'http://localhost:5000';

const HIGH_RISK = new Set([
  'Melanoma', 'Basal Cell Carcinoma', 'Actinic Keratosis', 'Squamous Cell Carcinoma'
]);

const ACCENT = 'var(--accent-blue)';
const ACCENT_HEX = '#3b82f6';

const SkinCancerDashboard = ({ patients = [], recordDiagnosis }) => {
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
      const response = await fetch(`${API_URL}/predict/skin`, { method: 'POST', body: formData });
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

      const enriched = analyzeImageDiagnosisRisk(currentPatient, agEnvData, data, 'skin');
      setAgenticResult(enriched);

      if (recordDiagnosis) {
        recordDiagnosis(selectedPatientId, 'skin', data.prediction, data.confidence, data.requires_attention);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to the diagnosis server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isHighRisk = result ? HIGH_RISK.has(result.prediction) : false;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Scan color={ACCENT} size={28} />
            Skin Cancer Diagnosis — CNN v2
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
            HAM10000 · 9 Classes
          </p>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          Patient-linked skin lesion classification with UV/environmental correlation and history tracking.
          Auto-resized to 160×160 before inference.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.4rem 0.9rem', background: 'rgba(59,130,246,0.1)', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.8rem', color: ACCENT }}>
          Model: cnn_fc_model.h5 &nbsp;|&nbsp; 9 classes &nbsp;|&nbsp; 160×160 input
        </div>
      </header>

      {/* Patient Panel */}
      <PatientPanel
        patients={patients}
        selectedPatientId={selectedPatientId}
        onSelectPatient={(id) => { setSelectedPatientId(id); setResult(null); setAgenticResult(null); setError(null); }}
        aqi={envData?.aqi}
        envLoading={envLoading}
        modelType="skin"
        accentColor={ACCENT_HEX}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

        {/* Upload */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Skin Lesion Image</h3>

          {!selectedImage ? (
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag}
              onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                flex: 1, justifyContent: 'center', transition: 'all 0.3s ease'
              }}
            >
              <UploadCloud size={48} color={dragActive ? ACCENT : 'var(--text-secondary)'} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Click or drag skin lesion image here</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Any resolution — backend auto-resizes to 160×160</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: '200px' }}>
              <img src={selectedImage} alt="Skin Lesion" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
              <button onClick={removeImage} disabled={isAnalyzing}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                <X size={18} />
              </button>
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
              background: !selectedFile || isAnalyzing || !selectedPatientId ? 'rgba(255,255,255,0.1)' : ACCENT_HEX,
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
                {selectedPatientId ? 'Run CNN v2 Analysis' : 'Select a Patient First'}
              </>
            )}
          </button>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            ⚠ Disclaimer: For research & educational purposes only. Does not substitute professional dermatological diagnosis.
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>CNN v2 Results</h3>

            <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              {!result && !isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Scan size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>{selectedPatientId ? 'Upload a skin lesion image and run analysis.' : 'Select a patient, then upload a skin lesion image.'}</p>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ textAlign: 'center', color: ACCENT }}>
                  <Scan size={48} style={{ opacity: 0.8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
                  <p>Running HAM10000 CNN classification + contextual analysis…</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: ACCENT_HEX, width: '60%', animation: 'slide 1.5s linear infinite' }} />
                  </div>
                </div>
              )}

              {result && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  {/* Patient ID strip */}
                  {agenticResult?.patient_id && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Patient: <strong style={{ color: 'var(--text-primary)' }}>{agenticResult.patient_id}</strong></span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                  )}

                  {/* Main prediction */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: isHighRisk ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isHighRisk ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
                    {isHighRisk ? <AlertTriangle size={32} color="var(--risk-critical)" /> : <CheckCircle size={32} color="var(--risk-low)" />}
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>HAM10000 Classification</p>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isHighRisk ? 'var(--risk-critical)' : 'var(--risk-low)', margin: 0 }}>{result.prediction}</h4>
                    </div>
                    <div style={{ marginLeft: 'auto', background: isHighRisk ? '#ef4444' : '#10b981', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', color: '#fff', fontWeight: '700' }}>
                      {result.confidence}%
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Model Confidence</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{result.confidence}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${result.confidence}%`, background: isHighRisk ? 'var(--risk-critical)' : 'var(--risk-low)', transition: 'width 1s ease' }} />
                    </div>
                  </div>

                  {/* History Comparison */}
                  {agenticResult?.history_comparison && (
                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <TrendingUp size={18} color={ACCENT_HEX} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>History Comparison</p>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{agenticResult.history_comparison}</p>
                      </div>
                    </div>
                  )}

                  {/* Environmental Insight */}
                  {agenticResult?.environmental_insight && (
                    <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <ShieldAlert size={18} color={agenticResult.hasWarning ? 'var(--risk-critical)' : '#10b981'} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Environmental Insight</p>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>{agenticResult.environmental_insight}</p>
                      </div>
                    </div>
                  )}

                  {/* Agentic reason */}
                  {agenticResult?.reason && (
                    <div style={{ padding: '1rem', borderRadius: '10px', border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : 'rgba(59,130,246,0.05)', marginBottom: '1rem' }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: agenticResult.hasWarning ? 'var(--risk-critical)' : ACCENT, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <ShieldAlert size={16} /> Agentic Assessment · <span style={{ fontSize: '0.8rem' }}>{agenticResult.level}</span>
                      </h4>
                      <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>{agenticResult.reason}</p>
                    </div>
                  )}

                  {/* All 9 class probabilities */}
                  {result.all_probabilities && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>All Class Probabilities</p>
                      {Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, prob]) => (
                          <div key={label} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                              <span style={{ color: label === result.prediction ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: label === result.prediction ? '600' : '400' }}>{label}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{prob}%</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${prob}%`, background: label === result.prediction ? (isHighRisk ? 'var(--risk-critical)' : ACCENT_HEX) : 'rgba(255,255,255,0.15)' }} />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Clinical Recommendation */}
                  <div style={{ marginTop: '1.25rem', padding: '1rem', borderLeft: `3px solid ${isHighRisk ? 'var(--risk-critical)' : ACCENT_HEX}`, background: isHighRisk ? 'rgba(239,68,68,0.05)' : 'rgba(59,130,246,0.05)' }}>
                    <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Clinical Recommendation</h5>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {isHighRisk
                        ? `${result.prediction} is a high-risk skin condition. Immediate referral to a dermatologist for biopsy is strongly recommended.`
                        : `${result.prediction} is typically a lower-risk finding. Routine dermatological follow-up is advised for clinical confirmation.`}
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
                🎯 Grad-CAM Heatmap (CNN v2)
              </h3>
              <img src={result.heatmap} alt="Grad-CAM" style={{ width: '100%', borderRadius: '8px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Highlighted regions show where the CNN focused attention during classification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkinCancerDashboard;
