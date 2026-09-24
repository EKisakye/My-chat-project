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
- **Direct messages and groups.** The sidebar splits into a Direct tab and a
  Groups tab. A DM is addressed by the pair of names involved, and groups are
  public rooms anyone can create and join. Unread counts appear on any
  conversation you are not currently looking at.
- **Profile photos and status.** Both are set from the Profile pane inside the
  app, reached by clicking your avatar. A photo is centre-cropped and re-encoded
  to 128px in the browser before upload, so a large phone photo becomes a small
  data URL. The server accepts only PNG, JPEG and WebP data URLs — SVG is
  refused because it can carry script — and stores them in SQLite, so both
  survive a restart.
- **Starting a chat.** The new chat button opens a contact picker listing
  everyone registered, separate from the chat list, which holds only
  conversations that have messages.
- **Searching.** The sidebar search filters conversations and the sliders button
  narrows to unread only. The header search filters the open conversation,
  dimming non-matches and highlighting hits.
- **History.** Messages are stored in SQLite per conversation, and the last 50
  of whichever conversation you open are replayed, so you are never dropped
  into an empty room.
- **Rate limiting.** Each socket gets a token bucket of 5 messages, refilling
  at one per second. Over that, the message is rejected with a `rate-limited`
  acknowledgement and the sender sees an inline warning.

## Layout

```
app.js              Express + Socket.IO server: presence, routing, rate limiting
db.js               SQLite storage: messages, users, groups
public/index.html   Landing page and the app shell
public/main.js      Client: conversations, profile, search, rendering
public/style.css    Styles
```

## Accessibility note

Text on a coloured surface is checked against WCAG AA (4.5:1) rather than
eyeballed. White on the primary blue `#2563EB` measures 5.17:1 and passes. An
earlier pale blue palette was changed for this reason: white on `#6CABDD` is
only 2.47:1, so labels on blue were switched to navy instead.
