import { kv } from "@vercel/kv";

const KV_KEY = "triage-latest";
const INTERNAL_TEAM = ["Tom", "Bartek", "Pawel", "Paweł", "Rachel", "Amadeusz", "Kacper", "Dafydd"];
const GONE_QUIET_EXCLUDE_STATUSES = ["Waiting for 3rd Party", "Open but Blocked"];
const GONE_QUIET_DAYS = 7;

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    created: string;
    updated: string;
    priority?: { name: string };
    assignee?: { displayName: string } | null;
    customfield_10268?: string | { displayName?: string; name?: string } | null;
  };
}

function extractLastCommentAuthor(field: JiraIssue["fields"]["customfield_10268"]): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.displayName ?? field.name ?? "";
}

function isInternalAuthor(author: string): boolean {
  const lower = author.toLowerCase();
  return INTERNAL_TEAM.some((name) => lower.includes(name.toLowerCase()));
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function toTicketSummary(issue: JiraIssue) {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    created: issue.fields.created,
    updated: issue.fields.updated,
    assignee: issue.fields.assignee?.displayName ?? null,
    priority: issue.fields.priority?.name ?? null,
    lastCommentAuthor: extractLastCommentAuthor(issue.fields.customfield_10268),
  };
}

async function fetchAllIssues(baseUrl: string, credentials: string): Promise<JiraIssue[]> {
  const fields = "summary,status,created,updated,priority,assignee,customfield_10268";
  const jql = encodeURIComponent("project = TFWS AND statusCategory != Done ORDER BY updated DESC");
  const maxResults = 100;
  const issues: JiraIssue[] = [];
  let startAt = 0;
  let total = Infinity;

  while (issues.length < total) {
    const url = `${baseUrl}/rest/api/3/search/jql?jql=${jql}&fields=${fields}&maxResults=${maxResults}&startAt=${startAt}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.errorMessages?.[0] ?? `Jira search failed: ${res.status}`);
    }

    const data = await res.json();
    total = data.total;
    issues.push(...data.issues);
    startAt += data.issues.length;

    if (data.issues.length < maxResults) break;
  }

  return issues;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cached = searchParams.get("cached") === "true";

  // Return cached result without hitting Jira
  if (cached && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const stored = await kv.get(KV_KEY);
      if (stored) return Response.json(stored);
    } catch {}
    return Response.json({ error: "No cached triage data" }, { status: 404 });
  }

  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  let issues: JiraIssue[];
  try {
    issues = await fetchAllIssues(JIRA_BASE_URL, credentials);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  const newToday = [];
  const needsResponse = [];
  const goneQuiet = [];

  for (const issue of issues) {
    const summary = toTicketSummary(issue);
    const statusName = issue.fields.status.name;
    const author = summary.lastCommentAuthor;

    if (isToday(issue.fields.created)) {
      newToday.push(summary);
    }

    if (author && !isInternalAuthor(author)) {
      needsResponse.push(summary);
    }

    const excludedStatus = GONE_QUIET_EXCLUDE_STATUSES.some(
      (s) => statusName.toLowerCase() === s.toLowerCase()
    );
    if (!excludedStatus && daysSince(issue.fields.updated) >= GONE_QUIET_DAYS) {
      goneQuiet.push(summary);
    }
  }

  const result = {
    fetchedAt: new Date().toISOString(),
    totalOpen: issues.length,
    newToday: { count: newToday.length, tickets: newToday },
    needsResponse: { count: needsResponse.length, tickets: needsResponse },
    goneQuiet: { count: goneQuiet.length, tickets: goneQuiet },
  };

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try { await kv.set(KV_KEY, result); } catch {}
  }

  return Response.json(result);
}
