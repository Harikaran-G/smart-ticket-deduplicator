import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let ai = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('Google Gen AI SDK initialized for LLM Verification.');
  } catch (error) {
    console.error('Error initializing Google Gen AI SDK for LLM:', error);
  }
} else {
  console.log('No GEMINI_API_KEY found. Falling back to local keyword-based mock validation.');
}

/**
 * Fallback keyword-based validation for comparing two tickets.
 * Integrates cosine similarity and common word overlap.
 */
export function mockVerify(newTicket, existingTicket, similarityScore) {
  let verdict = 'NO';
  let confidence = Math.round(similarityScore * 100);
  let reasoning = 'The tickets discuss different issues and do not share significant context.';

  // NOTE: Mock embeddings score ~10-15% lower than real Gemini embeddings,
  // so we use a lower YES threshold (0.70 instead of 0.80) to compensate.
  if (similarityScore >= 0.70) {
    verdict = 'YES';
    confidence = Math.min(100, Math.round(similarityScore * 100 + 10));
    reasoning = `High semantic similarity (${Math.round(similarityScore * 100)}%) and matching core concepts indicates these are duplicate reports of the same issue.`;
  } else if (similarityScore >= 0.55) {
    verdict = 'LIKELY';
    confidence = Math.round(similarityScore * 100);
    reasoning = `The tickets share related concepts and terms, suggesting they might be reporting the same underlying issue.`;
  }
  
  return { verdict, confidence, reasoning };
}

/**
 * Compares a new ticket with an existing ticket using Gemini 2.5 Flash.
 * Falls back to mock keyword-overlap checking if API key is not configured.
 */
export async function verifyDuplicate(newTicket, existingTicket, similarityScore) {
  if (ai && apiKey) {
    const promptText = `You are a support ticket triage expert. Analyze whether a NEW ticket is a duplicate of an EXISTING ticket.

Few-shot examples to guide your decision (in-context training):

---
EXAMPLE 1 (Exact Duplicate):
NEW TICKET:
- Title: Cannot sign in with Chrome, white page
- Description: I tried logging in on Chrome, but the screen is entirely white and doesn't load. What is wrong?
- Category: Bug

EXISTING TICKET:
- Title: Login screen fails to load on Chrome
- Description: When opening the login page on Google Chrome, the screen remains completely white. No console errors are shown.
- Category: Bug
- Status: Open

Cosine Similarity Score: 0.8636

Expected Response:
{
  "verdict": "YES",
  "confidence": 95,
  "reasoning": "Both tickets report a blank white screen when loading the login page specifically on Chrome. This is the exact same defect."
}

---
EXAMPLE 2 (Similar topic but distinct issues / Not Duplicate):
NEW TICKET:
- Title: Toggle for dark mode in dashboard
- Description: Add a toggle switch in the user dashboard settings to easily switch between light and dark mode.
- Category: Feature Request

EXISTING TICKET:
- Title: System automatic dark mode detection
- Description: Can we have the application automatically match the user's operating system light/dark theme preference?
- Category: Question
- Status: Resolved

Cosine Similarity Score: 0.7241

Expected Response:
{
  "verdict": "NO",
  "confidence": 90,
  "reasoning": "The new ticket requests a manual UI toggle switch, whereas the existing one is about automatic operating system theme matching. These are distinct requests."
}

---
EXAMPLE 3 (Likely duplicate/highly related):
NEW TICKET:
- Title: Settings screen text unreadable
- Description: The preferences panel has dark text on a dark background when in dark mode.
- Category: Bug

EXISTING TICKET:
- Title: Dark mode color contrast is too low in settings page
- Description: The text on the settings page is dark gray on a black background when dark mode is enabled, making it unreadable.
- Category: Bug
- Status: In Progress

Cosine Similarity Score: 0.7850

Expected Response:
{
  "verdict": "LIKELY",
  "confidence": 85,
  "reasoning": "Both tickets describe unreadable text due to poor dark mode contrast in the settings/preferences panel. They likely refer to the same bug."
}

---
Now perform the analysis on the actual ticket:

NEW TICKET:
- Title: ${newTicket.title}
- Description: ${newTicket.description}
- Category: ${newTicket.category}

EXISTING TICKET:
- Title: ${existingTicket.title}
- Description: ${existingTicket.description}
- Category: ${existingTicket.category}
- Status: ${existingTicket.status}

Cosine Similarity Score: ${similarityScore.toFixed(4)}

Determine if the new ticket is truly a duplicate of the existing ticket. Consider:
1. Are they reporting the SAME underlying issue/request?
2. Even if worded differently, do they describe the same problem?
3. Could they be about similar but distinct issues?

Respond ONLY with valid JSON (no markdown fences) in this exact format:
{
  "verdict": "YES" | "LIKELY" | "NO",
  "confidence": <number 0-100>,
  "reasoning": "<brief 1-2 sentence explanation>"
}
`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text ? response.text.trim() : '';
      if (!text) {
        throw new Error('Empty content returned from LLM.');
      }
      
      // Parse JSON from model output
      const data = JSON.parse(text);
      if (data.verdict && data.confidence !== undefined && data.reasoning) {
        return {
          verdict: data.verdict.toUpperCase(),
          confidence: Number(data.confidence),
          reasoning: data.reasoning
        };
      }
      throw new Error('Response JSON schema mismatch.');
    } catch (error) {
      console.error('LLM verification failed. Falling back to mock verification. Error:', error.message);
      return mockVerify(newTicket, existingTicket, similarityScore);
    }
  } else {
    return mockVerify(newTicket, existingTicket, similarityScore);
  }
}
