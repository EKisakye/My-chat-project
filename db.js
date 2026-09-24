const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const HISTORY_LIMIT = 50;

const file = process.env.DB_FILE || path.join(__dirname, 'chat.db');
const db = new DatabaseSync(file);

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT NOT NULL,
        message  TEXT NOT NULL,
        dateTime TEXT NOT NULL
    );
`);

const insertStatement = db.prepare(
    'INSERT INTO messages (name, message, dateTime) VALUES (?, ?, ?)'
);

// Newest first so the LIMIT keeps the most recent messages, then reversed
// below so the caller gets them oldest first, the order they are rendered in.
const recentStatement = db.prepare(
    'SELECT name, message, dateTime FROM messages ORDER BY id DESC LIMIT ?'
);

function saveMessage({ name, message, dateTime }) {
    insertStatement.run(name, message, dateTime);
}

function recentMessages(limit = HISTORY_LIMIT) {
    return recentStatement
        .all(limit)
        .map(({ name, message, dateTime }) => ({ name, message, dateTime }))
        .reverse();
}

module.exports = { saveMessage, recentMessages, HISTORY_LIMIT };
