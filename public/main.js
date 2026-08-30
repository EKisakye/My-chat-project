const socket = io();

const messagecontainer = document.getElementById('message-container');
const nameInput = document.getElementById('name-Input');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

function sendMessage() {
    console.log(messageInput.value);
    const data = {
        name: nameInput.value,
        message: messageInput.value,
        dateTime: new Date(),
    };
    socket.emit('message', data);
}
function addMessageToUI(isOwnMessage, data) {
    const element = `
        <li class="${isOwnMessage ? 'message-right' : 'message-left'}">
            <p class="message">
                ${data.message}
                <span>${data.name} • ${moment(data.dateTime).fromNow()}</span>
            </p>
        </li>
    `;
}