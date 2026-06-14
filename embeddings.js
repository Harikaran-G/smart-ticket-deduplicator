import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let ai = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('Google Gen AI SDK initialized for Embeddings.');
  } catch (error) {
    console.error('Error initializing Google Gen AI SDK:', error);
  }
} else {
  console.log('No GEMINI_API_KEY found. Falling back to local Mulberry32 mock embedding generator.');
}

// Simple Mulberry32 generator for PRNG
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hashing function to turn strings into numeric seeds
function getWordHash(word) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) - hash + word.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Stop words and synonym maps for simulated semantic search
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
  'did', 'do', 'does', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'would', 'you', 'your', 'yours', 'yourself', 'opening', 'remains', 'completely', 'console', 'shown', 'tried',
  'entirely', 'doesnt', 'wrong', 'get', 'got', 'make', 'take', 'see', 'saw', 'look', 'find', 'found', 'isnt'
]);

const SYNONYMS = {
  // Auth & login
  'login': 'auth', 'log': 'auth', 'logging': 'auth', 'signin': 'auth', 'logout': 'auth',
  'sign': 'auth', 'signed': 'auth', 'account': 'auth', 'credential': 'auth',
  // Browser
  'chrome': 'browser', 'firefox': 'browser', 'safari': 'browser', 'edge': 'browser', 'ie': 'browser',
  // Blank/white screen
  'white': 'blank', 'empty': 'blank', 'black': 'blank', 'clear': 'blank',
  // Loading/rendering
  'load': 'load', 'loading': 'load', 'render': 'load', 'rendering': 'load', 'display': 'load',
  // General bug/problem
  'error': 'bug', 'fails': 'bug', 'failed': 'bug', 'fail': 'bug', 'issue': 'bug', 'issu': 'bug',
  'problem': 'bug', 'broken': 'bug', 'bug': 'bug', 'defect': 'bug', 'fault': 'bug',
  // Network / connectivity
  'network': 'conn', 'connect': 'conn', 'connecting': 'conn', 'connection': 'conn',
  'netwotk': 'conn', 'netwrok': 'conn', 'internet': 'conn', 'offline': 'conn', 'disconnect': 'conn',
  'unreachable': 'conn', 'timeout': 'conn', 'latency': 'conn', 'ping': 'conn',
  // UI Buttons / interaction
  'button': 'click', 'btn': 'click', 'click': 'click', 'clicking': 'click', 'clicked': 'click',
  'respond': 'click', 'responding': 'click', 'response': 'click', 'tap': 'click', 'press': 'click',
  'submit': 'click', 'submitting': 'click',
  // Error types
  'crash': 'crash', 'crashing': 'crash', 'hang': 'crash', 'hanging': 'crash', 'freeze': 'crash',
  // Theme & settings
  'contrast': 'theme', 'color': 'theme', 'theme': 'theme', 'dark': 'theme', 'light': 'theme',
  'settings': 'config', 'preferences': 'config', 'options': 'config', 'setup': 'config',
  // SSO
  'sso': 'sso', 'okta': 'sso', 'saml': 'sso', 'identity': 'sso',
  // Password reset
  'reset': 'reset', 'forgot': 'reset', 'password': 'reset'
};

function cleanWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 1 || STOP_WORDS.has(w)) return null;
  if (SYNONYMS[w]) return SYNONYMS[w];
  return w.length > 4 ? w.substring(0, 4) : w;
}

/**
 * Computes a deterministic mock embedding using Mulberry32 hash-based random projection.
 * Similar words will modify the same vector dimensions, producing high cosine similarities
 * for overlapping texts.
 */
export function generateMockEmbedding(text) {
  const cleanText = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const rawWords = cleanText.split(/\s+/);
  
  const words = rawWords
    .map(w => cleanWord(w))
    .filter(w => w !== null);

  const embedding = new Float32Array(3072);
  
  // Base noise seeded by the text to ensure uniqueness, but lower amplitude
  const textSeed = getWordHash(cleanText) || 12345;
  const rand = mulberry32(textSeed);
  for (let i = 0; i < 3072; i++) {
    embedding[i] = (rand() * 2 - 1) * 0.02; // very small unique noise
  }
  
  // Add features for each word in the text (determines overlapping words)
  for (const stem of words) {
    const wordSeed = getWordHash(stem);
    const wordRand = mulberry32(wordSeed);
    // Add weights to pseudo-random dimensions based on the stem
    for (let j = 0; j < 40; j++) {
      const index = Math.floor(wordRand() * 3072);
      const val = wordRand() * 2 - 1;
      embedding[index] += val * 3.0; // weight word features higher
    }
  }
  
  // Normalize vector to unit length
  let sumSq = 0;
  for (let i = 0; i < 768; i++) {
    sumSq += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 768; i++) {
    embedding[i] /= norm;
  }
  
  return Array.from(embedding);
}

/**
 * Generates an embedding vector for the text.
 * Uses Gemini embedding-001 (3072-dim) if API key is set, else falls back to mock (3072-dim).
 */
export async function getEmbedding(text) {
  if (ai && apiKey) {
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: [text]
      });
      
      let values = null;
      if (response.embeddings && response.embeddings[0]) {
        values = response.embeddings[0].values;
      } else if (response.embedding) {
        values = response.embedding.values;
      }
      
      if (values && values.length > 0) {
        return values;
      }
      throw new Error('Embedding response did not return a valid vector.');
    } catch (error) {
      console.error('API Embedding call failed, falling back to mock generator. Error:', error.message);
      return generateMockEmbedding(text);
    }
  } else {
    return generateMockEmbedding(text);
  }
}

/**
 * Calculates the cosine similarity of two vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
