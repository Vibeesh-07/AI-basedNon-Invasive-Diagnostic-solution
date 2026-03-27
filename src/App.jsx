import { useState, useEffect } from 'react';
import PatientListView from './components/PatientListView';
import PatientProfileView from './components/PatientProfileView';
import PatientCreateView from './components/PatientCreateView';
import DiagnosticPage from './components/DiagnosticPage';
import { getAllPatients } from './services/PatientDBService';

/**
 * Top-level router — 3 views:
 *   list      → PatientListView (home)
 *   profile   → PatientProfileView (patient detail)
 *   diagnostic → DiagnosticPage (scan upload + result)
 */
function App() {
  const [view, setView] = useState('list');
  const [activePatientId, setActivePatientId] = useState(null);

  // Source-of-truth patient list (with in-session diagnosisHistory)
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);

  useEffect(() => {
    getAllPatients()
      .then(data => setPatients(data))
      .finally(() => setPatientsLoading(false));
  }, []);

  // Navigation helpers
  const navigate = (nextView, patientId = null) => {
    setView(nextView);
    if (patientId) setActivePatientId(patientId);
    window.scrollTo(0, 0);
  };

  // Called by PatientCreateView after registration
  const onPatientAdded = (newPatient) => {
    setPatients(prev => [newPatient, ...prev]);
  };

  // Called by DiagnosticPage after a successful scan — updates in-session history
  const recordDiagnosis = (patientId, entry) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          diagnosisHistory: [...(p.diagnosisHistory ?? []), entry],
        };
      })
    );
  };

  const activePatient = patients.find(p => p.id === activePatientId) || null;

  if (view === 'profile' && activePatient) {
    return (
      <PatientProfileView
        patient={activePatient}
        navigate={navigate}
      />
    );
  }

  if (view === 'diagnostic' && activePatient) {
    return (
      <DiagnosticPage
        patient={activePatient}
        patients={patients}
        navigate={navigate}
        recordDiagnosis={recordDiagnosis}
      />
    );
  }

  if (view === 'create') {
    return (
      <PatientCreateView
        navigate={navigate}
        onPatientAdded={onPatientAdded}
      />
    );
  }

  // Default: list view
  return (
    <PatientListView
      patients={patients}
      loading={patientsLoading}
      navigate={navigate}
    />
  );
}

export default App;
