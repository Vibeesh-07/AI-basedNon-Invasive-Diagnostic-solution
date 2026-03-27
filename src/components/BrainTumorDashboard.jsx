import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, X, Activity, Brain, User, ShieldAlert } from 'lucide-react';
import { getCoordinates, getWeatherData } from '../services/WeatherService';
import { fetchLocalNews } from '../services/NewsService';
import { generatePrediction } from '../services/PredictionEngine';
import { analyzeImageDiagnosisRisk } from '../services/AgenticEHRService';
import { getAllPatients, updatePatientRecord } from '../services/PatientDBService';

const API_URL = 'http://localhost:5000';

const BrainTumorDashboard = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [agenticResult, setAgenticResult] = useState(null);
  const [error, setError] = useState(null);

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [cityPredictions, setCityPredictions] = useState({});

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchPatients = async () => {
      const data = await getAllPatients();
      setPatients(data);
    };
    fetchPatients();
  }, []);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const fetchPredictionForCity = async (city) => {
    if (cityPredictions[city]) return cityPredictions[city];
    try {
      const coords = await getCoordinates(city);
      const [weather, news] = await Promise.all([
        getWeatherData(coords.lat, coords.lon),
        fetchLocalNews(coords.name)
      ]);
      const prediction = generatePrediction(weather, news);
      setCityPredictions(prev => ({ ...prev, [city]: prediction }));
      return prediction;
    } catch (err) {
      console.error("Error fetching environmental context", err);
      return null;
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG).');
      return;
    }
    setError(null);
    setResult(null);
    setAgenticResult(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setResult(null);
    setAgenticResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeScan = async () => {
    if (!selectedFile) return;
    if (!selectedPatientId) {
      setError("Please select a patient to contextually evaluate the diagnosis.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setAgenticResult(null);
    setError(null);

    try {
      // 1. Fetch AI model prediction
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

      // 2. Fetch Environmental Prediction and perform Agentic Analysis
      const cityPrediction = await fetchPredictionForCity(selectedPatient.city);
      const riskAnalysis = analyzeImageDiagnosisRisk(selectedPatient, cityPrediction, data);
      
      setAgenticResult(riskAnalysis);

      // 3. Save diagnosis to Firebase so it shares state with DoctorDashboard / EHR
      await updatePatientRecord(selectedPatientId, {
        latestDiagnosis: {
          prediction: data.prediction,
          confidence: data.confidence,
          requiresAttention: data.requires_attention,
          agenticRiskLevel: riskAnalysis.level,
          agenticReason: riskAnalysis.reason,
          timestamp: new Date().toISOString()
        }
      });

    } catch (err) {
      setError(err.message || 'Failed to connect to the diagnosis server. Make sure the Python backend is running on port 5000.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity color="var(--accent-purple)" size={28} />
          Contextual Image Diagnosis
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Upload MRI scans for AI-powered detection. Findings are autonomously correlated with patient health records 
          and live environmental stressors (AQI, weather) and shared directly to the unified EHR via Firebase.
        </p>
      </header>

      {/* Patient Selection */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={20} color="var(--accent-blue)" /> Patient Assignment
        </h3>
        <select 
          value={selectedPatientId} 
          onChange={(e) => {
            setSelectedPatientId(e.target.value);
            setResult(null);
            setAgenticResult(null);
            setError(null);
          }}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">-- Select a Patient Profile --</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.name} (ID: {p.id}) - {p.city}</option>
          ))}
        </select>

        {selectedPatient && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', gap: '2rem' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Demographics</p>
              <p style={{ fontWeight: '500' }}>{selectedPatient.age} yrs, {selectedPatient.gender}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pre-existing Conditions</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {selectedPatient.preExistingConditions.map((c, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{c}</span>
                ))}
              </div>
            </div>
            {selectedPatient.latestDiagnosis && (
              <div>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Most Recent Diagnosis</p>
                 <p style={{ fontWeight: '500', color: selectedPatient.latestDiagnosis.requiresAttention ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                   {selectedPatient.latestDiagnosis.prediction}
                 </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

        {/* Upload Section */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>MRI Scan Input</h3>

          {!selectedImage ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                background: dragActive ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'center'
              }}
            >
              <UploadCloud size={48} color={dragActive ? 'var(--accent-purple)' : 'var(--text-secondary)'} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Click or drag MRI scan here</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supported: JPEG, PNG, JPG</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: '200px' }}>
              <img src={selectedImage} alt="Selected MRI Scan" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
              <button 
                onClick={removeImage} 
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', color: '#fff', display: 'flex' }}
                disabled={isAnalyzing}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--risk-critical)', fontSize: '0.85rem' }}>
              ⚠ {error}
            </div>
          )}

          <button
            onClick={analyzeScan}
            disabled={!selectedFile || isAnalyzing || !selectedPatientId}
            style={{
              marginTop: '1.5rem', width: '100%', padding: '1rem',
              background: !selectedFile || isAnalyzing || !selectedPatientId ? 'rgba(255,255,255,0.1)' : 'var(--accent-purple)',
              color: !selectedFile || isAnalyzing || !selectedPatientId ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: '8px', fontWeight: '600',
              cursor: !selectedFile || isAnalyzing || !selectedPatientId ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}
          >
            {isAnalyzing ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Running Contextual Diagnosis...
              </>
            ) : (
              <>
                <FileImage size={18} />
                Run Contextual Diagnosis
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Analysis Results</h3>

            <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>

              {!result && !isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Activity size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>Assign a patient and upload an MRI scan to begin.</p>
                </div>
              )}

              {isAnalyzing && (
                <div style={{ textAlign: 'center', color: 'var(--accent-purple)' }}>
                  <Activity size={48} style={{ opacity: 0.8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
                  <p>Interfacing with Neural Network and Agentic Engine...</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-purple)', width: '60%', animation: 'slide 1.5s linear infinite' }} />
                  </div>
                </div>
              )}

              {result && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  {/* Main prediction badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: result.requires_attention ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${result.requires_attention ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
                    {result.requires_attention
                      ? <AlertTriangle size={32} color="var(--risk-critical)" />
                      : <CheckCircle size={32} color="var(--risk-low)" />
                    }
                    <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Imaging Classification</p>
                      <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: result.requires_attention ? 'var(--risk-critical)' : 'var(--risk-low)', margin: 0 }}>
                        {result.prediction}
                      </h4>
                    </div>
                  </div>

                  {/* Confidence */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Model Confidence</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{result.confidence}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${result.confidence}%`, background: result.requires_attention ? 'var(--risk-critical)' : 'var(--risk-low)', transition: 'width 1s ease' }} />
                    </div>
                  </div>

                  {/* Agentic Integration Output */}
                  {agenticResult && (
                    <div style={{ 
                      padding: '1.5rem', 
                      borderRadius: '12px', 
                      border: `1px solid ${agenticResult.hasWarning ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, 
                      background: agenticResult.hasWarning ? 'rgba(239,68,68,0.05)' : 'rgba(168,85,247,0.05)' 
                    }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: agenticResult.hasWarning ? 'var(--risk-critical)' : 'var(--accent-purple)', marginBottom: '0.75rem', fontSize: '1rem' }}>
                        <ShieldAlert size={20} />
                        Agentic Assessment Context
                      </h4>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                        {agenticResult.reason}
                      </p>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Current Level: <strong style={{ color: agenticResult.hasWarning ? 'var(--risk-critical)' : 'var(--accent-purple)' }}>{agenticResult.level}</strong>
                      </div>
                    </div>
                  )}

                  {/* All class probabilities (Toggle or list) */}
                  {result.all_probabilities && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginTop: '1.5rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>All Class Probabilities</p>
                      {Object.entries(result.all_probabilities).map(([label, prob]) => (
                        <div key={label} style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                            <span style={{ color: label === result.prediction ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: label === result.prediction ? '600' : '400' }}>{label}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{prob}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${prob}%`, background: label === result.prediction ? 'var(--accent-purple)' : 'rgba(255,255,255,0.15)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Grad-CAM Heatmap Section */}
          {result?.heatmap && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎯 AI Focus Area (Grad-CAM Heatmap)
              </h3>
              <img src={result.heatmap} alt="Grad-CAM Heatmap" style={{ width: '100%', borderRadius: '8px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Brighter areas (red/yellow) indicate regions the AI deemed most important for its prediction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrainTumorDashboard;
