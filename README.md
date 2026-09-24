# Team chat

A small real-time chat application built with Express and Socket.IO.

## Running it

```bash
npm install
npm start      # or: npm run dev  (nodemon)
```

Then open <http://localhost:4000>. Set `PORT` to use a different port, and
`DB_FILE` to store the message database somewhere other than `chat.db` in the
project root.

Requires Node 22.5 or newer, because storage uses the built-in `node:sqlite`
module rather than a third-party driver — so there is no native module to
compile and no extra dependency to install.

Open the page in two browser windows, join under two different names, and the
two sides will see each other.

## Features

- **Join by name.** The socket only connects once you have entered a name, and
  the server keeps a `socket.id -> name` map so it never has to trust a name
  sent in a message payload.
- **Presence.** Join and leave notices appear inline, and the status line under
  the title lists who else is online.
- **Typing indicator.** Emitted on the first keystroke and cleared after 1.5
  seconds of silence, or immediately after a send.
- **Delivery ticks.** Your own message shows a clock icon until the server
  acknowledges it, then a tick — or a red warning icon if it was rejected.
- **Safe rendering.** Messages are inserted with `textContent`, never
  `innerHTML`, so message text cannot execute as markup in anyone's browser.
- **Server-set timestamps.** The broadcast time comes from the server, so a
  client with a wrong clock cannot produce misleading timestamps.
- **Validation.** Names are capped at 30 characters and messages at 500;
  messages that are empty after trimming are dropped.
- **Date separators.** A "Today" / "Yesterday" / date pill appears whenever the
  day changes.
- **History.** Messages are stored in SQLite, and the last 50 are replayed to
  each person as they join, so a new arrival is not dropped into an empty room.
- **Rate limiting.** Each socket gets a token bucket of 5 messages, refilling
  at one per second. Over that, the message is rejected with a `rate-limited`
  acknowledgement and the sender sees an inline warning.

## Layout

```
app.js              Express + Socket.IO server
db.js               SQLite storage: save a message, read recent ones
public/index.html   Join screen and chat screen
public/main.js      Client: rendering, join flow, ticks, typing
public/style.css    Styles
```
