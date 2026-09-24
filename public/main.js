const socket = io({ autoConnect: false });

const $ = (id) => document.getElementById(id);

/* landing */
const landing = $('landing');
const joinForm = $('join-form');
const nameInput = $('name-input');
const joinError = $('join-error');

/* shell */
const chatScreen = $('chat');
const sidebar = $('sidebar');
const infoPanel = $('info-panel');
const paneNew = $('pane-new');
const paneProfile = $('pane-profile');

/* sidebar */
const sidebarAvatar = $('sidebar-avatar');
const meName = $('me-name');
const meAbout = $('me-about');
const peopleSearch = $('people-search');
const unreadFilter = $('unread-filter');
const directList = $('direct-list');
const groupList = $('group-list');
const groupsPane = $('groups-pane');
const tabDirect = $('tab-direct');
const tabGroups = $('tab-groups');
const countDirect = $('count-direct');
const countGroups = $('count-groups');
const contactList = $('contact-list');
const contactSearch = $('contact-search');

/* profile */
const avatarInput = $('avatar-input');
const profileAvatar = $('profile-avatar');
const profileName = $('profile-name');
const photoHint = $('photo-hint');
const removePhotoBtn = $('profile-remove-photo');
const aboutInput = $('about-input');

/* conversation */
const roomAvatar = $('room-avatar');
const chatTitle = $('chat-title');
const chatStatusText = $('chat-status-text');
const liveBadge = $('live-badge');
const liveText = $('live-text');
const messagecontainer = $('message-container');
const messageForm = $('message-form');
const messageInput = $('message-input');
const messageError = $('message-error');
const emojiPanel = $('emoji-panel');

/* message search */
const msgSearch = $('msg-search');
const msgSearchInput = $('msg-search-input');
const msgSearchCount = $('msg-search-count');

/* info */
const infoAvatar = $('info-avatar');
const infoName = $('info-name');
const infoSub = $('info-sub');
const memberList = $('member-list');
const statMessages = $('stat-messages');

const TYPING_TIMEOUT = 1500;
const AVATAR_SIZE = 128;
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const GENERAL = 'group:general';

const AVATAR_COLORS = ['#2563EB', '#1D4ED8', '#3B82F6', '#1E40AF', '#4F79E8', '#2E6BEE'];

const EMOJI = ['😀', '😂', '🙂', '😍', '🤔', '😅', '🙌', '👍', '👏', '🔥', '🚀', '✨',
    '💡', '✅', '❤️', '🎉', '😎', '🤝', '👀', '💬', '📌', '⚡', '🌟', '🙏'];

const STARTERS = [
    { icon: 'fa-magic', label: 'Share ideas', text: 'I had an idea I wanted to share: ' },
    { icon: 'fa-users', label: 'Discuss topics', text: 'What does everyone think about ' },
    { icon: 'fa-bolt', label: 'Build together', text: 'Want to build something together? ' },
];

let myName = '';
let mySlug = '';
let myAvatar = null;
let myAbout = null;

let activeConversation = GENERAL;
let activeTab = 'direct';
let directory = { groups: [], dms: [], contacts: [] };
let onlineUsers = [];
let typingByConversation = new Map();
let unread = new Map();
let provisional = new Map();
let unreadOnly = false;
let messageCount = 0;

let typingTimer = null;
let isTyping = false;
let lastMessageDate = null;
let lastSender = null;
let messageId = 0;
const pendingMessages = new Map();

/* =============== illustrations =============== */
/* Static author-written markup, never user data — safe to set as innerHTML. */

const ART_LIST = `
<svg class="empty-art" viewBox="0 0 116 88" fill="none" aria-hidden="true">
  <path d="M14 14h56a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H36l-14 11V56h-8a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8Z"
        fill="#EFF6FF" stroke="#C3DAFE" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M52 34h42a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-6v9l-11-9H52a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8Z"
        fill="#FFFFFF" stroke="#C3DAFE" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

const ART_THREAD = `
<svg class="thread-art" viewBox="0 0 260 180" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="bubbleA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
    <linearGradient id="bubbleB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#DBEAFE"/><stop offset="100%" stop-color="#BFD7FD"/>
    </linearGradient>
  </defs>
  <path d="M28 44h128a22 22 0 0 1 22 22v38a22 22 0 0 1-22 22h-58l-30 24v-24H28A22 22 0 0 1 6 104V66a22 22 0 0 1 22-22Z"
        fill="url(#bubbleA)"/>
  <circle cx="66" cy="86" r="8" fill="#fff"/><circle cx="94" cy="86" r="8" fill="#fff"/><circle cx="122" cy="86" r="8" fill="#fff"/>
  <path d="M158 96h74a20 20 0 0 1 20 20v26a20 20 0 0 1-20 20h-16l-22 18v-18h-36a20 20 0 0 1-20-20v-26a20 20 0 0 1 20-20Z"
        fill="url(#bubbleB)"/>
  <circle cx="182" cy="130" r="6" fill="#3B82F6"/><circle cx="203" cy="130" r="6" fill="#3B82F6"/><circle cx="224" cy="130" r="6" fill="#3B82F6"/>
  <path d="M196 26l4 14M222 40l11-9M180 44l-9-11" stroke="#3B82F6" stroke-width="5" stroke-linecap="round"/>
</svg>`;

/* =============== joining =============== */

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
    socket.emit('join', { name }, (res) => {
        if (!res || !res.ok) {
            joinError.textContent = 'Could not join. Try a different name.';
            myName = '';
            socket.disconnect();
            return;
        }

        myName = res.name;
        mySlug = res.slug;
        myAvatar = res.avatar || null;
        myAbout = res.about || null;

        landing.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        paintMe();
        buildEmojiPanel();

        openConversation(GENERAL, { closeSidebar: !isNarrow() });
        if (isNarrow()) sidebar.classList.add('open');
        else messageInput.focus();
    });
});

function isNarrow() {
    return window.matchMedia('(max-width: 1080px)').matches;
}

/* =============== nav rail =============== */

const RAIL = [
    ['nav-chats', () => { showPane(null); setTab('direct'); revealSidebar(); }],
    ['nav-groups', () => { showPane(null); setTab('groups'); revealSidebar(); }],
    ['nav-contacts', () => { openNewChat(); revealSidebar(); }],
    ['nav-settings', () => { openProfile(); revealSidebar(); }],
];

RAIL.forEach(([id, action]) => {
    $(id).addEventListener('click', () => {
        RAIL.forEach(([other]) => $(other).classList.toggle('active', other === id));
        action();
    });
});

function revealSidebar() {
    if (isNarrow()) sidebar.classList.add('open');
}

/* =============== panes =============== */

function showPane(pane) {
    for (const p of [paneNew, paneProfile]) p.classList.add('hidden');
    if (pane) pane.classList.remove('hidden');
}

$('fab-new-chat').addEventListener('click', openNewChat);
$('new-back').addEventListener('click', () => showPane(null));
$('profile-back').addEventListener('click', () => showPane(null));
$('my-avatar-button').addEventListener('click', openProfile);

function openNewChat() {
    contactSearch.value = '';
    renderContacts();
    showPane(paneNew);
    contactSearch.focus();
}

function openProfile() {
    paintMe();
    aboutInput.value = myAbout || '';
    showPane(paneProfile);
}

contactSearch.addEventListener('input', renderContacts);
peopleSearch.addEventListener('input', renderLists);

unreadFilter.addEventListener('click', () => {
    unreadOnly = !unreadOnly;
    unreadFilter.setAttribute('aria-pressed', String(unreadOnly));
    renderLists();
});

/* =============== profile =============== */

$('profile-photo').addEventListener('click', () => avatarInput.click());

removePhotoBtn.addEventListener('click', () => {
    socket.emit('avatar', null, (res) => {
        if (res && res.ok) { myAvatar = null; paintMe(); }
    });
});

$('about-save').addEventListener('click', saveAbout);
aboutInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveAbout(); }
});

function saveAbout() {
    socket.emit('about', aboutInput.value, (res) => {
        if (res && res.ok) { myAbout = res.about; paintMe(); }
    });
}

avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;

    photoHint.textContent = 'Uploading…';
    try {
        const dataUrl = await resizeToDataUrl(file);
        socket.emit('avatar', dataUrl, (res) => {
            if (res && res.ok) {
                myAvatar = res.avatar;
                paintMe();
                photoHint.textContent = 'Photo updated';
            } else {
                photoHint.textContent = 'That image was refused. Try another.';
            }
        });
    } catch (err) {
        photoHint.textContent = 'That image could not be read. Try another.';
    } finally {
        avatarInput.value = '';
    }
});

// Centre-crop to a square and re-encode small, so a 5MB phone photo becomes
// a ~10KB data URL that is cheap to store and broadcast.
function resizeToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);
            const side = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_SIZE;
            canvas.height = AVATAR_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side,
                0, 0, AVATAR_SIZE, AVATAR_SIZE);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
        img.src = url;
    });
}

function paintMe() {
    paintAvatar(sidebarAvatar, myName, myAvatar);
    paintAvatar(profileAvatar, myName, myAvatar);
    meName.textContent = myName;
    profileName.textContent = myName;
    meAbout.textContent = myAbout || 'Set a status';
    removePhotoBtn.classList.toggle('hidden', !myAvatar);
    photoHint.textContent = myAvatar ? 'Click the photo to change it' : 'Click the photo to upload one';
}

/* =============== conversations =============== */

function allDms() {
    const merged = new Map();
    for (const dm of directory.dms) merged.set(dm.id, dm);
    for (const [id, dm] of provisional) if (!merged.has(id)) merged.set(id, dm);
    return Array.from(merged.values());
}

function conversationMeta(id) {
    if (id.startsWith('group:')) {
        const group = directory.groups.find((g) => g.id === id);
        return { kind: 'group', name: group ? group.name : 'Group', avatar: null, slug: null };
    }
    const dm = allDms().find((d) => d.id === id) || directory.contacts.find((c) => c.id === id);
    return {
        kind: 'direct',
        name: dm ? dm.name : 'Direct message',
        avatar: dm ? dm.avatar : null,
        slug: dm ? dm.slug : null,
    };
}

function openConversation(id, { closeSidebar = true } = {}) {
    activeConversation = id;
    unread.set(id, 0);
    stopTyping();
    showPane(null);
    closeMessageSearch();

    socket.emit('open', id, (res) => {
        if (!res || !res.ok) return;

        messagecontainer.replaceChildren();
        lastMessageDate = null;
        lastSender = null;
        messageCount = 0;

        if (!res.messages.length) renderEmptyThread(id);
        else res.messages.forEach((data) => addMessageToUI(data.name === myName, data, { status: 'delivered' }));

        renderHeader();
        render();
        if (closeSidebar) {
            sidebar.classList.remove('open');
            messageInput.focus();
        }
    });
}

function renderHeader() {
    const meta = conversationMeta(activeConversation);
    chatTitle.textContent = meta.name;

    if (meta.kind === 'direct') {
        paintAvatar(roomAvatar, meta.name, meta.avatar);
    } else {
        paintGroupAvatar(roomAvatar);
    }
    renderInfoPanel();
}

function renderInfoPanel() {
    const meta = conversationMeta(activeConversation);
    infoName.textContent = meta.name;
    infoSub.textContent = meta.kind === 'group' ? 'Group conversation' : 'Direct message';

    if (meta.kind === 'direct') paintAvatar(infoAvatar, meta.name, meta.avatar);
    else paintGroupAvatar(infoAvatar);
}

function renderEmptyThread(id) {
    const meta = conversationMeta(id);
    const li = document.createElement('li');
    li.className = 'thread-empty';
    li.innerHTML = ART_THREAD;

    const title = document.createElement('strong');
    title.textContent = meta.kind === 'group' ? `${meta.name} is quiet` : `No messages with ${meta.name} yet`;
    li.appendChild(title);

    const sub = document.createElement('span');
    sub.textContent = 'Send the first message below.';
    li.appendChild(sub);

    const row = document.createElement('div');
    row.className = 'starters';
    STARTERS.forEach((starter) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'starter';

        const icon = document.createElement('i');
        icon.className = `fa ${starter.icon}`;
        button.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = starter.label;
        button.appendChild(label);

        button.addEventListener('click', () => {
            messageInput.value = starter.text;
            messageInput.focus();
        });
        row.appendChild(button);
    });
    li.appendChild(row);

    messagecontainer.appendChild(li);
}

/* =============== tabs =============== */

tabDirect.addEventListener('click', () => setTab('direct'));
tabGroups.addEventListener('click', () => setTab('groups'));

function setTab(tab) {
    activeTab = tab;
    const isDirect = tab === 'direct';
    tabDirect.classList.toggle('active', isDirect);
    tabGroups.classList.toggle('active', !isDirect);
    tabDirect.setAttribute('aria-selected', String(isDirect));
    tabGroups.setAttribute('aria-selected', String(!isDirect));
    directList.classList.toggle('hidden', !isDirect);
    groupsPane.classList.toggle('hidden', isDirect);

    $('nav-chats').classList.toggle('active', isDirect);
    $('nav-groups').classList.toggle('active', !isDirect);
}

$('new-group-row').addEventListener('click', () => {
    const name = window.prompt('Group name');
    if (!name || !name.trim()) return;
    socket.emit('create-group', name.trim(), (res) => {
        if (res && res.ok) { setTab('groups'); openConversation(res.id); }
    });
});

/* =============== sending =============== */

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
    emojiPanel.classList.add('hidden');
    const id = `m${messageId++}`;
    const sentAt = new Date().toISOString();
    const conversation = activeConversation;

    const empty = messagecontainer.querySelector('.thread-empty');
    if (empty) empty.remove();

    const element = addMessageToUI(true,
        { name: myName, message, dateTime: sentAt, avatar: myAvatar },
        { id, status: 'pending' });
    pendingMessages.set(id, element);

    messageInput.value = '';
    stopTyping();

    socket.emit('chat-message', { conversation, message }, (res) => {
        if (res && res.ok) { markDelivered(id); return; }
        markFailed(id);
        messageError.textContent = res && res.reason === 'rate-limited'
            ? 'You are sending messages too quickly. Wait a moment.'
            : 'Message could not be sent.';
    });
}

/* =============== emoji =============== */

function buildEmojiPanel() {
    if (emojiPanel.childElementCount) return;
    EMOJI.forEach((glyph) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = glyph;
        button.addEventListener('click', () => {
            messageInput.value += glyph;
            messageInput.focus();
        });
        emojiPanel.appendChild(button);
    });
}

const toggleEmoji = () => emojiPanel.classList.toggle('hidden');
$('emoji-button').addEventListener('click', toggleEmoji);
$('emoji-button-2').addEventListener('click', toggleEmoji);

/* =============== message search =============== */

$('toggle-search').addEventListener('click', () => {
    const opening = msgSearch.classList.contains('hidden');
    msgSearch.classList.toggle('hidden', !opening);
    $('toggle-search').setAttribute('aria-pressed', String(opening));
    if (opening) msgSearchInput.focus();
    else closeMessageSearch();
});

$('msg-search-close').addEventListener('click', closeMessageSearch);
msgSearchInput.addEventListener('input', runMessageSearch);

function closeMessageSearch() {
    msgSearch.classList.add('hidden');
    msgSearchInput.value = '';
    msgSearchCount.textContent = '';
    $('toggle-search').setAttribute('aria-pressed', 'false');
    messagecontainer.querySelectorAll('.msg-row').forEach((row) => {
        row.classList.remove('dimmed');
        const p = row.querySelector('.message-text');
        if (p) p.textContent = p.dataset.text || p.textContent;
    });
}

function runMessageSearch() {
    const term = msgSearchInput.value.trim().toLowerCase();
    const rows = messagecontainer.querySelectorAll('.msg-row');
    let hits = 0;

    rows.forEach((row) => {
        const p = row.querySelector('.message-text');
        if (!p) return;
        const text = p.dataset.text || '';
        const match = term && text.toLowerCase().includes(term);
        if (match) hits += 1;
        row.classList.toggle('dimmed', Boolean(term) && !match);
        paintHighlight(p, text, match ? term : '');
    });

    msgSearchCount.textContent = term ? `${hits} match${hits === 1 ? '' : 'es'}` : '';
}

// Rebuilds the paragraph from text nodes and <mark> elements, so highlighting
// never needs innerHTML on a message.
function paintHighlight(p, text, term) {
    p.replaceChildren();
    if (!term) { p.textContent = text; return; }

    const lower = text.toLowerCase();
    let from = 0;
    let at = lower.indexOf(term);

    while (at !== -1) {
        if (at > from) p.appendChild(document.createTextNode(text.slice(from, at)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(at, at + term.length);
        p.appendChild(mark);
        from = at + term.length;
        at = lower.indexOf(term, from);
    }
    if (from < text.length) p.appendChild(document.createTextNode(text.slice(from)));
}

/* =============== typing =============== */

messageInput.addEventListener('input', () => {
    if (!isTyping) { isTyping = true; socket.emit('typing', { conversation: activeConversation }); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, TYPING_TIMEOUT);
});

function stopTyping() {
    clearTimeout(typingTimer);
    if (isTyping) { isTyping = false; socket.emit('stop-typing', { conversation: activeConversation }); }
}

/* =============== chrome =============== */

$('toggle-info').addEventListener('click', () => infoPanel.classList.toggle('open'));
$('chat-identity').addEventListener('click', () => infoPanel.classList.toggle('open'));
$('info-close').addEventListener('click', () => infoPanel.classList.remove('open'));
$('back-button').addEventListener('click', () => sidebar.classList.add('open'));

$('leave-btn').addEventListener('click', () => {
    socket.disconnect();
    window.location.reload();
});

/* =============== incoming =============== */

socket.on('directory', (data) => {
    directory = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        dms: Array.isArray(data.dms) ? data.dms : [],
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
    };
    for (const dm of directory.dms) provisional.delete(dm.id);
    renderHeader();
    renderLists();
    renderContacts();
});

socket.on('chat-message', (data) => {
    if (data.conversation === activeConversation) {
        const empty = messagecontainer.querySelector('.thread-empty');
        if (empty) empty.remove();
        addMessageToUI(false, data);
    } else {
        unread.set(data.conversation, (unread.get(data.conversation) || 0) + 1);
    }
    renderLists();
});

socket.on('system-message', (data) => {
    if (data.conversation === activeConversation) addSystemMessage(data.text);
});

socket.on('online', (people) => {
    onlineUsers = Array.isArray(people) ? people : [];
    const me = onlineUsers.find((u) => u.slug === mySlug);
    if (me) { myAvatar = me.avatar; myAbout = me.about; paintMe(); }
    render();
    renderContacts();
});

socket.on('group-created', () => { /* a directory event follows */ });

socket.on('typing', ({ conversation, name }) => {
    if (!typingByConversation.has(conversation)) typingByConversation.set(conversation, new Set());
    typingByConversation.get(conversation).add(name);
    render();
});

socket.on('stop-typing', ({ conversation, name }) => {
    const set = typingByConversation.get(conversation);
    if (set) set.delete(name);
    render();
});

socket.on('connect', () => {
    if (myName) socket.emit('join', { name: myName });
    liveBadge.classList.remove('offline');
    liveText.textContent = 'Live';
});

socket.on('disconnect', () => {
    typingByConversation.clear();
    chatStatusText.textContent = 'Reconnecting…';
    liveBadge.classList.add('offline');
    liveText.textContent = 'Offline';
});

/* =============== rendering: chrome =============== */

function render() {
    renderStatus();
    renderLists();
    renderMembers();
    statMessages.textContent = String(messageCount);
}

function typersIn(conversation) {
    const set = typingByConversation.get(conversation);
    return set ? Array.from(set) : [];
}

function renderStatus() {
    const typers = typersIn(activeConversation);

    if (typers.length === 1) { chatStatusText.textContent = `${typers[0]} is typing…`; return; }
    if (typers.length > 1) { chatStatusText.textContent = `${typers.length} people are typing…`; return; }

    const meta = conversationMeta(activeConversation);
    if (meta.kind === 'direct') {
        chatStatusText.textContent = onlineUsers.some((u) => u.slug === meta.slug) ? 'Online' : 'Offline';
        return;
    }

    const others = onlineUsers.filter((u) => u.slug !== mySlug);
    chatStatusText.textContent = others.length
        ? `${others.map((u) => u.name).join(', ')} and you online`
        : 'Only you are online';
}

function renderLists() {
    const term = peopleSearch.value.trim().toLowerCase();
    const byTerm = (item) => item.name.toLowerCase().includes(term);
    const byUnread = (item) => !unreadOnly || (unread.get(item.id) || 0) > 0;

    const dms = allDms().filter((d) => byTerm(d) && byUnread(d));
    const groups = directory.groups.filter((g) => byTerm(g) && byUnread(g));

    countDirect.textContent = String(allDms().length);
    countGroups.textContent = String(directory.groups.length);

    paintList(directList, dms, 'direct', term);
    paintList(groupList, groups, 'group', term);
}

function emptyNote(title, sub) {
    const li = document.createElement('li');
    li.className = 'empty-note';
    li.innerHTML = ART_LIST;

    const strong = document.createElement('span');
    strong.className = 'empty-title';
    strong.textContent = title;
    li.appendChild(strong);

    const span = document.createElement('span');
    span.className = 'empty-sub';
    span.textContent = sub;
    li.appendChild(span);
    return li;
}

function paintList(listEl, items, kind, term) {
    listEl.replaceChildren();

    if (!items.length) {
        if (term) listEl.appendChild(emptyNote('Nothing found', 'No conversation matches that search.'));
        else if (unreadOnly) listEl.appendChild(emptyNote('All caught up', 'You have no unread messages.'));
        else if (kind === 'direct') listEl.appendChild(emptyNote('No chats yet', 'Tap the new chat button to start one'));
        else listEl.appendChild(emptyNote('No groups yet', 'Create one from the new chat screen.'));
        return;
    }

    items.forEach((item) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = item.id === activeConversation ? 'conv active' : 'conv';
        button.addEventListener('click', () => openConversation(item.id));

        if (kind === 'direct') {
            button.appendChild(makeAvatar(item.name, item.avatar, 'avatar-md',
                onlineUsers.some((u) => u.slug === item.slug)));
        } else {
            button.appendChild(makeGroupAvatar('avatar-md'));
        }

        const body = document.createElement('div');
        body.className = 'conv-body';

        const top = document.createElement('div');
        top.className = 'conv-top';

        const nameEl = document.createElement('span');
        nameEl.className = 'conv-name';
        nameEl.textContent = item.name;
        top.appendChild(nameEl);

        if (item.last) {
            const time = document.createElement('span');
            time.className = 'conv-time';
            time.textContent = formatTime(item.last.dateTime);
            top.appendChild(time);
        }
        body.appendChild(top);

        const preview = document.createElement('div');
        const typers = typersIn(item.id);

        if (typers.length) {
            preview.className = 'conv-preview typing';
            const t = document.createElement('span');
            t.textContent = `${typers[0]} is typing…`;
            preview.appendChild(t);
        } else if (item.last) {
            preview.className = 'conv-preview';
            const mine = item.last.name === myName;
            if (mine) {
                const tick = document.createElement('i');
                tick.className = 'fa fa-check';
                preview.appendChild(tick);
            }
            const t = document.createElement('span');
            t.textContent = mine ? item.last.message
                : (kind === 'group' ? `${item.last.name}: ${item.last.message}` : item.last.message);
            preview.appendChild(t);
        } else {
            preview.className = 'conv-preview';
            const t = document.createElement('span');
            t.textContent = 'No messages yet';
            preview.appendChild(t);
        }
        body.appendChild(preview);
        button.appendChild(body);

        const count = unread.get(item.id) || 0;
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread';
            badge.textContent = count > 99 ? '99+' : String(count);
            button.appendChild(badge);
        }

        li.appendChild(button);
        listEl.appendChild(li);
    });
}

function renderContacts() {
    const term = contactSearch.value.trim().toLowerCase();
    const matches = directory.contacts.filter((c) => c.name.toLowerCase().includes(term));

    contactList.replaceChildren();

    if (!matches.length) {
        contactList.appendChild(term
            ? emptyNote('No match', 'No contact matches that name.')
            : emptyNote('No contacts yet', 'Open the app in another window to try it.'));
        return;
    }

    matches.forEach((contact) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'conv';
        button.addEventListener('click', () => startChatWith(contact));

        const isOnline = onlineUsers.some((u) => u.slug === contact.slug);
        button.appendChild(makeAvatar(contact.name, contact.avatar, 'avatar-md', isOnline));

        const body = document.createElement('div');
        body.className = 'conv-body';

        const nameEl = document.createElement('span');
        nameEl.className = 'conv-name';
        nameEl.textContent = contact.name;
        body.appendChild(nameEl);

        const sub = document.createElement('div');
        sub.className = 'conv-preview';
        const t = document.createElement('span');
        t.textContent = contact.about || (isOnline ? 'Online' : 'Offline');
        sub.appendChild(t);
        body.appendChild(sub);

        button.appendChild(body);
        li.appendChild(button);
        contactList.appendChild(li);
    });
}

function startChatWith(contact) {
    provisional.set(contact.id, {
        id: contact.id, slug: contact.slug, name: contact.name,
        avatar: contact.avatar, last: null,
    });
    setTab('direct');
    openConversation(contact.id);
    renderLists();
}

function renderMembers() {
    memberList.replaceChildren();

    onlineUsers.forEach((user) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'member';
        button.appendChild(makeAvatar(user.name, user.avatar, 'avatar-sm', false));

        const body = document.createElement('div');
        body.className = 'member-body';

        const nameEl = document.createElement('span');
        nameEl.className = 'member-name';
        nameEl.textContent = user.name;
        body.appendChild(nameEl);

        if (user.about) {
            const about = document.createElement('span');
            about.className = 'member-about';
            about.textContent = user.about;
            body.appendChild(about);
        }
        button.appendChild(body);

        if (user.slug === mySlug) {
            const tag = document.createElement('span');
            tag.className = 'member-you';
            tag.textContent = 'you';
            button.appendChild(tag);
        } else {
            const contact = directory.contacts.find((c) => c.slug === user.slug);
            if (contact) {
                button.addEventListener('click', () => {
                    infoPanel.classList.remove('open');
                    startChatWith(contact);
                });
            }
        }

        li.appendChild(button);
        memberList.appendChild(li);
    });
}

/* =============== avatars =============== */

function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// The same check the server applies, so a crafted value can never reach src.
function safeAvatar(value) {
    return typeof value === 'string' && AVATAR_PATTERN.test(value) ? value : null;
}

function paintAvatar(el, name, avatar) {
    const safe = safeAvatar(avatar);
    el.replaceChildren();
    if (safe) {
        el.style.backgroundImage = `url("${safe}")`;
        el.style.backgroundColor = '';
        el.classList.add('has-image');
    } else {
        el.style.backgroundImage = '';
        el.style.backgroundColor = avatarColor(name || '?');
        el.textContent = initials(name || '?');
        el.classList.remove('has-image');
    }
}

function paintGroupAvatar(el) {
    el.replaceChildren();
    el.style.backgroundImage = '';
    el.style.backgroundColor = '';
    el.classList.remove('has-image');
    const icon = document.createElement('i');
    icon.className = 'fa fa-users';
    el.appendChild(icon);
}

function makeAvatar(name, avatar, sizeClass, withDot) {
    const el = document.createElement('span');
    el.className = `avatar ${sizeClass}${withDot ? ' online' : ''}`;
    el.title = name;
    paintAvatar(el, name, avatar);
    return el;
}

function makeGroupAvatar(sizeClass) {
    const el = document.createElement('span');
    el.className = `avatar ${sizeClass}`;
    el.style.background = 'linear-gradient(160deg, #2563EB, #1E40AF)';
    const icon = document.createElement('i');
    icon.className = 'fa fa-users';
    el.appendChild(icon);
    return el;
}

/* =============== rendering: messages =============== */

function formatTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDateSeparatorIfNeeded(value) {
    const date = new Date(value);
    const key = date.toDateString();
    if (key === lastMessageDate) return;

    lastMessageDate = key;
    lastSender = null;
    const li = document.createElement('li');
    li.className = 'date-separator';
    li.textContent = dateLabel(date);
    messagecontainer.appendChild(li);
}

function addMessageToUI(isOwnMessage, data, options = {}) {
    addDateSeparatorIfNeeded(data.dateTime);

    const grouped = lastSender === data.name;
    lastSender = data.name;
    messageCount += 1;
    statMessages.textContent = String(messageCount);

    const row = document.createElement('li');
    row.className = `msg-row ${isOwnMessage ? 'outgoing' : 'incoming'}`;

    if (!isOwnMessage) row.appendChild(makeAvatar(data.name, data.avatar, 'avatar-sm', false));

    const bubble = document.createElement('div');
    bubble.className = isOwnMessage ? 'message-right' : 'message-left';
    if (options.id) bubble.dataset.id = options.id;

    const isGroup = activeConversation.startsWith('group:');
    if (!isOwnMessage && !grouped && isGroup) {
        const sender = document.createElement('span');
        sender.className = 'sender';
        sender.textContent = data.name;
        bubble.appendChild(sender);
    }

    const text = document.createElement('p');
    text.className = 'message-text';
    // textContent, never innerHTML: a message is data, not markup.
    text.textContent = data.message;
    text.dataset.text = data.message;
    bubble.appendChild(text);

    const meta = document.createElement('span');
    meta.className = 'meta';

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(data.dateTime);
    meta.appendChild(time);

    if (isOwnMessage) {
        const tick = document.createElement('i');
        tick.className = options.status === 'delivered'
            ? 'fa fa-check status-icon delivered'
            : 'fa fa-clock-o status-icon';
        meta.appendChild(tick);
    }

    bubble.appendChild(meta);
    row.appendChild(bubble);
    messagecontainer.appendChild(row);
    scrollToBottom();
    return bubble;
}

function addSystemMessage(text) {
    lastSender = null;
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
