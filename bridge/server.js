const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = 3333;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── AppleScript runner ────────────────────────────────────────────────────────
// Pipes the script to osascript via stdin — no temp files, no shell escaping.
function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-"]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `osascript exited with code ${code}`));
      else resolve(stdout.trim());
    });
    child.stdin.write(script);
    child.stdin.end();
  });
}

// ASCII 30 (Record Separator) as field delimiter — safe, never appears in
// natural text. Newline separates records. Parsed by splitting in Node.
const FIELD_SEP = String.fromCharCode(30);

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── GET /calendar ─────────────────────────────────────────────────────────────
// Returns today's events from Calendar.app.
// Shape: [{ title, startTime, endTime, location, attendees }]
app.get("/calendar", async (_req, res) => {
  const script = `
set SEP to character id 30
set LF to character id 10
set output to ""

tell application "Calendar"
  set todayDate to (current date)
  set hours of todayDate to 0
  set minutes of todayDate to 0
  set seconds of todayDate to 0
  set tomorrowDate to todayDate + (60 * 60 * 24)

  repeat with cal in every calendar
    try
      set dayEvents to (every event of cal whose start date >= todayDate and start date < tomorrowDate)
      repeat with e in dayEvents
        try
          set eTitle to summary of e as string

          set eStartDate to start date of e
          set eEndDate to end date of e

          -- Format as "DD Mon YYYY HH:MM"
          set eStart to (short date string of eStartDate) & " " & (time string of eStartDate)
          set eEnd to (short date string of eEndDate) & " " & (time string of eEndDate)

          set eLoc to ""
          try
            set rawLoc to location of e
            if rawLoc is not missing value then set eLoc to rawLoc as string
          end try

          set eAttendees to ""
          try
            set attList to attendees of e
            set attNames to {}
            repeat with att in attList
              try
                set end of attNames to (display name of att) as string
              end try
            end repeat
            if (count of attNames) > 0 then
              set AppleScript's text item delimiters to ", "
              set eAttendees to attNames as string
              set AppleScript's text item delimiters to ""
            end if
          end try

          set output to output & eTitle & SEP & eStart & SEP & eEnd & SEP & eLoc & SEP & eAttendees & LF
        end try
      end repeat
    end try
  end repeat
end tell

return output
`;

  try {
    const raw = await runAppleScript(script);
    const events = [];

    if (raw) {
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split(FIELD_SEP);
        if (parts.length < 5) continue;
        events.push({
          title:     parts[0] || "",
          startTime: parts[1] || "",
          endTime:   parts[2] || "",
          location:  parts[3] || "",
          attendees: parts[4] ? parts[4].split(", ").filter(Boolean) : [],
        });
      }
    }

    res.json(events);
  } catch (err) {
    console.error("[/calendar]", err.message);
    res.json({ events: [], error: err.message });
  }
});

// ── GET /mail ─────────────────────────────────────────────────────────────────
// Returns up to 20 most recent unread emails from the unified inbox.
// Shape: [{ subject, from, date, mailbox, isRead }]
app.get("/mail", async (_req, res) => {
  // Scan the 100 most recent inbox messages without a "whose" filter —
  // AppleScript "whose" clauses evaluate every message and are extremely slow.
  // Iterating a bounded slice and checking read status in-loop is much faster.
  const script = `
set SEP to character id 30
set LF to character id 10
set output to ""
set found to 0

tell application "Mail"
  try
    set allMsgs to messages of inbox
    set total to count of allMsgs
    if total > 100 then set total to 100

    repeat with i from 1 to total
      if found >= 20 then exit repeat
      set m to item i of allMsgs
      try
        if read status of m is false then
          set mSubject to subject of m as string
          set mFrom to sender of m as string
          set mDate to (date received of m) as string
          set mBox to name of mailbox of m as string
          set output to output & mSubject & SEP & mFrom & SEP & mDate & SEP & mBox & LF
          set found to found + 1
        end if
      end try
    end repeat
  end try
end tell

return output
`;

  try {
    const raw = await runAppleScript(script);
    const emails = [];

    if (raw) {
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split(FIELD_SEP);
        if (parts.length < 4) continue;
        emails.push({
          subject: parts[0] || "(no subject)",
          from:    parts[1] || "",
          date:    parts[2] || "",
          mailbox: parts[3] || "",
          isRead:  false,
        });
      }
    }

    res.json(emails);
  } catch (err) {
    console.error("[/mail]", err.message);
    res.json({ emails: [], error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bridge server running at http://localhost:${PORT}`);
  console.log(`  GET /health   — liveness check`);
  console.log(`  GET /calendar — today's Calendar.app events`);
  console.log(`  GET /mail     — unread Mail.app messages`);
});
