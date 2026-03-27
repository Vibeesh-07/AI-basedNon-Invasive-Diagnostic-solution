import emailjs from '@emailjs/browser';

// ─── EMAILJS CONFIGURATION ──────────────────────────────────────────────────
// TODO: Replace these with your actual EmailJS credentials
const EMAILJS_SERVICE_ID = 'service_up2w157';
const EMAILJS_TEMPLATE_ID = 'template_jzuj37x';
const EMAILJS_PUBLIC_KEY = 'yv9FK5M7TUUwoeSBK';

/**
 * Sends an environmental risk alert to a patient.
 * 
 * @param {Object} patient - The patient object containing name and email.
 * @param {Object} riskData - Risk analysis object containing riskLevel, category, and reasoning.
 * @returns {Promise<Object>} - Success or error object.
 */
export const sendRiskAlertEmail = async (patient, riskData) => {
  if (!patient || !patient.email) {
    throw new Error('Patient does not have a registered email address.');
  }

  // Formatting the payload that matches the variables in the EmailJS Template
  const templateParams = {
    to_name: patient.name,
    to_email: patient.email,
    patient_city: patient.city,
    risk_level: riskData.level,           // AgenticEHR outputs '.level' not '.riskLevel'
    risk_category: riskData.category,
    diseases: riskData.diseases?.join(', ') || 'Unknown',
    reasoning: riskData.reasoning,        // Agentic correlation
  };

  try {
    // If placeholders are still present, simulate success to avoid breaking the UI for the user.
    if (EMAILJS_SERVICE_ID === 'service_placeholder') {
      console.warn('EmailJS placeholders detected! Simulating an email send without actually firing the API.');
      console.log('Simulated Email Payload:', templateParams);

      // Artificial delay to simulate network request
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { success: true, simulated: true };
    }

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Error Object:', error);
    // Passing the actual API error back so that the UI can catch it and display it on the banner instead of a generic message
    throw new Error(error?.text || error?.message || 'Failed to send email alert via EmailJS.');
  }
};
