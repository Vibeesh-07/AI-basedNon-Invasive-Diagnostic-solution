import { db } from '../firebase';
import {
  collection, doc, getDocs, setDoc, addDoc, getDoc, query, orderBy
} from 'firebase/firestore';
import { mockPatients } from '../data/mockPatients';

const PATIENTS_COLLECTION = 'patients';

// ─── Patient CRUD ─────────────────────────────────────────────────────────────

export const getAllPatients = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, PATIENTS_COLLECTION));
    if (querySnapshot.empty) return mockPatients.map(p => ({ ...p, diagnosisHistory: [] }));
    const patients = [];
    querySnapshot.forEach((d) => patients.push({ id: d.id, ...d.data(), diagnosisHistory: [] }));
    return patients;
  } catch (error) {
    console.warn('Firestore unavailable, using mock patients:', error.code);
    return mockPatients.map(p => ({ ...p, diagnosisHistory: [] }));
  }
};

/**
 * Add a new patient record to Firestore.
 * Falls back to session-only if permissions are denied.
 */
export const createPatient = async (patientData) => {
  try {
    // We use the provided ID or auto-generate one if not present
    const id = patientData.id || `PT-${Math.floor(Math.random() * 9000) + 1000}`;
    const payload = { ...patientData, id, diagnosisHistory: [], createdAt: new Date().toISOString() };
    const docRef = doc(db, PATIENTS_COLLECTION, id);
    await setDoc(docRef, payload);
    return { success: true, patient: payload };
  } catch (error) {
    console.warn('Firestore createPatient failed, session-only mode:', error.code);
    return { success: false, error: error.message };
  }
};

export const getPatient = async (patientId) => {
  try {
    const docRef = doc(db, PATIENTS_COLLECTION, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data(), diagnosisHistory: [] };
    return mockPatients.find(p => p.id === patientId) || null;
  } catch (error) {
    console.warn('Firestore getPatient failed, using mock:', error.code);
    return mockPatients.find(p => p.id === patientId) || null;
  }
};

// ─── Diagnosis Sub-Collection ─────────────────────────────────────────────────

/**
 * Save a diagnosis result to Firestore under patients/{patientId}/diagnoses
 * Falls back gracefully if permissions are denied.
 */
export const saveDiagnosis = async (patientId, diagnosisData) => {
  const payload = {
    ...diagnosisData,
    savedAt: new Date().toISOString(),
  };
  try {
    const diagRef = collection(db, PATIENTS_COLLECTION, patientId, 'diagnoses');
    const docRef = await addDoc(diagRef, payload);
    console.log('Diagnosis saved to Firestore:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.warn('Firestore saveDiagnosis failed (permissions?), stored in session only:', error.code);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch all diagnosis records for a patient.
 * Returns empty array on failure (session history still works in-memory).
 */
export const getDiagnoses = async (patientId) => {
  try {
    const diagRef = collection(db, PATIENTS_COLLECTION, patientId, 'diagnoses');
    const q = query(diagRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
    return results;
  } catch (error) {
    console.warn('Firestore getDiagnoses failed:', error.code);
    return [];
  }
};

/**
 * Seed mock patients to Firestore (call once from admin).
 */
export const seedMockPatients = async () => {
  try {
    for (const patient of mockPatients) {
      const patientRef = doc(db, PATIENTS_COLLECTION, patient.id);
      await setDoc(patientRef, patient, { merge: true });
    }
    return true;
  } catch (error) {
    console.error('Error seeding database:', error);
    return false;
  }
};
