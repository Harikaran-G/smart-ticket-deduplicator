import { GoogleGenAI } from '@google/genai';

let ai;
let isMock = false;

export function initEmbeddings(apiKey) {
  if (apiKey === 'mock') {
    isMock = true;
  } else {
    ai = new GoogleGenAI({ apiKey });
  }
}

function getSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'for', 'in', 'on', 'at', 'by', 'of', 'with', 'i', 'you', 'he', 'she', 'it', 'they', 'we', 'my', 'our', 'this', 'that', 'these', 'those']);

function normalizeWord(word) {
  if (['signin', 'sign-in', 'login', 'log-in'].includes(word)) return 'login';
  if (['button', 'buttons', 'click', 'clicked', 'clicking', 'press', 'pressing'].includes(word)) return 'button';
  if (['unresponsive', 'responding', 'functional', 'broken', 'working', 'responds', 'occurs', 'response', 'fails', 'error', 'errors', 'bug'].includes(word)) return 'broken';
  if (['theme', 'ui', 'mode', 'interface', 'look', 'style', 'color'].includes(word)) return 'theme';
  if (['dark', 'night', 'black'].includes(word)) return 'dark';
  if (['export', 'csv', 'reports', 'report', 'download', 'table'].includes(word)) return 'csv';
  if (['safari', 'chrome', 'firefox', 'browser', 'ie'].includes(word)) return 'browser';
  return word;
}

function getMockEmbedding(text) {
  const embedding = new Float32Array(768);
  const rawWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 1 && !stopWords.has(w));
  const words = rawWords.map(normalizeWord);
  
  if (words.length === 0) {
    words.push('ticket');
  }

  for (const word of words) {
    const seed = getSeed(word);
    const rand = mulberry32(seed);
    for (let k = 0; k < 15; k++) {
      const idx = Math.floor(rand() * 768);
      embedding[idx] += 1;
    }
  }
  
  // Normalize the vector so cosine similarity is straightforward
  let sumSq = 0;
  for (let i = 0; i < 768; i++) {
    sumSq += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) {
      embedding[i] /= norm;
    }
  }
  return embedding;
}


export async function generateEmbedding(text) {
  if (isMock) {
    return getMockEmbedding(text);
  }
  if (!ai) throw new Error('Embeddings not initialized. Call initEmbeddings() first.');
  
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });
  
  // response.embeddings is an array, get the first one
  const values = response.embeddings[0].values;
  return new Float32Array(values);
}

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

export function embeddingToBuffer(embedding) {
  return Buffer.from(embedding.buffer);
}

export function bufferToEmbedding(buffer) {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

export function findSimilarTickets(queryEmbedding, tickets, topK = 3, threshold = 0.65) {
  const scored = tickets
    .filter(t => t.embedding != null)
    .map(ticket => {
      const ticketEmbedding = bufferToEmbedding(ticket.embedding);
      const similarity = cosineSimilarity(queryEmbedding, ticketEmbedding);
      return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        created_at: ticket.created_at,
        similarity: Math.round(similarity * 1000) / 1000  // round to 3 decimals
      };
    })
    .filter(t => t.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  
  return scored;
}
