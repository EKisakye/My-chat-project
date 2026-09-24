const express = require('express');
const path = require('path');
const store = require('./db');

const app = express();

const PORT = process.env.PORT || 4000;
const MAX_LENGTH = 500;
const MAX_NAME_LENGTH = 30;
const MAX_GROUP_NAME = 40;
const MAX_ABOUT = 60;

// Token bucket: a socket may send BURST messages back to back, and then one
// more every REFILL_MS. Enough headroom for fast typing, not enough to flood.
const BURST = 5;
const REFILL_MS = 1000;

// Avatars travel as data URLs and are stored as text. Only real raster image
// types are allowed: SVG is excluded because it can carry script.
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_AVATAR_CHARS = 120000;

const server = app.listen(PORT, () =>
    console.log(`server on port ${PORT}`)
);
const io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

// socket.id -> { name, slug }
const users = new Map();
// socket.id -> { tokens, updatedAt }
const buckets = new Map();

io.on('connection', onConnected);

/* ---------- helpers ---------- */

function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
}

function cleanAvatar(value) {
    if (typeof value !== 'string') return null;
    if (value.length > MAX_AVATAR_CHARS) return null;
    return AVATAR_PATTERN.test(value) ? value : null;
}

function slugify(name) {
    return name.trim().toLowerCase();
}

function dmId(slugA, slugB) {
    return `dm:${[slugA, slugB].sort().join('|')}`;
}

function groupIdFrom(name) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `group:${base || 'room'}-${Date.now().toString(36)}`;
}

function onlineList() {
    const seen = new Map();
    for (const { name, slug } of users.values()) {
        if (!seen.has(slug)) {
            const stored = store.getUser(name);
            seen.set(slug, {
                name,
                slug,
                avatar: stored ? stored.avatar : null,
                about: stored ? stored.about : null,
            });
        }
    }
    return Array.from(seen.values());
}

// Stored messages keep only the sender's name, so replayed history would show
// initials where the live message showed a photo. Attach each sender's current
// avatar on the way out.
function withAvatars(messages) {
    const avatars = new Map(store.allUsers().map((u) => [u.name, u.avatar]));
    return messages.map((m) => ({ ...m, avatar: avatars.get(m.name) || null }));
}

// Which conversations this person is allowed to read and write.
function canAccess(slug, conversation) {
    if (typeof conversation !== 'string') return false;
    if (conversation.startsWith('group:')) return store.groupExists(conversation);
    if (conversation.startsWith('dm:')) {
        return conversation.slice(3).split('|').includes(slug);
    }
    return false;
}

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

// The directory the client needs to draw its conversation lists: every group,
// every person this user has a DM thread with, and a preview of each.
function buildDirectory(slug) {
    const groups = store.listGroups().map((g) => ({
        ...g,
        last: store.lastMessage(g.id),
    }));

    const known = new Map(store.allUsers().map((u) => [slugify(u.name), u]));
    const onlineSlugs = new Set(onlineList().map((p) => p.slug));

    // The chat list holds only conversations that actually have messages, the
    // way WhatsApp does. Everyone else lives in the contact picker instead.
    const dms = store.dmPartnerSlugs(slug).map((partnerSlug) => {
        const user = known.get(partnerSlug);
        return {
            id: dmId(slug, partnerSlug),
            slug: partnerSlug,
            name: user ? user.name : partnerSlug,
            avatar: user ? user.avatar : null,
            about: user ? user.about : null,
            online: onlineSlugs.has(partnerSlug),
            last: store.lastMessage(dmId(slug, partnerSlug)),
        };
    });

    const contacts = store.allUsers()
        .filter((u) => slugify(u.name) !== slug)
        .map((u) => ({
            id: dmId(slug, slugify(u.name)),
            slug: slugify(u.name),
            name: u.name,
            avatar: u.avatar,
            about: u.about,
            online: onlineSlugs.has(slugify(u.name)),
        }))
        .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

    return { groups, dms, contacts };
}

function sendDirectory(socket) {
    const user = users.get(socket.id);
    if (!user) return;
    socket.emit('directory', buildDirectory(user.slug));
}

function broadcastDirectories() {
    for (const [socketId] of users) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) sendDirectory(socket);
    }
}

/* ---------- connection ---------- */

function onConnected(socket) {
    console.log(`connected: ${socket.id}`);

    socket.on('join', (payload, ack) => {
        const raw = typeof payload === 'string' ? { name: payload } : (payload || {});
        const name = cleanText(raw.name, MAX_NAME_LENGTH);
        if (!name) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        const slug = slugify(name);
        const isNew = !users.has(socket.id);
        users.set(socket.id, { name, slug });

        const avatar = cleanAvatar(raw.avatar);
        store.upsertUser(name, avatar);

        // A personal room means a DM reaches every tab this person has open,
        // whether or not that tab is currently looking at the conversation.
        socket.join(`user:${slug}`);
        for (const group of store.listGroups()) socket.join(group.id);

        if (isNew) {
            socket.broadcast.emit('system-message', {
                conversation: store.GENERAL,
                text: `${name} joined the chat`,
                dateTime: new Date().toISOString(),
            });
        }

        io.emit('online', onlineList());
        broadcastDirectories();

        const stored = store.getUser(name);
        if (typeof ack === 'function') {
            ack({
                ok: true,
                name,
                slug,
                avatar: stored ? stored.avatar : null,
                about: stored ? stored.about : null,
            });
        }
    });

    socket.on('about', (text, ack) => {
        const user = users.get(socket.id);
        if (!user) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        const about = cleanText(text, MAX_ABOUT) || null;
        store.setAbout(user.name, about);
        io.emit('online', onlineList());
        broadcastDirectories();
        if (typeof ack === 'function') ack({ ok: true, about });
    });

    socket.on('avatar', (dataUrl, ack) => {
        const user = users.get(socket.id);
        if (!user) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        // null is the explicit "remove my photo" case; anything else must be a
        // valid raster data URL or it is refused outright.
        const clearing = dataUrl === null;
        const avatar = clearing ? null : cleanAvatar(dataUrl);

        if (!clearing && !avatar) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        store.setAvatar(user.name, avatar);
        io.emit('online', onlineList());
        broadcastDirectories();
        if (typeof ack === 'function') ack({ ok: true, avatar });
    });

    socket.on('open', (conversation, ack) => {
        const user = users.get(socket.id);
        if (!user || !canAccess(user.slug, conversation)) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }
        if (typeof ack === 'function') {
            ack({ ok: true, conversation, messages: withAvatars(store.recentMessages(conversation)) });
        }
    });

    socket.on('create-group', (rawName, ack) => {
        const user = users.get(socket.id);
        const name = cleanText(rawName, MAX_GROUP_NAME);

        if (!user || !name) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        const id = groupIdFrom(name);
        store.createGroup(id, name);

        // Everyone online joins: groups here are public rooms, not invite-only.
        for (const [socketId] of users) {
            const member = io.sockets.sockets.get(socketId);
            if (member) member.join(id);
        }

        io.emit('group-created', { id, name });
        broadcastDirectories();
        if (typeof ack === 'function') ack({ ok: true, id, name });
    });

    socket.on('chat-message', (data, ack) => {
        const user = users.get(socket.id);
        const conversation = data && data.conversation;
        const message = cleanText(data && data.message, MAX_LENGTH);

        if (!user || !message || !canAccess(user.slug, conversation)) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }

        if (!allowMessage(socket.id)) {
            if (typeof ack === 'function') ack({ ok: false, reason: 'rate-limited' });
            return;
        }

        const dateTime = new Date().toISOString();
        const stored = store.getUser(user.name);
        const payload = {
            conversation,
            name: user.name,
            slug: user.slug,
            avatar: stored ? stored.avatar : null,
            message,
            dateTime,
        };

        store.saveMessage({ conversation, name: user.name, message, dateTime });
        emitToConversation(socket, conversation, user.slug, 'chat-message', payload);
        broadcastDirectories();

        if (typeof ack === 'function') ack({ ok: true, dateTime });
    });

    socket.on('typing', (data) => relayTyping(socket, data, 'typing'));
    socket.on('stop-typing', (data) => relayTyping(socket, data, 'stop-typing'));

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        buckets.delete(socket.id);
        if (!user) return;

        users.delete(socket.id);

        // Only announce a departure once every tab for that person has gone.
        const stillHere = Array.from(users.values()).some((u) => u.slug === user.slug);
        if (!stillHere) {
            socket.broadcast.emit('stop-typing', { name: user.name, slug: user.slug });
            socket.broadcast.emit('system-message', {
                conversation: store.GENERAL,
                text: `${user.name} left the chat`,
                dateTime: new Date().toISOString(),
            });
        }

        io.emit('online', onlineList());
        broadcastDirectories();
    });
}

function emitToConversation(socket, conversation, senderSlug, event, payload) {
    if (conversation.startsWith('dm:')) {
        // Both personal rooms, minus the sending socket, which rendered it already.
        for (const member of conversation.slice(3).split('|')) {
            socket.broadcast.to(`user:${member}`).emit(event, payload);
        }
        return;
    }
    socket.broadcast.to(conversation).emit(event, payload);
}

function relayTyping(socket, data, event) {
    const user = users.get(socket.id);
    const conversation = data && data.conversation;
    if (!user || !canAccess(user.slug, conversation)) return;

    emitToConversation(socket, conversation, user.slug, event, {
        conversation,
        name: user.name,
        slug: user.slug,
    });
}
