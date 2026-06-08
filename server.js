import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { initEmbeddings } from './embeddings.js';
import { initLLM } from './llm-verify.js';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Validate API key
let isMockMode = false;
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.warn('\n⚠️  GEMINI_API_KEY is not set!');
  console.warn('   Running in MOCK/OFFLINE mode. Real vector embeddings and LLM checks will be simulated.');
  console.warn('   To use real Gemini API: copy .env.example to .env and add your API key.\n');
  isMockMode = true;
}

// Initialize services
console.log('🔧 Initializing database...');
initDB();

console.log('🧠 Initializing Gemini embeddings...');
initEmbeddings(isMockMode ? 'mock' : process.env.GEMINI_API_KEY);

console.log('🤖 Initializing Gemini LLM...');
initLLM(isMockMode ? 'mock' : process.env.GEMINI_API_KEY);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', routes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎫 Smart Ticket Deduplicator running at http://localhost:${PORT}\n`);
});
