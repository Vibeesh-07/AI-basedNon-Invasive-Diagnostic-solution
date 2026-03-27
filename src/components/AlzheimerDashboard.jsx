import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, X, Zap } from 'lucide-react';

const API_URL = 'http://localhost:5000';

const HIGH_RISK = new Set([
  'Mild Demented', 'Moderate Demented', 'Very Mild Demented'
]);

// Severity ordering for badge colors
const SEVERITY = {
  'Non Demented':        { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  text: 'var(--risk-low)',      badge: '#10b981' },
  'Very Mild Demented':  { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.2)',   text: '#eab308',              badge: '#eab308' },
  'Mild Demented':       { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)',  text: '#f97316',              badge: '#f97316' },
  'Moderate Demented':   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   text: 'var(--risk-critical)', badge: '#ef4444' },
};

const CLINICAL_NOTE = {
  'Non Demented':        'No significant cognitive impairment detected. Continue routine monitoring.',
  'Very Mild Demented':  'Very mild cognitive changes detected. Recommend neurological follow-up within 6 months.',
  'Mild Demented':       'Mild dementia-related patterns found. Refer for neurological evaluation and cognitive assessment.',
  'Moderate Demented':   'Moderate Alzheimer\'s disease indicators detected. Urgent specialist referral strongly advised.',
};

const AlzheimerDashboard = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
    setError(null); setResult(null); setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null); setSelectedFile(null); setResult(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeScan = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true); setResult(null); setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(`${API_URL}/predict/alzheimer`, { method: 'POST', body: formData });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      setResult(await response.json());
    } catch (err) {
      setError(err.message || 'Failed to connect to the diagnosis server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sev = result ? (SEVERITY[result.prediction] || SEVERITY['Non Demented']) : null;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Zap color="#f97316" size={28} />
            Alzheimer's Detection — v2
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
            EfficientNetV2B0 backbone
          </p>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          Higher-accuracy Alzheimer's MRI classification using an EfficientNetV2B0 backbone fine-tuned
          on the Kaggle Alzheimer MRI Dataset. Classifies into 4 dementia stages with per-class probabilities and Grad-CAM visualization.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.4rem 0.9rem', background: 'rgba(249,115,22,0.08)', borderRadius: '20px', border: '1px solid rgba(249,115,22,0.15)', fontSize: '0.8rem', color: '#f97316' }}>
          Model: alzheimers_mobilenet_v2.h5 &nbsp;|&nbsp; 4 classes &nbsp;|&nbsp; 224×224 input
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>MRI Brain Scan</h3>

          {!selectedImage ? (
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag}
              onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? '#f97316' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'rgba(249,115,22,0.05)' : 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                flex: 1, justifyContent: 'center', transition: 'all 0.3s ease'
              }}
            >
              <UploadCloud size={48} color={dragActive ? '#f97316' : 'var(--text-secondary)'} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Click or drag MRI scan here</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>JPEG, PNG — any resolution (auto-resized)</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: '200px' }}>
              <img src={selectedImage} alt="MRI Scan" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
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

          <button onClick={analyzeScan} disabled={!selectedFile || isAnalyzing}
            style={{
              marginTop: '1.5rem', width: '100%', padding: '1rem',
              background: !selectedFile || isAnalyzing ? 'rgba(255,255,255,0.1)' : '#f97316',
              color: !selectedFile || isAnalyzing ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: '8px', fontWeight: '600',
              cursor: !selectedFile || isAnalyzing ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
            {isAnalyzing ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Analyzing with EfficientNetV2...
              </>
            ) : (
              <>
                <FileImage size={18} />
                Run v2 Alzheimer's Analysis
              </>
            )}
          </button>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            ⚠ Disclaimer: For research & educational purposes only. Does not substitute professional medical diagnosis.
          </div>
        </div>

        {/* Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>v2 Diagnosis Results</h3>

            <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>

              {!result && !isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Zap size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>Upload an MRI scan to classify dementia stage using EfficientNetV2B0.</p>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ textAlign: 'center', color: '#f97316' }}>
                  <Zap size={48} style={{ opacity: 0.8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
                  <p>Running EfficientNetV2 inference...</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#f97316', width: '65%', animation: 'slide 1.5s linear infinite' }} />
                  </div>
                </div>
              )}

              {result && sev && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  {/* Primary Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
                    {HIGH_RISK.has(result.prediction) ? <AlertTriangle size={32} color={sev.text} /> : <CheckCircle size={32} color={sev.text} />}
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>EfficientNetV2 Classification</p>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: sev.text, margin: 0 }}>{result.prediction}</h4>
                    </div>
                    <div style={{ marginLeft: 'auto', background: sev.badge, borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', color: '#fff', fontWeight: '700' }}>
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
                      <div style={{ height: '100%', width: `${result.confidence}%`, background: sev.badge, transition: 'width 1s ease', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Per-class probability bars */}
                  {result.all_probabilities && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Stage Probabilities</p>
                      {Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, prob]) => {
                          const s = SEVERITY[label] || SEVERITY['Non Demented'];
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

                  {/* Clinical Note */}
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
                🎯 Grad-CAM Heatmap (EfficientNetV2)
              </h3>
              <img src={result.heatmap} alt="Grad-CAM" style={{ width: '100%', borderRadius: '8px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Regions highlighted by the model's gradient-weighted attention during classification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlzheimerDashboard;
