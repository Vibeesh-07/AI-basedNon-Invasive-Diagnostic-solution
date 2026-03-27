import { db } from '../firebase';
import { collection, doc, getDocs, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { mockPatients } from '../data/mockPatients';

const PATIENTS_COLLECTION = 'patients';

/**
 * Fetches all patient records from Firestore.
 */
export const getAllPatients = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, PATIENTS_COLLECTION));
    const patients = [];
    querySnapshot.forEach((doc) => {
      patients.push({ id: doc.id, ...doc.data() });
    });
    return patients;
  } catch (error) {
    console.error("Error fetching patients from Firestore:", error);
    // Fallback to mock data if Firestore fails / is not configured
    return mockPatients;
  }
};

/**
 * Updates a specific patient's record with new data (e.g., tumor diagnosis).
 */
export const updatePatientRecord = async (patientId, data) => {
  try {
    const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
    await updateDoc(patientRef, data);
    return true;
  } catch (error) {
    console.error("Error updating patient record:", error);
    return false;
  }
};

/**
 * Utility function to seed the Firestore database with the initial mock patients.
 * This should ideally be called once via an admin panel.
 */
export const seedMockPatients = async () => {
  try {
    for (const patient of mockPatients) {
      const patientRef = doc(db, PATIENTS_COLLECTION, patient.id);
      await setDoc(patientRef, patient);
    }
    console.log("Database seeded successfully with mock patients.");
    return true;
  } catch (error) {
    console.error("Error seeding database:", error);
    return false;
  }
};
