const express = require('express');
const path = require('path');
const { saveMessage, recentMessages } = require('./db');

const app = express();

const PORT = process.env.PORT || 4000;
const MAX_LENGTH = 500;
const MAX_NAME_LENGTH = 30;

// Token bucket: a socket may send BURST messages back to back, and then one
// more every REFILL_MS. Enough headroom for fast typing, not enough to flood.
const BURST = 5;
const REFILL_MS = 1000;

const server = app.listen(PORT, () =>
    console.log(`server on port ${PORT}`)
);
const io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

// socket.id -> display name
const users = new Map();
// socket.id -> { tokens, updatedAt }
const buckets = new Map();

io.on('connection', onConnected);

function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
}

function onlineNames() {
    return Array.from(users.values());
}

// Returns false when the socket has spent its allowance.
function allowMessage(socketId) {
    const now = Date.now();
    const bucket = buckets.get(socketId) || { tokens: BURST, updatedAt: now };

    const refilled = (now - bucket.updatedAt) / REFILL_MS;
    bucket.tokens = Math.min(BURST, bucket.tokens + refilled);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
        buckets.set(socketId, bucket);
        return false;
    }

    bucket.tokens -= 1;
    buckets.set(socketId, bucket);
    return true;
}

function onConnected(socket) {
    console.log(`connected: ${socket.id}`);

    socket.on('join', (rawName, ack) => {
        const name = cleanText(rawName, MAX_NAME_LENGTH);
        if (!name) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        const isNew = !users.has(socket.id);
        users.set(socket.id, name);

        if (isNew) {
            socket.broadcast.emit('system-message', {
                text: `${name} joined the chat`,
                dateTime: new Date().toISOString(),
            });
        }

        io.emit('online', onlineNames());
        socket.emit('history', recentMessages());
        if (typeof ack === 'function') ack({ ok: true, name });
    });

    socket.on('chat-message', (data, ack) => {
        const name = users.get(socket.id);
        const message = cleanText(data && data.message, MAX_LENGTH);

        if (!name || !message) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        if (!allowMessage(socket.id)) {
            if (typeof ack === 'function') {
                ack({ ok: false, reason: 'rate-limited' });
            }
            return;
        }

        const dateTime = new Date().toISOString();
        saveMessage({ name, message, dateTime });
        socket.broadcast.emit('chat-message', { name, message, dateTime });
        if (typeof ack === 'function') ack({ ok: true, dateTime });
    });

    socket.on('typing', () => {
        const name = users.get(socket.id);
        if (name) socket.broadcast.emit('typing', { name });
    });

    socket.on('stop-typing', () => {
        const name = users.get(socket.id);
        if (name) socket.broadcast.emit('stop-typing', { name });
    });

    socket.on('disconnect', () => {
        const name = users.get(socket.id);
        buckets.delete(socket.id);
        if (!name) return;

        users.delete(socket.id);
        socket.broadcast.emit('stop-typing', { name });
        socket.broadcast.emit('system-message', {
            text: `${name} left the chat`,
            dateTime: new Date().toISOString(),
        });
        io.emit('online', onlineNames());
    });
}
