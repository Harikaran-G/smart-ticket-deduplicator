import { GoogleGenAI } from '@google/genai';

let ai;
let isMock = false;

export function initLLM(apiKey) {
  if (apiKey === 'mock') {
    isMock = true;
  } else {
    ai = new GoogleGenAI({ apiKey });
  }
}

export async function verifyDuplicate(newTicket, candidateTicket, similarityScore) {
  if (isMock) {
    let verdict = 'NO';
    let confidence = Math.round(similarityScore * 100);
    
    // Check keyword overlap
    const t1 = (newTicket.title + ' ' + (newTicket.description || '')).toLowerCase();
    const t2 = (candidateTicket.title + ' ' + (candidateTicket.description || '')).toLowerCase();
    
    const isLogin1 = t1.includes('login') || t1.includes('sign');
    const isLogin2 = t2.includes('login') || t2.includes('sign');
    
    const isDark1 = t1.includes('dark') || t1.includes('night') || t1.includes('theme');
    const isDark2 = t2.includes('dark') || t2.includes('night') || t2.includes('theme');
    
    if ((isLogin1 && isLogin2) || (isDark1 && isDark2)) {
      verdict = similarityScore >= 0.70 ? 'YES' : 'LIKELY';
      confidence = Math.min(98, Math.max(75, Math.round(similarityScore * 100)));
    } else {
      verdict = similarityScore >= 0.85 ? 'YES' : (similarityScore >= 0.70 ? 'LIKELY' : 'NO');
    }
    
    let reasoning = 'The issues share similar keywords but address different aspects.';
    if (verdict === 'YES') {
      reasoning = `Both tickets describe the same core problem regarding ${isLogin1 ? 'login button unresponsiveness' : (isDark1 ? 'dark mode request' : 'similar system issues')}.`;
    } else if (verdict === 'LIKELY') {
      reasoning = `Both tickets relate to ${isLogin1 ? 'login/authentication' : (isDark1 ? 'theme customisation' : 'similar modules')}, likely the same root cause.`;
    }
    
    return { verdict, confidence, reasoning };
  }
  if (!ai) throw new Error('LLM not initialized. Call initLLM() first.');
  
  const prompt = `You are a support ticket triage expert. Analyze whether a NEW ticket is a duplicate of an EXISTING ticket.

NEW TICKET:
- Title: ${newTicket.title}
- Description: ${newTicket.description}
- Category: ${newTicket.category}

EXISTING TICKET:
- Title: ${candidateTicket.title}
- Description: ${candidateTicket.description}
- Category: ${candidateTicket.category}
- Status: ${candidateTicket.status}

Cosine Similarity Score: ${similarityScore}

Determine if the new ticket is truly a duplicate of the existing ticket. Consider:
1. Are they reporting the SAME underlying issue/request?
2. Even if worded differently, do they describe the same problem?
3. Could they be about similar but distinct issues?

Respond ONLY with valid JSON (no markdown fences) in this exact format:
{
  "verdict": "YES" | "LIKELY" | "NO",
  "confidence": <number 0-100>,
  "reasoning": "<brief 1-2 sentence explanation>"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const text = response.text.trim();
    // Try to parse JSON from the response, handling potential markdown fences
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const result = JSON.parse(jsonStr);
    
    // Validate and normalize
    return {
      verdict: ['YES', 'LIKELY', 'NO'].includes(result.verdict) ? result.verdict : 'NO',
      confidence: Math.min(100, Math.max(0, parseInt(result.confidence) || 50)),
      reasoning: result.reasoning || 'Unable to determine reasoning.'
    };
  } catch (error) {
    console.error('LLM verification failed:', error.message);
    return {
      verdict: 'UNKNOWN',
      confidence: 0,
      reasoning: 'LLM verification failed. Using similarity score only.'
    };
  }
}

export async function verifyAllCandidates(newTicket, candidates) {
  const results = await Promise.all(
    candidates.map(candidate =>
      verifyDuplicate(newTicket, candidate, candidate.similarity)
        .then(verdict => ({ ...candidate, verdict }))
    )
  );
  return results;
}
