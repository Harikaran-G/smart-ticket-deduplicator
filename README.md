# Smart Ticket Deduplicator

An AI-powered support ticket triage and deduplication application. It scans incoming tickets, computes their vector embeddings, performs semantic similarity searches against existing tickets, and verifies candidate duplicates using Gemini LLM reasoning.

## Features

- **Semantic Similarity Matcher**: Computes 768-dimensional vector embeddings using `gemini-embedding-001` (or local mock fallback) and uses Cosine Similarity to identify candidate duplicates.
- **LLM Verification**: Filters candidate duplicates through a prompt to `gemini-2.5-flash` to get an exact binary verdict (`YES`, `LIKELY`, `NO`), confidence score, and contextual reasoning.
- **Premium Dark UI**: Built with a modern dark theme featuring glassmorphism, responsive navigation, sidebar analytics/stats, and custom animated SVG similarity rings.
- **Offline / Mock Mode**: Seamlessly falls back to mock embedding generation and mock keyword-based LLM verification if no API key is provided.

---

## Installation & Setup

### 1. Extract the Project
Extract the zip package and enter the project folder:
```bash
unzip smart-ticket-deduplicator.zip -d smart-ticket-deduplicator
cd smart-ticket-deduplicator
```

### 2. Install Dependencies
Make sure you have Node.js installed, then install the package dependencies:
```bash
npm install
```

### 3. Set Up Environmental Variables (Optional)
To run real AI queries rather than offline simulation, copy the example environment file:
```bash
cp .env.example .env
```
Open the `.env` file in your text editor and add your API key from Google AI Studio:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

---

## Running the Application

### 1. Start the Dev Server
Run the Express application locally:
```bash
npm run dev
```
If port `3000` is already in use on your system, you can specify a custom port:
```bash
PORT=3005 npm run dev
```

### 2. Access the Interface
Open your web browser and navigate to:
👉 **http://localhost:3000** (or your custom port)

### 3. Seed Demo Data
To populate the database with sample tickets (like login bugs and feature requests), click the **Seed Demo Data** button in the bottom left of the Web UI, or run:
```bash
curl -X POST http://localhost:3000/api/seed
```

---

## Directory Structure

```text
├── server.js          # Express server entrypoint
├── db.js              # SQLite database helper (better-sqlite3)
├── routes.js          # API endpoints (/api/tickets, /api/seed, etc.)
├── embeddings.js      # Vector embeddings generator & Cosine Similarity logic
├── llm-verify.js      # Gemini LLM validation handler
├── seed-data.js       # Predefined sample tickets for testing
├── public/            # Static client-side assets
│   ├── index.html     # HTML structure
│   ├── styles.css     # Glassmorphism styling and layouts
│   └── app.js         # Frontend controller and API fetch logic
└── README.md          # Project documentation
```
