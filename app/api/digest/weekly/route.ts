import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";

const anthropic = new Anthropic();

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const OPEN_STATUSES = [
  "Assigned to Support",
  "Assigned to Customer",
  "Under Investigation",
  "In Backlog",
  "On Hold / Flagged For Discussion",
  "In Sprint for Development",
  "On Staging for UAT Approval",
  "On Pilot for UAT Approval",
  "Open but Blocked",
  "Ready for Go-Live",
  "Waiting for 3rd Party",
];

interface DigestResult {
  weekEnding: string;
  totalOpen: number;
  newThisWeek: number;
  byStatus: { status: string; count: number }[];
  themes: string[];
  generatedAt: string;
}

// ── GET: return latest cached digest ─────────────────────────────────────────

export async function GET() {
  if (!isKvConfigured()) {
    return Response.json({ error: "No digest found" }, { status: 404 });
  }
  try {
    const cached = await kv.get<DigestResult>("digest:weekly:latest");
    if (!cached) return Response.json({ error: "No digest found" }, { status: 404 });
    return Response.json(cached);
  } catch {
    return Response.json({ error: "KV read failed" }, { status: 500 });
  }
}

// ── POST: generate fresh digest ───────────────────────────────────────────────

export async function POST() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, ANTHROPIC_API_KEY } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }
  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  try {
    const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
    const jql = "project = TFWS AND statusCategory != Done";
    const fields = "summary,status,created,updated,assignee,comment";
    const pageSize = 100;

    // ── Step 1: Fetch all open tickets (paginated) ────────────────────────────
    interface JiraIssue {
      fields: {
        summary: string;
        status: { name: string };
        created: string;
      };
    }

    const allIssues: JiraIssue[] = [];
    let startAt = 0;

    while (true) {
      const res = await fetch(
        `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${pageSize}&startAt=${startAt}`,
        { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errorMessages?.[0] ?? `Jira fetch failed: ${res.status}`);
      }
      const data = await res.json();
      const issues: JiraIssue[] = data.issues ?? [];
      allIssues.push(...issues);
      startAt += issues.length;
      if (data.isLast || issues.length === 0 || startAt >= (data.total ?? Infinity)) break;
    }

    // ── Step 2: Count by status and new this week ─────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const issue of allIssues) {
      const name = issue.fields.status.name;
      statusMap[name] = (statusMap[name] ?? 0) + 1;
    }

    const byStatus = OPEN_STATUSES
      .map((status) => ({ status, count: statusMap[status] ?? 0 }))
      .filter((s) => s.count > 0);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = allIssues.filter(
      (i) => new Date(i.fields.created).getTime() >= sevenDaysAgo
    ).length;

    // ── Step 3: Ask Claude for notable themes ─────────────────────────────────
    const ticketList = allIssues
      .map((i) => `- ${i.fields.summary} [${i.fields.status.name}]`)
      .join("\n");

    const prompt = `You are analysing the current open support desk tickets for Transport for Wales Rail to identify the most notable themes this week.

Here are all ${allIssues.length} open TFWS tickets with their statuses:

${ticketList}

Identify 3–5 notable themes from these tickets. Each theme should be a concise, business-readable label that groups related issues — for example: "PAYG card registration & account issues", "Payment failures (some in sprint, one awaiting 3rd party)", "Journey planning inaccuracies".

Return only the theme labels, one per line, starting each with a dash (-). No preamble, no commentary, no numbering.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const themesRaw = message.content[0].type === "text" ? message.content[0].text : "";
    const themes = themesRaw
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    // ── Step 4: Build result ──────────────────────────────────────────────────
    const weekEnding = new Date().toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

    const result: DigestResult = {
      weekEnding,
      totalOpen: allIssues.length,
      newThisWeek,
      byStatus,
      themes,
      generatedAt: new Date().toISOString(),
    };

    // ── Step 5: Persist to KV ─────────────────────────────────────────────────
    if (isKvConfigured()) {
      try {
        await kv.set("digest:weekly:latest", result);
        await kv.lpush("digest:weekly:history", JSON.stringify(result));
        await kv.ltrim("digest:weekly:history", 0, 11);
      } catch {
        // KV write failed — still return the result
      }
    }

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
