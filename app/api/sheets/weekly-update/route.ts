import { createSign } from "crypto";

const SPREADSHEET_ID = "1GnvIPn1lppwNNcCs0pK8pI7_H8jOYCl9ZZP3BoQssyM";

// ── Google Service Account auth ───────────────────────────────────────────────

function makeJWT(email: string, key: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const sig = createSign("RSA-SHA256");
  sig.update(`${header}.${claim}`);
  return `${header}.${claim}.${sig.sign(key, "base64url")}`;
}

async function getAccessToken(email: string, key: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: makeJWT(email, key),
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description ?? "Google auth failed");
  return data.access_token;
}

// ── Sheets helpers ────────────────────────────────────────────────────────────

const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

async function sheetsGet(path: string, token: string) {
  const res = await fetch(`${sheetsBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Sheets GET failed: ${await res.text()}`);
  return res.json();
}

async function sheetsPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${sheetsBase}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sheets POST failed: ${await res.text()}`);
  return res.json();
}

async function sheetsPut(path: string, token: string, body: unknown) {
  const res = await fetch(`${sheetsBase}${path}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sheets PUT failed: ${await res.text()}`);
  return res.json();
}

// ── Jira count helper ─────────────────────────────────────────────────────────

async function jiraCount(jql: string, credentials: string, baseUrl: string): Promise<number> {
  try {
    const res = await fetch(
      `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=0`,
      { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } }
    );
    if (!res.ok) return 0;
    return (await res.json()).total ?? 0;
  } catch {
    return 0;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  try {
  const {
    JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN,
    GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return Response.json({ error: "Missing Google environment variables" }, { status: 500 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const privateKey = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const base = "project = TFWS AND statusCategory != Done";

  // ── Step 1: Fetch ALL TFWS tickets (paginated) and count by status ──────────
  // Column order A–R (13 status columns B–N, then totals O–R):
  const columnStatuses = [
    "Assigned to Customer",        // B
    "Assigned to Support",         // C
    "In Backlog",                  // D
    "On Hold / Flagged For Discussion", // E
    "In Sprint for Development",   // F
    "On Staging for UAT Approval", // G
    "Open but Blocked",            // H
    "Ready for Go-Live",           // I
    "Under investigation",         // J
    "Waiting for 3rd Party",       // K
    "Closed - No Further Action",  // L
    "Done / Delivered",            // M
  ];

  interface JiraIssue {
    fields: {
      status: { name: string; statusCategory: { key: string } };
      created: string;
      resolutiondate: string | null;
      updated: string;
    };
  }

  async function fetchClosedIssues(status: string): Promise<{ updated: string }[]> {
    const jql = `project = TFWS AND status = "${status}" AND updated >= -7d`;
    const res = await fetch(
      `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=updated&maxResults=500`,
      { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } }
    );
    if (!res.ok) {
      console.error(`[weekly-update] fetchClosedIssues(${status}) failed:`, await res.text());
      return [];
    }
    const data = await res.json();
    return (data.issues ?? []).map((i: { fields: { updated: string } }) => ({
      updated: i.fields.updated,
    }));
  }

  const allIssues: JiraIssue[] = [];
  const rawCounts: Record<string, number> = {};
  let startAt = 0;
  const pageSize = 100;

  // Log the exact JQL being sent for the open fetch
  console.log("[weekly-update] Open fetch JQL:", base);

  // Fetch open tickets + closed status issues in parallel
  const [, closedIssues, doneIssues] = await Promise.all([
    (async () => {
      while (true) {
        const res = await fetch(
          `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(base)}&fields=status,created,resolutiondate,updated&maxResults=${pageSize}&startAt=${startAt}`,
          { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } }
        );
        if (!res.ok) {
          console.error("[weekly-update] Jira fetch failed:", await res.text());
          break;
        }
        const data = await res.json();
        const issues: JiraIssue[] = data.issues ?? [];
        for (const issue of issues) {
          allIssues.push(issue);
          const name = issue.fields.status.name;
          rawCounts[name] = (rawCounts[name] ?? 0) + 1;
        }
        startAt += issues.length;
        if (data.isLast || issues.length === 0 || startAt >= (data.total ?? Infinity)) break;
      }
    })(),
    fetchClosedIssues("Closed - No Further Action"),
    fetchClosedIssues("Done / Delivered"),
  ]);

  console.log("[weekly-update] Open tickets fetched:", allIssues.length, "| closed:", closedIssues.length, "| done:", doneIssues.length);
  console.log("[weekly-update] Open status breakdown (all statuses present):", JSON.stringify(rawCounts, null, 2));

  rawCounts["Closed - No Further Action"] = closedIssues.length;
  rawCounts["Done / Delivered"] = doneIssues.length;

  const statusCounts = columnStatuses.map((s) => rawCounts[s] ?? 0);

  // ── Step 2: Compute summary totals from fetched tickets ────────────────────
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const totalOpen  = allIssues.length;
  const created7d  = allIssues.filter((i) => new Date(i.fields.created).getTime() >= sevenDaysAgo).length;
  const allClosed  = [...closedIssues, ...doneIssues];
  const resolved7d = allClosed.filter((i) => new Date(i.updated).getTime() >= sevenDaysAgo).length;
  const updated7d  = allIssues.filter((i) => new Date(i.fields.updated).getTime() >= sevenDaysAgo).length;

  console.log("[weekly-update] Totals — open:", totalOpen, "created7d:", created7d, "resolved7d:", resolved7d, "updated7d:", updated7d);

  // ── Step 3: Build the row — exactly 18 values covering columns A–R ─────────
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const dateRange = `${fmt(weekAgo)} - ${fmt(today)}`;

  // A: date range, B–M: status counts (12), N: empty, O: total open, P: created, Q: resolved, R: updated
  const row = [dateRange, ...statusCounts, "", totalOpen, created7d, resolved7d, updated7d];
  console.log("[weekly-update] Row to write (18 cols):", row);

  // ── Steps 4–6: Auth, append row, format ───────────────────────────────────
  const token = await getAccessToken(GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey);

  const meta = await sheetsGet("?fields=sheets.properties", token);
  const sheetMeta = (meta.sheets as { properties: { title: string; sheetId: number } }[])
    ?.find((s) => s.properties.title === "Sheet1");
  const sheetId = sheetMeta?.properties?.sheetId ?? 0;

  const existing = await sheetsGet("/values/Sheet1!A:A", token);
  const currentRowCount: number = (existing.values as unknown[])?.length ?? 0;
  const nextRow = currentRowCount + 1;

  await sheetsPut(
    `/values/Sheet1!A${nextRow}:R${nextRow}?valueInputOption=USER_ENTERED`,
    token,
    { values: [row] }
  );

  const newRowIndex = nextRow - 1;
  const prevRowIndex = newRowIndex - 1;

  const requests: unknown[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: newRowIndex, endRowIndex: newRowIndex + 1, startColumnIndex: 0, endColumnIndex: 18 },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", textFormat: { bold: true } } },
        fields: "userEnteredFormat/horizontalAlignment,userEnteredFormat/textFormat/bold",
      },
    },
  ];

  if (prevRowIndex >= 1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: prevRowIndex, endRowIndex: prevRowIndex + 1, startColumnIndex: 0, endColumnIndex: 18 },
        cell: { userEnteredFormat: { textFormat: { bold: false, strikethrough: true, foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } } } },
        fields: "userEnteredFormat/textFormat/bold,userEnteredFormat/textFormat/strikethrough,userEnteredFormat/textFormat/foregroundColor",
      },
    });
  }

  await sheetsPost(":batchUpdate", token, { requests });

  return Response.json({ success: true, dateRange, row });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[weekly-update] Unhandled error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
