const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const HISTORY_LIMIT = 50;
const GENERAL = 'group:general';

const file = process.env.DB_FILE || path.join(__dirname, 'chat.db');
const db = new DatabaseSync(file);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        name   TEXT PRIMARY KEY,
        avatar TEXT,
        about  TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation TEXT NOT NULL DEFAULT '${GENERAL}',
        name         TEXT NOT NULL,
        message      TEXT NOT NULL,
        dateTime     TEXT NOT NULL
    );
`);

// An earlier version stored every message in one room, so the column may be
// missing on an existing database. Add it and file those messages under the
// General group rather than dropping them.
const columns = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
if (!columns.includes('conversation')) {
    db.exec(`ALTER TABLE messages ADD COLUMN conversation TEXT NOT NULL DEFAULT '${GENERAL}'`);
}

// The status line arrived after the users table, so add it to existing files.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('about')) {
    db.exec('ALTER TABLE users ADD COLUMN about TEXT');
}

db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation, id)');

db.prepare('INSERT OR IGNORE INTO groups (id, name, createdAt) VALUES (?, ?, ?)')
    .run(GENERAL, 'General', new Date().toISOString());

/* ---------- statements ---------- */

const insertMessage = db.prepare(
    'INSERT INTO messages (conversation, name, message, dateTime) VALUES (?, ?, ?, ?)'
);

// Newest first so LIMIT keeps the most recent, reversed below for rendering.
const selectRecent = db.prepare(
    'SELECT name, message, dateTime FROM messages WHERE conversation = ? ORDER BY id DESC LIMIT ?'
);

const selectLast = db.prepare(
    'SELECT name, message, dateTime FROM messages WHERE conversation = ? ORDER BY id DESC LIMIT 1'
);

const selectDmConversations = db.prepare(
    "SELECT DISTINCT conversation FROM messages WHERE conversation LIKE 'dm:%'"
);

const upsertUserStatement = db.prepare(`
    INSERT INTO users (name, avatar) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET avatar = COALESCE(excluded.avatar, users.avatar)
`);

// upsertUser keeps an existing photo when none is supplied; this one is the
// explicit "remove my photo" path, so it writes NULL through.
const setAvatarStatement = db.prepare('UPDATE users SET avatar = ? WHERE name = ?');

const setAboutStatement = db.prepare('UPDATE users SET about = ? WHERE name = ?');

const selectUser = db.prepare('SELECT name, avatar, about FROM users WHERE name = ?');
const selectAllUsers = db.prepare('SELECT name, avatar, about FROM users');
const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (id, name, createdAt) VALUES (?, ?, ?)');
const selectGroups = db.prepare('SELECT id, name FROM groups ORDER BY createdAt ASC');

/* ---------- messages ---------- */

function saveMessage({ conversation, name, message, dateTime }) {
    insertMessage.run(conversation, name, message, dateTime);
}

function recentMessages(conversation, limit = HISTORY_LIMIT) {
    return selectRecent
        .all(conversation, limit)
        .map(({ name, message, dateTime }) => ({ name, message, dateTime }))
        .reverse();
}

function lastMessage(conversation) {
    const row = selectLast.get(conversation);
    if (!row) return null;
    return { name: row.name, message: row.message, dateTime: row.dateTime };
}

/* ---------- users ---------- */

function upsertUser(name, avatar) {
    upsertUserStatement.run(name, avatar ?? null);
}

function setAvatar(name, avatar) {
    setAvatarStatement.run(avatar ?? null, name);
}

function setAbout(name, about) {
    setAboutStatement.run(about ?? null, name);
}

function getUser(name) {
    const row = selectUser.get(name);
    return row ? { name: row.name, avatar: row.avatar || null, about: row.about || null } : null;
}

function allUsers() {
    return selectAllUsers.all().map((r) => ({
        name: r.name,
        avatar: r.avatar || null,
        about: r.about || null,
    }));
}

/* ---------- groups and DMs ---------- */

function listGroups() {
    return selectGroups.all().map((r) => ({ id: r.id, name: r.name }));
}

function createGroup(id, name) {
    insertGroup.run(id, name, new Date().toISOString());
}

function groupExists(id) {
    return listGroups().some((g) => g.id === id);
}

// Every DM conversation this person has taken part in, as the other person's
// slug. The id encodes both members, so membership is read straight off it.
function dmPartnerSlugs(slug) {
    const partners = [];
    for (const { conversation } of selectDmConversations.all()) {
        const members = conversation.slice(3).split('|');
        if (members.includes(slug)) {
            partners.push(members.find((m) => m !== slug) || slug);
        }
    }
    return partners;
}

module.exports = {
    saveMessage,
    recentMessages,
    lastMessage,
    upsertUser,
    setAvatar,
    setAbout,
    getUser,
    allUsers,
    listGroups,
    createGroup,
    groupExists,
    dmPartnerSlugs,
    HISTORY_LIMIT,
    GENERAL,
};
