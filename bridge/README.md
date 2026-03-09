# Command Centre Bridge

A local Express server that exposes Apple Mail and Calendar data to the Command Centre dashboard via AppleScript.

Runs on **http://localhost:3333**.

---

## Setup

```bash
cd bridge
npm install
node server.js
```

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness check — returns `{ status: "ok" }` |
| `GET /calendar` | Today's events from Calendar.app |
| `GET /mail` | Up to 20 most recent unread emails from Mail.app inbox |

### `/calendar` response shape

```json
[
  {
    "title": "Team standup",
    "startTime": "09/03/2026 09:00:00",
    "endTime": "09/03/2026 09:15:00",
    "location": "Google Meet",
    "attendees": ["Alice Smith", "Bob Jones"]
  }
]
```

### `/mail` response shape

```json
[
  {
    "subject": "Re: Sprint 47 sign-off",
    "from": "alice@example.com",
    "date": "Sunday, 9 March 2026 at 08:45:00",
    "mailbox": "INBOX",
    "isRead": false
  }
]
```

If AppleScript fails (app not running, permissions denied, etc.) the endpoint returns the empty array plus an `error` string rather than crashing:

```json
{ "events": [], "error": "osascript: some error message" }
```

---

## macOS permissions

The first time you run the server, macOS will prompt for permission to access Calendar and Mail. Grant both. If you accidentally deny them:

**System Settings → Privacy & Security → Automation** — find Terminal (or your Node.js process) and enable Calendar and Mail.

---

## Run automatically at login

### Option A — Login Items (simplest)

1. Create a small shell script, e.g. `~/start-bridge.sh`:

```bash
#!/bin/bash
cd /Users/YOUR_USERNAME/Documents/Dev/command-centre/bridge
node server.js >> ~/Library/Logs/command-centre-bridge.log 2>&1
```

2. Make it executable:

```bash
chmod +x ~/start-bridge.sh
```

3. **System Settings → General → Login Items** → click **+** and add `start-bridge.sh`.

### Option B — launchd plist (more reliable, survives crashes)

Create `~/Library/LaunchAgents/com.commandcentre.bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.commandcentre.bridge</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/Documents/Dev/command-centre/bridge/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>/Users/YOUR_USERNAME/Documents/Dev/command-centre/bridge</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/Users/YOUR_USERNAME/Library/Logs/command-centre-bridge.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USERNAME/Library/Logs/command-centre-bridge.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` and the `node` path (find yours with `which node`), then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.commandcentre.bridge.plist
```

To unload: `launchctl unload ~/Library/LaunchAgents/com.commandcentre.bridge.plist`

To view logs: `tail -f ~/Library/Logs/command-centre-bridge.log`
