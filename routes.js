import express from 'express';
import { getTickets, insertTicket, clearTickets, getStats } from './database.js';
import { getEmbedding, cosineSimilarity } from './embeddings.js';
import { verifyDuplicate } from './llm-verify.js';

const router = express.Router();

// GET /api/tickets - List all tickets
router.get('/tickets', (req, res) => {
  try {
    const tickets = getTickets();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tickets: ' + error.message });
  }
});

// GET /api/stats - Basic stats breakdown by priority/category
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats: ' + error.message });
  }
});

// POST /api/tickets - Create ticket and verify duplicates
router.post('/tickets', async (req, res) => {
  try {
    const { title, description, category, priority, status, settings } = req.body;
    if (!title || !description || !category || !priority || !status) {
      return res.status(400).json({ error: 'All fields (title, description, category, priority, status) are required.' });
    }

    const limitN = (settings && typeof settings.limitN === 'number') ? settings.limitN : 50;
    const threshold = (settings && typeof settings.threshold === 'number') ? settings.threshold : 0.55;

    const newTicket = { title, description, category, priority, status };
    
    // 1. Generate embedding for new ticket
    const newEmbedding = await getEmbedding(`${title} ${description}`);

    // 2. Load existing tickets (limited to the last N)
    const existingTickets = getTickets({ limit: limitN });
    
    // 3. Find candidate duplicates (cosine similarity >= threshold)
    const candidates = [];
    for (const ticket of existingTickets) {
      if (ticket.embedding) {
        const similarity = cosineSimilarity(newEmbedding, ticket.embedding);
        if (similarity >= threshold) {
          candidates.push({ ticket, similarity });
        }
      }
    }

    // Sort candidates by similarity descending
    candidates.sort((a, b) => b.similarity - a.similarity);

    // Get ONLY the top 3 candidate duplicates
    const topCandidates = candidates.slice(0, 3);

    // 4. Verify ONLY the top 3 candidates via LLM (or mock)
    const duplicates = [];
    let hasExactDuplicate = false;

    for (const candidate of topCandidates) {
      const evaluation = await verifyDuplicate(newTicket, candidate.ticket, candidate.similarity);
      const duplicateRecord = {
        ticket: {
          id: candidate.ticket.id,
          title: candidate.ticket.title,
          description: candidate.ticket.description,
          category: candidate.ticket.category,
          priority: candidate.ticket.priority,
          status: candidate.ticket.status,
          created_at: candidate.ticket.created_at
        },
        similarity: candidate.similarity,
        verdict: evaluation.verdict,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning
      };
      
      duplicates.push(duplicateRecord);

      if (evaluation.verdict === 'YES') {
        hasExactDuplicate = true;
      }
    }

    let insertedTicket = null;
    // 5. Insert ONLY if not an exact duplicate (verdict !== YES)
    if (!hasExactDuplicate) {
      insertedTicket = insertTicket({
        title,
        description,
        category,
        priority,
        status,
        embedding: newEmbedding
      });
    }

    res.json({
      created: !hasExactDuplicate,
      ticket: insertedTicket,
      duplicates
    });
  } catch (error) {
    console.error('Error adding ticket:', error);
    res.status(500).json({ error: 'Failed to process ticket: ' + error.message });
  }
});

// GET /api/export-training - Export Gemini fine-tuning SFT JSONL dataset
router.get('/export-training', (req, res) => {
  try {
    const tickets = getTickets();
    if (tickets.length < 2) {
      return res.status(400).json({ error: 'At least 2 tickets are required in the database to generate training pairs.' });
    }

    const examples = [];
    
    // Helper to format mock reasoning
    const getReasoning = (ticketA, ticketB, verdict, sim) => {
      if (verdict === 'YES') {
        return `High semantic similarity (${Math.round(sim * 100)}%) and matching core concepts indicates duplicate reports for '${ticketA.title.substring(0, 30)}...' and '${ticketB.title.substring(0, 30)}...'.`;
      } else if (verdict === 'LIKELY') {
        return `The tickets share related concepts and terms (similarity: ${Math.round(sim * 100)}%), suggesting they might report the same underlying issue.`;
      } else {
        return `The tickets discuss different issues and do not share significant context (similarity: ${Math.round(sim * 100)}%).`;
      }
    };

    for (let i = 0; i < tickets.length; i++) {
      const ticketA = tickets[i];
      if (!ticketA.embedding) continue;

      let negativeCount = 0;
      for (let j = 0; j < tickets.length; j++) {
        if (i === j) continue;
        const ticketB = tickets[j];
        if (!ticketB.embedding) continue;

        const similarity = cosineSimilarity(ticketA.embedding, ticketB.embedding);
        
        let verdict = 'NO';
        let confidence = Math.round(similarity * 100);
        
        if (similarity >= 0.80) {
          verdict = 'YES';
          confidence = Math.min(100, Math.round(similarity * 100 + 10));
        } else if (similarity >= 0.65) {
          verdict = 'LIKELY';
          confidence = Math.round(similarity * 100);
        } else {
          // Limit negative examples to avoid quadratic dataset size
          if (negativeCount >= 2) continue;
          negativeCount++;
        }

        const reasoning = getReasoning(ticketA, ticketB, verdict, similarity);
        
        const promptText = `You are a support ticket triage expert. Analyze whether a NEW ticket is a duplicate of an EXISTING ticket.

NEW TICKET:
- Title: ${ticketA.title}
- Description: ${ticketA.description}
- Category: ${ticketA.category}

EXISTING TICKET:
- Title: ${ticketB.title}
- Description: ${ticketB.description}
- Category: ${ticketB.category}
- Status: ${ticketB.status}

Cosine Similarity Score: ${similarity.toFixed(4)}

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

        const responseText = JSON.stringify({
          verdict,
          confidence,
          reasoning
        }, null, 2);

        examples.push({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }]
            },
            {
              role: 'model',
              parts: [{ text: responseText }]
            }
          ]
        });
      }
    }

    // Convert examples to JSONL
    const jsonlContent = examples.map(ex => JSON.stringify(ex)).join('\n');

    res.setHeader('Content-Type', 'application/x-jsonlines');
    res.setHeader('Content-Disposition', 'attachment; filename=gemini_sft_training_data.jsonl');
    res.send(jsonlContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export training data: ' + error.message });
  }
});

// POST /api/clear - Clear all tickets from database
router.post('/clear', (req, res) => {
  try {
    clearTickets();
    res.json({ message: 'Database cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear database: ' + error.message });
  }
});

// POST /api/seed - Seed database with pre-configured sample clusters
router.post('/seed', async (req, res) => {
  try {
    clearTickets();
    
    const seeds = [
      // Cluster 1: Logins
      {
        title: "Login screen fails to load on Chrome",
        description: "When opening the login page on Google Chrome, the screen remains completely white. No console errors are shown.",
        category: "Bug",
        priority: "High",
        status: "Open"
      },
      {
        title: "Password reset link not received",
        description: "Users are reporting that they do not receive the password reset email, even after checking spam folders.",
        category: "Bug",
        priority: "Medium",
        status: "Open"
      },
      {
        title: "Support Single Sign-On (SSO) with Okta",
        description: "We need to integrate Okta SSO for enterprise login security and simplified user onboarding.",
        category: "Feature Request",
        priority: "Medium",
        status: "Closed"
      },
      // Cluster 2: Dark Mode
      {
        title: "Dark mode color contrast is too low in settings page",
        description: "The text on the settings page is dark gray on a black background when dark mode is enabled, making it unreadable.",
        category: "Bug",
        priority: "Medium",
        status: "In Progress"
      },
      {
        title: "Toggle for dark mode in dashboard",
        description: "Add a toggle switch in the user dashboard settings to easily switch between light and dark mode.",
        category: "Feature Request",
        priority: "Low",
        status: "Open"
      },
      {
        title: "System automatic dark mode detection",
        description: "Can we have the application automatically match the user's operating system light/dark theme preference?",
        category: "Question",
        priority: "Low",
        status: "Resolved"
      }
    ];

    const inserted = [];
    for (const seed of seeds) {
      const text = `${seed.title} ${seed.description}`;
      const embedding = await getEmbedding(text);
      const item = insertTicket({
        ...seed,
        embedding
      });
      inserted.push(item);
    }

    res.json({ message: 'Database seeded successfully', count: inserted.length });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Failed to seed database: ' + error.message });
  }
});

export default router;
