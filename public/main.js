const socket = io({ autoConnect: false });

const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const joinError = document.getElementById('join-error');
const chatScreen = document.getElementById('chat');
const chatStatus = document.getElementById('chat-status');
const messagecontainer = document.getElementById('message-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageError = document.getElementById('message-error');

const TYPING_TIMEOUT = 1500;

let myName = '';
let onlineUsers = [];
let typingUsers = new Set();
let typingTimer = null;
let isTyping = false;
let lastMessageDate = null;
let historyLoaded = false;
let messageId = 0;
const pendingMessages = new Map();

/* ---------- joining ---------- */

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();

    if (!name) {
        joinError.textContent = 'Enter a name first';
        nameInput.focus();
        return;
    }

    joinError.textContent = '';
    myName = name;
    socket.connect();
    socket.emit('join', name, (res) => {
        if (!res || !res.ok) {
            joinError.textContent = 'Could not join. Try a different name.';
            socket.disconnect();
            return;
        }
        myName = res.name;
        joinForm.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
        renderStatus();
    });
});

/* ---------- sending ---------- */

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
        messageError.textContent = 'Enter a message first';
        return;
    }

    messageError.textContent = '';
    const id = `m${messageId++}`;
    const sentAt = new Date().toISOString();

    const element = addMessageToUI(
        true,
        { name: myName, message, dateTime: sentAt },
        { id, status: 'pending' }
    );
    pendingMessages.set(id, element);

    messageInput.value = '';
    stopTyping();

    socket.emit('chat-message', { message }, (res) => {
        if (res && res.ok) {
            markDelivered(id);
            return;
        }
        markFailed(id);
        messageError.textContent = res && res.reason === 'rate-limited'
            ? 'You are sending messages too quickly. Wait a moment.'
            : 'Message could not be sent.';
    });
}

/* ---------- typing ---------- */

messageInput.addEventListener('input', () => {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing');
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, TYPING_TIMEOUT);
});

function stopTyping() {
    clearTimeout(typingTimer);
    if (isTyping) {
        isTyping = false;
        socket.emit('stop-typing');
    }
}

/* ---------- incoming ---------- */

// The server replays history on every join, including the re-join after a
// dropped connection, so only the first batch is rendered.
socket.on('history', (messages) => {
    if (historyLoaded || !Array.isArray(messages)) return;
    historyLoaded = true;

    messages.forEach((data) => {
        addMessageToUI(data.name === myName, data, { status: 'delivered' });
    });

    if (messages.length) addSystemMessage('End of earlier messages');
});

socket.on('chat-message', (data) => {
    addMessageToUI(false, data);
});

socket.on('system-message', (data) => {
    addSystemMessage(data.text);
});

socket.on('online', (names) => {
    onlineUsers = Array.isArray(names) ? names : [];
    renderStatus();
});

socket.on('typing', ({ name }) => {
    typingUsers.add(name);
    renderStatus();
});

socket.on('stop-typing', ({ name }) => {
    typingUsers.delete(name);
    renderStatus();
});

socket.on('connect', () => {
    if (myName) socket.emit('join', myName);
});

socket.on('disconnect', () => {
    typingUsers.clear();
    chatStatus.textContent = 'Reconnecting…';
});

/* ---------- status line ---------- */

function renderStatus() {
    const others = Array.from(typingUsers);

    if (others.length === 1) {
        chatStatus.textContent = `${others[0]} is typing…`;
        return;
    }
    if (others.length > 1) {
        chatStatus.textContent = `${others.length} people are typing…`;
        return;
    }

    const rest = onlineUsers.filter((name) => name !== myName);
    chatStatus.textContent = rest.length
        ? `${rest.join(', ')} and you`
        : 'Only you are online';
}

/* ---------- rendering ---------- */

function formatTime(value) {
    return new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function dateLabel(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function addDateSeparatorIfNeeded(value) {
    const date = new Date(value);
    const key = date.toDateString();
    if (key === lastMessageDate) return;

    lastMessageDate = key;
    const li = document.createElement('li');
    li.className = 'date-separator';
    li.textContent = dateLabel(date);
    messagecontainer.appendChild(li);
}

function addMessageToUI(isOwnMessage, data, options = {}) {
    addDateSeparatorIfNeeded(data.dateTime);

    const li = document.createElement('li');
    li.className = isOwnMessage ? 'message-right' : 'message-left';
    if (options.id) li.dataset.id = options.id;

    if (!isOwnMessage) {
        const sender = document.createElement('span');
        sender.className = 'sender';
        sender.textContent = data.name;
        li.appendChild(sender);
    }

    const text = document.createElement('p');
    text.className = 'message-text';
    // textContent, never innerHTML: a message is data, not markup.
    text.textContent = data.message;
    li.appendChild(text);

    const meta = document.createElement('span');
    meta.className = 'meta';

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(data.dateTime);
    meta.appendChild(time);

    if (isOwnMessage) {
        const tick = document.createElement('i');
        // A message replayed from history is already stored, so it is delivered.
        tick.className = options.status === 'delivered'
            ? 'fa fa-check status-icon delivered'
            : 'fa fa-clock-o status-icon';
        meta.appendChild(tick);
    }

    li.appendChild(meta);
    messagecontainer.appendChild(li);
    scrollToBottom();
    return li;
}

function addSystemMessage(text) {
    const li = document.createElement('li');
    li.className = 'system-message';
    li.textContent = text;
    messagecontainer.appendChild(li);
    scrollToBottom();
}

function markDelivered(id) {
    const element = pendingMessages.get(id);
    if (!element) return;
    const icon = element.querySelector('.status-icon');
    if (icon) icon.className = 'fa fa-check status-icon delivered';
    pendingMessages.delete(id);
}

function markFailed(id) {
    const element = pendingMessages.get(id);
    if (!element) return;
    const icon = element.querySelector('.status-icon');
    if (icon) icon.className = 'fa fa-exclamation-circle status-icon failed';
    pendingMessages.delete(id);
}

function scrollToBottom() {
    messagecontainer.scrollTop = messagecontainer.scrollHeight;
}
