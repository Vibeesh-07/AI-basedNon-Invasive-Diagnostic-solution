/**
 * OllamaService.js
 * Calls the local Ollama API (http://localhost:11434) using gemma3:4b.
 * Uses the non-streaming /api/generate endpoint for simplicity.
 */

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'gemma3:4b';

/**
 * Summarize medical text using the local Ollama gemma3:4b model.
 * @param {string} text  - Raw clinical text / notes / transcription to summarize
 * @param {object} patient - Optional patient context to personalise the prompt
 * @returns {Promise<{summary: string, keyPoints: string[], flags: string[]}>}
 */
export const summarizeTranscription = async (text, patient = null) => {
  const patientContext = patient
    ? `Patient: ${patient.name}, Age: ${patient.age}, Conditions: ${(patient.preExistingConditions || []).join(', ')}.`
    : '';

  const prompt = `You are a medical assistant AI helping a doctor summarize clinical notes. 
${patientContext}

Below is a clinical transcription or medical note. Please produce:
1. A concise SUMMARY (2-4 sentences) of the key clinical findings.
2. KEY POINTS as a bullet list (max 6 bullets) of the most important medical facts.
3. FLAGS — any urgent or critical findings that need immediate attention (or say "None").

Respond in this exact JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "flags": ["..."] 
}

If there are no flags, return "flags": [].
Do not add any text before or after the JSON.

TRANSCRIPTION:
${text}`;

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 512,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.response?.trim() ?? '';

  // Parse the JSON from the model response
  try {
    // Find the JSON block even if there's extra text around it
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in model response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary ?? rawText,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      rawResponse: rawText,
    };
  } catch {
    // Graceful degradation: return the raw text as summary
    return {
      summary: rawText,
      keyPoints: [],
      flags: [],
      rawResponse: rawText,
    };
  }
};

/**
 * Generate a summary of a medical scan using the local Ollama gemma3:4b model.
 * @param {object} scanData - The scan result including prediction, confidence, model type, environmental risk, etc.
 * @param {object} patient - Optional patient context
 * @returns {Promise<string>}
 */
export const generateScanSummary = async (scanData, patient = null) => {
  const patientContext = patient
    ? `Patient Name: ${patient.name}, Age: ${patient.age}, Gender: ${patient.gender}, Location: ${patient.city}, Pre-existing Conditions: ${(patient.preExistingConditions || []).join(', ')}.`
    : '';

  const scanInfo = `
Model/Type: ${scanData.modelLabel || scanData.modelType}
Prediction / Classification: ${scanData.prediction}
Confidence Score: ${scanData.confidence}%
Requires Attention: ${scanData.requiresAttention ? 'Yes (High Risk)' : 'No (Low Risk)'}
Progression / History Context: ${scanData.history_comparison || 'None'}
Agentic Assessment / AI Reasoning: ${scanData.reason || 'None'}
Environmental Insight: ${scanData.environmental_insight || 'None'}
  `.trim();

  const prompt = `You are an expert AI clinical assistant. Your task is to write a cohesive, professional 3-5 sentence clinical summary of a medical scan that was just performed.

${patientContext}

**SCAN RESULTS:**
${scanInfo}

Write a natural language paragraph summarizing these findings for the doctor. Mention what disease or condition was detected (or if it is normal), the confidence level, any relevant environmental factors, and what progression or reasoning the system provided. Do NOT output JSON, just pure text. Do not explain the task back to me. Just give the professional medical summary paragraph.`;

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2, // low temperature for clinical consistency
        num_predict: 512,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response?.trim() ?? 'No summary generated.';
};

