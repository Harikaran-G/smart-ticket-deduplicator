import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'tickets.db');

let db;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Bug',
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Open',
      embedding BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

export function insertTicket(ticket, embeddingBuffer) {
  const stmt = getDB().prepare(`
    INSERT INTO tickets (title, description, category, priority, status, embedding)
    VALUES (@title, @description, @category, @priority, @status, @embedding)
  `);
  const result = stmt.run({
    title: ticket.title,
    description: ticket.description,
    category: ticket.category || 'Bug',
    priority: ticket.priority || 'Medium',
    status: ticket.status || 'Open',
    embedding: embeddingBuffer
  });
  return result.lastInsertRowid;
}

export function getRecentTickets(n = 200) {
  return getDB().prepare(`
    SELECT id, title, description, category, priority, status, embedding, created_at
    FROM tickets
    ORDER BY id DESC
    LIMIT ?
  `).all(n);
}

export function getAllTickets() {
  return getDB().prepare(`
    SELECT id, title, description, category, priority, status, created_at
    FROM tickets
    ORDER BY id DESC
  `).all();
}

export function getTicketById(id) {
  return getDB().prepare(`
    SELECT id, title, description, category, priority, status, created_at
    FROM tickets
    WHERE id = ?
  `).get(id);
}

export function getTicketCount() {
  return getDB().prepare('SELECT COUNT(*) as count FROM tickets').get().count;
}

export function clearAllTickets() {
  getDB().exec('DELETE FROM tickets');
}
