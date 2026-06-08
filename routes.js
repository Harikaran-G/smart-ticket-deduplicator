import { Router } from 'express';
import { insertTicket, getRecentTickets, getAllTickets, getTicketById, getTicketCount, clearAllTickets, getDB } from './db.js';
import { generateEmbedding, embeddingToBuffer, findSimilarTickets } from './embeddings.js';
import { verifyAllCandidates } from './llm-verify.js';
import { sampleTickets } from './seed-data.js';

const router = Router();

// GET /api/tickets — list all tickets
router.get('/tickets', (req, res) => {
  try {
    const tickets = getAllTickets();
    const count = getTicketCount();
    res.json({ tickets, count });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/:id — get single ticket
router.get('/tickets/:id', (req, res) => {
  try {
    const ticket = getTicketById(parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets — create ticket + find duplicates
router.post('/tickets', async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    const ticket = { title, description, category: category || 'Bug', priority: priority || 'Medium', status: 'Open' };
    
    // 1. Generate embedding for the new ticket
    const combinedText = `${ticket.title}. ${ticket.description}`;
    const embedding = await generateEmbedding(combinedText);
    const embeddingBuffer = embeddingToBuffer(embedding);
    
    // 2. Search for similar tickets BEFORE inserting
    const recentTickets = getRecentTickets(200);
    const candidates = findSimilarTickets(embedding, recentTickets, 3, 0.65);
    
    // 3. LLM-verify candidates
    let verifiedCandidates = [];
    if (candidates.length > 0) {
      verifiedCandidates = await verifyAllCandidates(ticket, candidates);
    }
    
    // 4. Insert the ticket
    const ticketId = insertTicket(ticket, embeddingBuffer);
    
    // 5. Determine overall recommendation
    const hasDuplicate = verifiedCandidates.some(c => c.verdict.verdict === 'YES');
    const hasLikely = verifiedCandidates.some(c => c.verdict.verdict === 'LIKELY');
    
    let recommendation = 'NEW_UNIQUE';
    if (hasDuplicate) recommendation = 'DUPLICATE_FOUND';
    else if (hasLikely) recommendation = 'POSSIBLE_DUPLICATE';
    
    res.json({
      ticketId,
      ticket: { id: ticketId, ...ticket },
      recommendation,
      duplicates: verifiedCandidates
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket: ' + error.message });
  }
});

// POST /api/tickets/check — dry-run duplicate check (don't save)
router.post('/tickets/check', async (req, res) => {
  try {
    const { title, description, category } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    const ticket = { title, description, category: category || 'Bug' };
    
    const combinedText = `${ticket.title}. ${ticket.description}`;
    const embedding = await generateEmbedding(combinedText);
    
    const recentTickets = getRecentTickets(200);
    const candidates = findSimilarTickets(embedding, recentTickets, 3, 0.65);
    
    let verifiedCandidates = [];
    if (candidates.length > 0) {
      verifiedCandidates = await verifyAllCandidates(ticket, candidates);
    }
    
    const hasDuplicate = verifiedCandidates.some(c => c.verdict.verdict === 'YES');
    const hasLikely = verifiedCandidates.some(c => c.verdict.verdict === 'LIKELY');
    
    let recommendation = 'NEW_UNIQUE';
    if (hasDuplicate) recommendation = 'DUPLICATE_FOUND';
    else if (hasLikely) recommendation = 'POSSIBLE_DUPLICATE';
    
    res.json({
      recommendation,
      duplicates: verifiedCandidates
    });
  } catch (error) {
    console.error('Error checking ticket:', error);
    res.status(500).json({ error: 'Failed to check ticket: ' + error.message });
  }
});

// POST /api/seed — seed database with sample data
router.post('/seed', async (req, res) => {
  try {
    clearAllTickets();
    
    const results = [];
    for (const ticket of sampleTickets) {
      const combinedText = `${ticket.title}. ${ticket.description}`;
      const embedding = await generateEmbedding(combinedText);
      const embeddingBuffer = embeddingToBuffer(embedding);
      const id = insertTicket({ ...ticket, status: 'Open' }, embeddingBuffer);
      results.push({ id, title: ticket.title });
    }
    
    res.json({
      message: `Seeded ${results.length} sample tickets`,
      tickets: results
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Failed to seed data: ' + error.message });
  }
});

// GET /api/stats — basic stats
router.get('/stats', (req, res) => {
  try {
    const count = getTicketCount();
    const db = getDB();
    
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count FROM tickets GROUP BY category
    `).all();
    
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority
    `).all();
    
    res.json({ total: count, byCategory, byPriority });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
