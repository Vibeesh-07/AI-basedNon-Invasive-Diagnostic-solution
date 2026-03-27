import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, X, BrainCircuit } from 'lucide-react';

const API_URL = 'http://localhost:5000';

const HIGH_RISK = new Set([
  'Mild Demented', 'Moderate Demented', 'Very Mild Demented'
]);

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

  const isHighRisk = result ? HIGH_RISK.has(result.prediction) : false;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BrainCircuit color="var(--accent-purple)" size={28} />
          Alzheimer's Detection
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Upload MRI brain scans for AI-powered Alzheimer's disease classification.
          Images are auto-resized to 224x224 before inference.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '0.4rem 0.9rem', background: 'rgba(168,85,247,0.1)', borderRadius: '20px', border: '1px solid rgba(168,85,247,0.2)', fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
          Model: Osteoporosis_Model_binary.h5 &nbsp;|&nbsp; 4 classes &nbsp;|&nbsp; 224x224 input
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

        {/* Upload */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>MRI Brain Scan</h3>

          {!selectedImage ? (
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag}
              onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                flex: 1, justifyContent: 'center', transition: 'all 0.3s ease'
              }}
            >
              <UploadCloud size={48} color={dragActive ? 'var(--accent-purple)' : 'var(--text-secondary)'} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Click or drag MRI scan image here</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supported: JPEG, PNG, JPG (any resolution)</p>
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
              background: !selectedFile || isAnalyzing ? 'rgba(255,255,255,0.1)' : 'var(--accent-purple)',
              color: !selectedFile || isAnalyzing ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: '8px', fontWeight: '600',
              cursor: !selectedFile || isAnalyzing ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
            {isAnalyzing ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Analyzing MRI...
              </>
            ) : (
              <>
                <FileImage size={18} />
                Run Alzheimer's Detection
              </>
            )}
          </button>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            ⚠ Disclaimer: For research & educational purposes only. Does not substitute professional medical diagnosis.
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Diagnosis Results</h3>

            <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>

              {!result && !isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <BrainCircuit size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>Upload an MRI scan to run the classification network.</p>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--accent-purple)' }}>
                  <BrainCircuit size={48} style={{ opacity: 0.8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
                  <p>Running Alzheimer's detection model...</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-purple)', width: '60%', animation: 'slide 1.5s linear infinite' }} />
                  </div>
                </div>
              )}

              {result && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  {/* Main prediction */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: isHighRisk ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isHighRisk ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
                    {isHighRisk ? <AlertTriangle size={32} color="var(--risk-critical)" /> : <CheckCircle size={32} color="var(--risk-low)" />}
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Dementia Classification</p>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isHighRisk ? 'var(--risk-critical)' : 'var(--risk-low)', margin: 0 }}>
                        {result.prediction}
                      </h4>
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

                  {/* All 4 class probabilities */}
                  {result.all_probabilities && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>All Class Probabilities</p>
                      {Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, prob]) => (
                          <div key={label} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                              <span style={{
                                color: label === result.prediction ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: label === result.prediction ? '600' : '400'
                              }}>{label}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{prob}%</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${prob}%`, background: label === result.prediction ? (isHighRisk ? 'var(--risk-critical)' : 'var(--accent-purple)') : 'rgba(255,255,255,0.15)' }} />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Clinical Recommendation */}
                  <div style={{ marginTop: '1.25rem', padding: '1rem', borderLeft: `3px solid ${isHighRisk ? 'var(--risk-critical)' : 'var(--accent-purple)'}`, background: isHighRisk ? 'rgba(239,68,68,0.05)' : 'rgba(168,85,247,0.05)' }}>
                    <h5 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Clinical Recommendation</h5>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      {isHighRisk
                        ? `${result.prediction} detected. This suggests cognitive impairment indicative of Alzheimer's disease progression. Comprehensive neurological evaluation is recommended.`
                        : `Scan classified as Non Demented. Findings are within normal limits for age. Routine cognitive screening is advised as part of general health maintenance.`}
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
                Highlighted regions indicate where the model directed attention to classify dementia stages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlzheimerDashboard;
