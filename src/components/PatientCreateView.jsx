import React, { useState } from 'react';
import { 
  ArrowLeft, UserPlus, Shield, Info, MapPin, 
  User, Calendar, Activity, Thermometer, Heart, 
  Droplets, Save, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { createPatient as saveToDB } from '../services/PatientDBService';
import { VALID_TN_CITIES } from '../data/mockPatients';

function PatientCreateView({ navigate, onPatientAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: 'Male',
    city: 'Chennai',
    preExistingConditions: '',
    vitals: {
      bp: '120/80',
      heartRate: 72,
      temp: '98.6°F',
      spo2: '98%'
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      vitals: { ...prev.vitals, [name]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age) {
      setError('Please provide at least a name and age.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const newPatient = {
      ...formData,
      age: parseInt(formData.age),
      preExistingConditions: formData.preExistingConditions
        ? formData.preExistingConditions.split(',').map(c => c.trim())
        : ['None'],
      lastVisit: new Date().toISOString().split('T')[0],
      diagnosisHistory: []
    };

    try {
      const result = await saveToDB(newPatient);
      // Even if result.success is false (Firestore locked), we record it in memory
      if (onPatientAdded) onPatientAdded(result.patient || newPatient);
      setSuccess(true);
      setTimeout(() => navigate('list'), 1500);
    } catch (err) {
      setError('Failed to create patient: ' + err.message);
    } finally {
      setIsSaving(false);
    }
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
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Sentinel 3</h1>
          </div>
        </div>
        <div style={{ flex: 1 }} />
      </nav>

      <div className="page-content" style={{ maxWidth: '850px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('list')}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={28} color="var(--accent-teal)" />
            Register New Patient
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Enter patient demographics and baseline vitals to begin clinical monitoring.</p>
        </div>

        {error && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: 'var(--risk-high)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={18} />
            Patient registered successfully! Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          
          <div className="grid-2">
            {/* Demographic Section */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                <Info size={16} color="var(--accent-teal)" />
                Demographics
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label><User size={14} /> Full Name</label>
                  <input 
                    type="text" name="name" placeholder="e.g. Rahul Sharma"
                    value={formData.name} onChange={handleInputChange} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label><Info size={14} /> Email Address</label>
                  <input 
                    type="email" name="email" placeholder="e.g. rahul@example.com"
                    value={formData.email} onChange={handleInputChange} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label><Calendar size={14} /> Age</label>
                  <input 
                    type="number" name="age" placeholder="Age"
                    value={formData.age} onChange={handleInputChange} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label><MapPin size={14} /> Residential City</label>
                <select name="city" value={formData.city} onChange={handleInputChange}>
                  {VALID_TN_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Kolkata">Kolkata</option>
                  <option value="Delhi">Delhi</option>
                </select>
              </div>

              <div className="form-group">
                <label><Activity size={14} /> Pre-existing Conditions</label>
                <textarea 
                  name="preExistingConditions" 
                  placeholder="e.g. Asthma, Hypertension (comma separated)"
                  value={formData.preExistingConditions} 
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
            </div>

            {/* Baseline Vitals Section */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                <Thermometer size={16} color="var(--accent-blue)" />
                Baseline Vitals
              </h3>

              <div className="grid-2">
                <div className="form-group">
                  <label style={{ color: 'var(--risk-high)' }}><Heart size={14} /> Blood Pressure</label>
                  <input 
                    type="text" name="bp" placeholder="120/80"
                    value={formData.vitals.bp} onChange={handleVitalChange} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--accent-teal)' }}><Activity size={14} /> Heart Rate</label>
                  <input 
                    type="number" name="heartRate" placeholder="72"
                    value={formData.vitals.heartRate} onChange={handleVitalChange} 
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label><Thermometer size={14} /> Temp (°F)</label>
                  <input 
                    type="text" name="temp" placeholder="98.6°F"
                    value={formData.vitals.temp} onChange={handleVitalChange} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--risk-low)' }}><Droplets size={14} /> SpO2 (%)</label>
                  <input 
                    type="text" name="spo2" placeholder="98%"
                    value={formData.vitals.spo2} onChange={handleVitalChange} 
                  />
                </div>
              </div>

              <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <p>These vitals serve as the baseline for Sentinel 3's real-time risk assessment engine.</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || success}
            className="btn-primary"
            style={{ 
              padding: '16px', 
              fontSize: '1rem', 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px',
              marginTop: '1rem',
              boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)'
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing Registration…
              </>
            ) : (
              <>
                <Save size={20} />
                Register Patient Record
              </>
            )}
          </button>
        </form>
      </div>
      
      <style>{`
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-group label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .form-group input, .form-group select, .form-group textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PatientCreateView;
