import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'tickets.db');

const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    embedding BLOB,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export function getTickets({ limit } = {}) {
  let query = 'SELECT id, title, description, category, priority, status, embedding, created_at FROM tickets ORDER BY created_at DESC';
  let stmt;
  let rows;
  if (typeof limit === 'number' && limit > 0) {
    query += ' LIMIT ?';
    stmt = db.prepare(query);
    rows = stmt.all(limit);
  } else {
    stmt = db.prepare(query);
    rows = stmt.all();
  }
  return rows.map(row => {
    let embedding = null;
    if (row.embedding) {
      try {
        // Safe aligned buffer slicing
        const ab = row.embedding.buffer.slice(row.embedding.byteOffset, row.embedding.byteOffset + row.embedding.byteLength);
        embedding = Array.from(new Float32Array(ab));
      } catch (e) {
        console.error('Failed to parse embedding buffer for ticket ID', row.id, e);
      }
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      embedding: embedding,
      created_at: row.created_at
    };
  });
}

export function insertTicket({ title, description, category, priority, status, embedding }) {
  let embeddingBuffer = null;
  if (embedding) {
    embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
  }
  const stmt = db.prepare(`
    INSERT INTO tickets (title, description, category, priority, status, embedding)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(title, description, category, priority, status, embeddingBuffer);
  return {
    id: result.lastInsertRowid,
    title,
    description,
    category,
    priority,
    status,
    embedding,
    created_at: new Date().toISOString()
  };
}

export function clearTickets() {
  db.prepare('DELETE FROM tickets').run();
  try {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = "tickets"').run();
  } catch (e) {
    // Ignore if sqlite_sequence does not contain tickets table yet
  }
}

export function getStats() {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM tickets');
  const total = totalStmt.get().count;

  const categoryStmt = db.prepare('SELECT category, COUNT(*) as count FROM tickets GROUP BY category');
  const categories = categoryStmt.all().reduce((acc, row) => {
    acc[row.category] = row.count;
    return acc;
  }, {});

  const priorityStmt = db.prepare('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority');
  const priorities = priorityStmt.all().reduce((acc, row) => {
    acc[row.priority] = row.count;
    return acc;
  }, {});

  const statusStmt = db.prepare('SELECT status, COUNT(*) as count FROM tickets GROUP BY status');
  const statuses = statusStmt.all().reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  return {
    total,
    categoryBreakdown: {
      Bug: categories['Bug'] || 0,
      'Feature Request': categories['Feature Request'] || 0,
      Question: categories['Question'] || 0
    },
    priorityBreakdown: {
      Low: priorities['Low'] || 0,
      Medium: priorities['Medium'] || 0,
      High: priorities['High'] || 0,
      Urgent: priorities['Urgent'] || 0
    },
    statusBreakdown: {
      Open: statuses['Open'] || 0,
      'In Progress': statuses['In Progress'] || 0,
      Resolved: statuses['Resolved'] || 0,
      Closed: statuses['Closed'] || 0
    }
  };
}

export default db;
