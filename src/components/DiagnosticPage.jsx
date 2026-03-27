import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Shield, ChevronRight, UploadCloud, FileImage, X,
  Activity, Scan, Zap, Wind, CheckCircle, AlertTriangle,
  ShieldAlert, TrendingUp, Save, Loader2, Plus, Sparkles
} from 'lucide-react';
import { getEnvironmentalData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzeImageDiagnosisRisk } from '../services/AgenticEHRService';
import { saveDiagnosis } from '../services/PatientDBService';
import { generateScanSummary } from '../services/OllamaService';

const API_URL = 'http://localhost:5000';

const MODELS = [
  {
    id: 'brain',
    label: 'Brain Tumor',
    sublabel: 'MRI · VGG16 · 4 classes',
    icon: Activity,
    color: '#8b5cf6',
    border: 'rgba(139,92,246,0.35)',
    bg: 'rgba(139,92,246,0.08)',
    endpoint: '/predict/brain',
    description: 'Classifies MRI scans into Glioma, Meningioma, Pituitary, or No Tumor.',
  },
  {
    id: 'skin',
    label: 'Skin Cancer',
    sublabel: 'HAM10000 · CNN · 9 classes',
    icon: Scan,
    color: '#3b82f6',
    border: 'rgba(59,130,246,0.35)',
    bg: 'rgba(59,130,246,0.08)',
    endpoint: '/predict/skin',
    description: 'Classifies skin lesions across 9 HAM10000 categories including Melanoma.',
  },
  {
    id: 'alzheimer',
    label: "Alzheimer's",
    sublabel: 'MRI · EfficientNetV2B0 · 4 stages',
    icon: Zap,
    color: '#f97316',
    border: 'rgba(249,115,22,0.35)',
    bg: 'rgba(249,115,22,0.08)',
    endpoint: '/predict/alzheimer',
    description: 'Stages MRI scans from Non-Demented to Moderate Demented with progression tracking.',
  },
  {
    id: 'tb',
    label: 'Tuberculosis',
    sublabel: 'Chest X-Ray · CNN · Binary',
    icon: Wind,
    color: '#dc2626',
    border: 'rgba(220,38,38,0.35)',
    bg: 'rgba(220,38,38,0.08)',
    endpoint: '/predict/tb',
    description: 'Binary Normal / Tuberculosis classification from grayscale chest X-rays.',
  },
];

function DiagnosticPage({ patient, patients, navigate, recordDiagnosis }) {
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [agenticResult, setAgenticResult] = useState(null);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'failed'
  
  // Ollama Summary State
  const [scanSummary, setScanSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  
  const fileInputRef = useRef(null);

  const [envData, setEnvData] = useState(null);
  const [envLoading, setEnvLoading] = useState(false);

  useEffect(() => {
    if (!patient?.city) return;
    setEnvLoading(true);
    getEnvironmentalData(patient.city)
      .then(setEnvData)
      .catch(() => setEnvData(null))
      .finally(() => setEnvLoading(false));
  }, [patient?.city]);

  const resetScan = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setResult(null);
    setAgenticResult(null);
    setError(null);
    setSaveStatus(null);
    setScanSummary(null);
    setSummaryError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    resetScan();
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    setError(null); setResult(null); setAgenticResult(null); setSaveStatus(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!selectedFile || !selectedModel) return;
    setIsAnalyzing(true); setResult(null); setAgenticResult(null); setError(null); setSaveStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const resp = await fetch(`${API_URL}${selectedModel.endpoint}`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${resp.status}`);
      }
      const data = await resp.json();
      setResult(data);

      // Agentic analysis
      const currentPatient = patients.find(p => p.id === patient.id) || patient;
      let weatherPrediction = null;
      if (envData) {
        const news = await fetchLocalNews(patient.city).catch(() => ({ articles: [] }));
        weatherPrediction = generatePrediction(envData.weather, news);
      }
      const agEnv = { aqi: envData?.aqi ?? null, weather: envData?.weather ?? null, cityPrediction: weatherPrediction };
      const enriched = analyzeImageDiagnosisRisk(currentPatient, agEnv, data, selectedModel.id);
      setAgenticResult(enriched);

      // Update in-session history
      const historyEntry = {
        modelType: selectedModel.id,
        prediction: data.prediction,
        confidence: data.confidence,
        requiresAttention: data.requires_attention,
        reason: enriched?.reason,
        history_comparison: enriched?.history_comparison,
        timestamp: new Date().toISOString(),
      };
      if (recordDiagnosis) recordDiagnosis(patient.id, historyEntry);

      // Save to Firestore
      setSaveStatus('saving');
      const saveResult = await saveDiagnosis(patient.id, {
        ...historyEntry,
        patient_id: patient.id,
        environmental_insight: enriched?.environmental_insight,
        level: enriched?.level,
        has_warning: enriched?.hasWarning,
        modelLabel: selectedModel.label,
        raw_score: data.raw_score,
      });
      setSaveStatus(saveResult.success ? 'saved' : 'failed');

    } catch (err) {
      setError(err.message || 'Failed to connect to the diagnosis server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const model = selectedModel;
  const isHighRisk = result?.requires_attention;

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Sentinel 3</h1>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span onClick={() => navigate('list')} style={{ cursor: 'pointer', color: 'var(--accent-teal)', fontWeight: 500 }}>Patients</span>
          <ChevronRight size={14} />
          <span onClick={() => navigate('profile', patient.id)} style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: 500 }}>{patient.name}</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {model ? model.label : 'Add Diagnostic'}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Save status */}
        {saveStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: saveStatus === 'saved' ? 'rgba(16,185,129,0.1)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${saveStatus === 'saved' ? 'rgba(16,185,129,0.25)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.25)'}`, fontSize: '0.75rem' }}>
            {saveStatus === 'saving' && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-blue)' }} />}
            {saveStatus === 'saved' && <CheckCircle size={13} color="var(--risk-low)" />}
            {saveStatus === 'failed' && <AlertTriangle size={13} color="var(--risk-high)" />}
            <span style={{ color: saveStatus === 'saved' ? 'var(--risk-low)' : saveStatus === 'saving' ? 'var(--accent-blue)' : 'var(--risk-high)' }}>
              {saveStatus === 'saving' ? 'Saving to Firestore…' : saveStatus === 'saved' ? 'Saved to Firestore ✓' : 'Save failed (session only)'}
            </span>
          </div>
        )}
      </nav>

      <div className="page-content">
        {/* Back button */}
        <button
          onClick={() => navigate('profile', patient.id)}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', padding: '7px 14px' }}
        >
          <ArrowLeft size={16} />
          Back to {patient.name}
        </button>

        {/* Page Header */}
        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.4s ease' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem' }}>
            Add Diagnostic
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Patient: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{patient.name}</span>
            &nbsp;·&nbsp; {patient.id} &nbsp;·&nbsp; {patient.city}
          </p>
        </div>

        {/* Step 1: Model Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Step 1 — Select Diagnostic Model
          </p>
          <div className="grid-4" style={{ animation: 'fadeIn 0.45s ease' }}>
            {MODELS.map((m) => {
              const Icon = m.icon;
              const isActive = model?.id === m.id;
              return (
                <div
                  key={m.id}
                  className="model-card"
                  onClick={() => handleModelSelect(m)}
                  style={{
                    borderColor: isActive ? m.color : 'rgba(255,255,255,0.07)',
                    background: isActive ? m.bg : 'rgba(255,255,255,0.02)',
                    boxShadow: isActive ? `0 0 24px ${m.color}22` : 'none',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '12px', background: isActive ? m.bg : 'rgba(255,255,255,0.05)', border: `1px solid ${isActive ? m.border : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={isActive ? m.color : 'var(--text-secondary)'} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: isActive ? m.color : 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {m.label}
                    </h4>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{m.sublabel}</p>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Upload + Results */}
        {model && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Step 2 — Upload Scan &amp; Run Analysis
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

              {/* Upload Panel */}
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: model.bg, border: `1px solid ${model.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.createElement(model.icon, { size: 18, color: model.color })}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{model.label}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{model.sublabel}</p>
                  </div>
                </div>

                {/* Drop Zone */}
                {!selectedImage ? (
                  <div
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragActive ? model.color : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: '14px',
                      padding: '3rem 2rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragActive ? `${model.color}08` : 'rgba(255,255,255,0.01)',
                      transition: 'all 0.25s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      flex: 1,
                    }}
                  >
                    <UploadCloud size={48} color={dragActive ? model.color : 'var(--text-secondary)'} />
                    <div>
                      <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Click or drag scan here
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        JPEG, PNG supported — auto-preprocessed for {model.label}
                      </p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
                    <img src={selectedImage} alt="Uploaded scan" style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain', opacity: 0.95 }} />
                    <button
                      onClick={resetScan}
                      disabled={isAnalyzing}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {error && (
                  <div style={{ padding: '0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: 'var(--risk-high)', fontSize: '0.85rem' }}>
                    ⚠ {error}
                  </div>
                )}

                <button
                  onClick={runAnalysis}
                  disabled={!selectedFile || isAnalyzing}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    background: !selectedFile || isAnalyzing ? 'rgba(255,255,255,0.07)' : model.color,
                    color: !selectedFile || isAnalyzing ? 'var(--text-secondary)' : '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: !selectedFile || isAnalyzing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.25s ease',
                    boxShadow: !selectedFile || isAnalyzing ? 'none' : `0 6px 20px ${model.color}44`,
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Running {model.label} Analysis…
                    </>
                  ) : (
                    <>
                      <FileImage size={18} />
                      Run {model.label} Analysis
                    </>
                  )}
                </button>

                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  ⚠ For clinical research only — not a substitute for professional medical diagnosis.
                </p>
              </div>

              {/* Results Panel */}
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Analysis Results</h3>

                {/* Empty / loading state */}
                {!result && !isAnalyzing && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gap: '1rem' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '16px', background: model.bg, border: `1px solid ${model.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {React.createElement(model.icon, { size: 26, color: model.color })}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                      Upload a scan and click Run Analysis to see contextual results.
                    </p>
                  </div>
                )}

                {isAnalyzing && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1.5rem' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${model.color}33`, borderTopColor: model.color, animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: model.color, fontWeight: 500, fontSize: '0.9rem' }}>
                      Running AI model + agentic analysis…
                    </p>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: model.color, width: '60%', animation: 'slide 1.5s linear infinite', borderRadius: '2px' }} />
                    </div>
                  </div>
                )}

                {result && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.4s ease' }}>
                    {/* Patient ID strip */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem 0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Patient: <strong style={{ color: 'var(--text-primary)' }}>{patient.id}</strong> · {model.label}</span>
                      <span>{new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>

                    {/* Primary result badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderRadius: '12px', background: isHighRisk ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${isHighRisk ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                      {isHighRisk ? <AlertTriangle size={30} color="var(--risk-high)" /> : <CheckCircle size={30} color="var(--risk-low)" />}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>AI Classification</p>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: isHighRisk ? 'var(--risk-high)' : 'var(--risk-low)' }}>{result.prediction}</h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.6rem', fontWeight: 800, color: isHighRisk ? 'var(--risk-high)' : 'var(--risk-low)', lineHeight: 1 }}>
                          {typeof result.confidence === 'number' ? `${result.confidence}%` : result.confidence}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>confidence</p>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Model Confidence</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {typeof result.confidence === 'number' ? `${result.confidence}%` : '—'}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${result.confidence ?? 0}%`, background: isHighRisk ? 'var(--risk-high)' : 'var(--risk-low)' }} />
                      </div>
                    </div>

                    {/* History Comparison */}
                    {agenticResult?.history_comparison && (
                      <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.75rem' }}>
                        <TrendingUp size={16} color={model.color} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progression</p>
                          <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{agenticResult.history_comparison}</p>
                        </div>
                      </div>
                    )}

                    {/* Environmental Insight */}
                    {agenticResult?.environmental_insight && (
                      <div style={{ padding: '1rem', borderRadius: '10px', background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', gap: '0.75rem' }}>
                        <ShieldAlert size={16} color={agenticResult.hasWarning ? 'var(--risk-high)' : 'var(--risk-low)'} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Environmental Insight</p>
                          <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{agenticResult.environmental_insight}</p>
                        </div>
                      </div>
                    )}

                    {/* Agentic Assessment */}
                    {agenticResult?.reason && (
                      <div style={{ padding: '1rem', borderRadius: '10px', background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : `${model.color}08`, border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.25)' : model.border}` }}>
                        <h5 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: agenticResult.hasWarning ? 'var(--risk-high)' : model.color, marginBottom: '0.5rem', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <ShieldAlert size={14} /> Agentic Assessment — {agenticResult.level}
                        </h5>
                        <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>{agenticResult.reason}</p>
                      </div>
                    )}

                    {/* Save status */}
                    {saveStatus && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: saveStatus === 'saved' ? 'rgba(16,185,129,0.08)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${saveStatus === 'saved' ? 'rgba(16,185,129,0.2)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {saveStatus === 'saving' && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-blue)' }} />}
                        {saveStatus === 'saved' && <Save size={15} color="var(--risk-low)" />}
                        {saveStatus === 'failed' && <AlertTriangle size={15} color="var(--risk-high)" />}
                        <span style={{ fontSize: '0.82rem', color: saveStatus === 'saved' ? 'var(--risk-low)' : saveStatus === 'saving' ? 'var(--accent-blue)' : 'var(--risk-high)' }}>
                          {saveStatus === 'saving' ? 'Saving result to Firestore database…' : saveStatus === 'saved' ? 'Result saved to Firestore successfully' : 'Database save failed — result kept in session'}
                        </span>
                      </div>
                    )}

                    {/* Heatmap */}
                    {result.heatmap && (
                      <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ padding: '0.5rem 0.875rem', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          🎯 Grad-CAM Activation Heatmap
                        </p>
                        <img src={result.heatmap} alt="Grad-CAM" style={{ width: '100%', display: 'block' }} />
                      </div>
                    )}

                    {/* AI Scan Summary Section */}
                    <div style={{ padding: '1.25rem', borderRadius: '10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: scanSummary || isGeneratingSummary || summaryError ? '0.75rem' : '0' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={15} /> Clinical Scan Summary
                        </h4>
                        
                        {!scanSummary && !isGeneratingSummary && (
                           <button
                             onClick={async () => {
                               setIsGeneratingSummary(true);
                               setSummaryError(null);
                               try {
                                 // Build the complete scan context to pass to Ollama
                                 const summaryOutput = await generateScanSummary({
                                   ...result,
                                   ...agenticResult,
                                   requiresAttention: isHighRisk,
                                   modelLabel: model.label
                                 }, patient);
                                 setScanSummary(summaryOutput);
                               } catch (err) {
                                 setSummaryError(err.message || 'Error generating summary.');
                               } finally {
                                 setIsGeneratingSummary(false);
                               }
                             }}
                             className="btn-primary"
                             style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                           >
                             <Sparkles size={14} /> Generate Summary
                           </button>
                        )}
                      </div>

                      {isGeneratingSummary && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', color: 'var(--accent-purple)' }}>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '0.85rem' }}>Ollama gemma3 is drafting a summary…</span>
                        </div>
                      )}

                      {summaryError && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--risk-high)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertTriangle size={14} /> {summaryError}
                        </div>
                      )}

                      {scanSummary && (
                        <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.3s ease' }}>
                           <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                              {scanSummary}
                           </p>
                           <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                             Generated locally by gemma3:4b
                           </p>
                        </div>
                      )}
                    </div>

                    {/* Actions after result */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
                      <button
                        onClick={resetScan}
                        className="btn-ghost"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center', padding: '10px' }}
                      >
                        <Plus size={16} /> New Scan
                      </button>
                      <button
                        onClick={() => navigate('profile', patient.id)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1.5, justifyContent: 'center', padding: '10px' }}
                      >
                        <ArrowLeft size={16} /> Back to Patient
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiagnosticPage;
