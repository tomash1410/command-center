import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";

const anthropic = new Anthropic();

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ── ADF text extractor ────────────────────────────────────────────────────────
// Jira Cloud returns descriptions and comments as Atlassian Document Format (ADF).
// This recursively pulls out plain text so we can pass readable content to Claude.
type AdfNode = { type: string; text?: string; content?: AdfNode[] };

function extractAdfText(node: AdfNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (!node.content?.length) return "";
  const blockTypes = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock", "tableCell"]);
  const parts = node.content.map(extractAdfText).filter(Boolean);
  return blockTypes.has(node.type) ? parts.join(" ") + "\n" : parts.join(" ");
}

// ── Jira fetch helper ─────────────────────────────────────────────────────────
async function jiraGet(path: string, credentials: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errorMessages?.[0] ?? `Jira API error ${res.status} for ${path}`);
  }
  return res.json();
}

// ── Fetch comments for a single ticket ───────────────────────────────────────
async function fetchComments(key: string, credentials: string, baseUrl: string): Promise<string[]> {
  try {
    const data = await jiraGet(
      `/rest/api/3/issue/${key}/comment?maxResults=15&orderBy=-created`,
      credentials,
      baseUrl
    );
    return (data.comments ?? [])
      .map((c: { body: AdfNode; author?: { displayName: string } }) => {
        const text = extractAdfText(c.body).trim();
        return text ? `[${c.author?.displayName ?? "Unknown"}] ${text}` : "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Fetch full details for a single sub-task ──────────────────────────────────
async function fetchSubtaskDetail(
  key: string,
  credentials: string,
  baseUrl: string
): Promise<{ key: string; summary: string; type: string; status: string; description: string; comments: string[] } | null> {
  try {
    const [issue, comments] = await Promise.all([
      jiraGet(`/rest/api/3/issue/${key}?fields=summary,issuetype,status,description`, credentials, baseUrl),
      fetchComments(key, credentials, baseUrl),
    ]);
    return {
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      description: extractAdfText(issue.fields.description).trim(),
      comments,
    };
  } catch {
    return null;
  }
}

// ── Enrich a parent ticket with its description, comments, and sub-tasks ──────
interface EnrichedTicket {
  key: string;
  summary: string;
  type: string;
  isSubtask: boolean;
  status: string;
  assignee: string | null;
  labels: string[];
  priority: string | null;
  description: string;
  comments: string[];
  subtasks: Array<{
    key: string;
    summary: string;
    type: string;
    status: string;
    description: string;
    comments: string[];
  }>;
  tfwsLinks: Array<{ key: string; summary: string }>;
}

async function enrichTicket(
  issue: {
    key: string;
    fields: {
      summary: string;
      issuetype: { name: string; subtask: boolean };
      status: { name: string };
      assignee?: { displayName: string } | null;
      labels: string[];
      priority?: { name: string } | null;
      description?: AdfNode | null;
      subtasks?: { key: string }[];
      issuelinks?: Array<{
        inwardIssue?: { key: string; fields?: { summary?: string } };
        outwardIssue?: { key: string; fields?: { summary?: string } };
      }>;
    };
  },
  credentials: string,
  baseUrl: string
): Promise<EnrichedTicket> {
  const subtaskKeys = issue.fields.subtasks?.map((s) => s.key) ?? [];

  // Extract linked TFWS tickets from issuelinks — summary is included in the link payload.
  // If the summary is missing (rare), fall back to a separate fetch.
  const rawLinks = issue.fields.issuelinks ?? [];
  const tfwsLinksRaw = rawLinks
    .map((l) => l.inwardIssue ?? l.outwardIssue)
    .filter((linked): linked is NonNullable<typeof linked> => !!linked && linked.key.startsWith("TFWS-"));

  const [comments, ...subtaskDetails] = await Promise.all([
    fetchComments(issue.key, credentials, baseUrl),
    ...subtaskKeys.map((key) => fetchSubtaskDetail(key, credentials, baseUrl)),
  ]);

  // Resolve any TFWS link summaries that weren't included in the link payload
  const tfwsLinks = await Promise.all(
    tfwsLinksRaw.map(async (linked) => {
      if (linked.fields?.summary) {
        return { key: linked.key, summary: linked.fields.summary };
      }
      try {
        const data = await jiraGet(`/rest/api/3/issue/${linked.key}?fields=summary`, credentials, baseUrl);
        return { key: linked.key, summary: data.fields.summary };
      } catch {
        return { key: linked.key, summary: "(summary unavailable)" };
      }
    })
  );

  return {
    key: issue.key,
    summary: issue.fields.summary,
    type: issue.fields.issuetype.name,
    isSubtask: issue.fields.issuetype.subtask,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee?.displayName ?? null,
    labels: issue.fields.labels,
    priority: issue.fields.priority?.name ?? null,
    description: extractAdfText(issue.fields.description).trim(),
    comments,
    subtasks: subtaskDetails.filter((s): s is NonNullable<typeof s> => s !== null),
    tfwsLinks,
  };
}

// ── KV cache key helpers ───────────────────────────────────────────────────────
function kvKey(sprint: string) {
  return `release-notes-sprint-${sprint}`;
}

interface StoredResult {
  sprint: string;
  total: number;
  returned: number;
  ticketsFetched?: string[];
  summary: string;
  generatedAt: string;
  sprintStartDate?: string | null;
  sprintEndDate?: string | null;
}

function formatSprintDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sprint = searchParams.get("sprint");
  const force = searchParams.get("force") === "true";

  if (!sprint) {
    return Response.json({ error: "Missing required query param: sprint" }, { status: 400 });
  }

  // ── KV cache check ─────────────────────────────────────────────────────────
  if (!force && isKvConfigured()) {
    try {
      const cached = await kv.get<StoredResult>(kvKey(sprint));
      if (cached) {
        return Response.json({ ...cached, fromCache: true });
      }
    } catch {
      // KV unavailable — continue to generate fresh
    }
  }

  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, ANTHROPIC_API_KEY } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }
  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY environment variable" }, { status: 500 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  // ── Step 1: Fetch Done parent tickets from the sprint ─────────────────────
  // Exclude sub-tasks — we'll fetch those via each parent's subtasks field.
  // Paginate to avoid the silent 50-ticket truncation.
  const baseJql = encodeURIComponent(
    `project=TFW AND sprint='TFW Sprint ${sprint}' AND statusCategory=Done AND issuetype != Sub-task ORDER BY issuetype ASC`
  );
  const fields = "summary,issuetype,status,assignee,labels,priority,description,subtasks,issuelinks,customfield_10020";

  const allIssues: Parameters<typeof enrichTicket>[0][] = [];
  let startAt = 0;
  let jiraTotal = 0;
  let firstPageData: Record<string, unknown> = {};

  do {
    const searchUrl = `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${baseJql}&fields=${fields}&maxResults=100&startAt=${startAt}`;
    const jiraRes = await fetch(searchUrl, {
      headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
    });
    const page = await jiraRes.json();
    if (!jiraRes.ok) {
      return Response.json(
        { error: page.errorMessages?.[0] ?? `Jira search failed: ${jiraRes.status}` },
        { status: jiraRes.status }
      );
    }
    if (startAt === 0) firstPageData = page;
    const pageIssues: Parameters<typeof enrichTicket>[0][] = page.issues ?? [];
    allIssues.push(...pageIssues);
    jiraTotal = page.total ?? allIssues.length;
    startAt += pageIssues.length;
    if (pageIssues.length < 100) break;
  } while (startAt < jiraTotal);

  const data = { ...firstPageData, issues: allIssues, total: jiraTotal };

  // ── Step 1b: Extract sprint start/end dates from customfield_10020 ───────
  // customfield_10020 is an array of sprint objects; find the matching sprint.
  let sprintStartDate: string | null = null;
  let sprintEndDate: string | null = null;
  try {
    const firstIssue = (firstPageData as { issues?: { fields?: { customfield_10020?: unknown } }[] }).issues?.[0];
    const sprintField = firstIssue?.fields?.customfield_10020;
    const sprints: Array<{ name?: string; startDate?: string; endDate?: string; completeDate?: string }> =
      Array.isArray(sprintField) ? sprintField : [];
    const match = sprints.find((s) => s.name?.includes(`Sprint ${sprint}`)) ?? sprints[0];
    if (match) {
      sprintStartDate = match.startDate ?? null;
      sprintEndDate = match.completeDate ?? match.endDate ?? null;
    }
  } catch {
    // Dates are best-effort; proceed without them
  }

  // ── Step 2: Enrich all parent tickets in parallel ─────────────────────────
  // Each enrichment fetches: description (from search), comments, and sub-task details.
  let enrichedTickets: EnrichedTicket[];
  try {
    enrichedTickets = await Promise.all(
      data.issues.map((issue: Parameters<typeof enrichTicket>[0]) =>
        enrichTicket(issue, credentials, JIRA_BASE_URL)
      )
    );
  } catch (err) {
    return Response.json(
      { error: `Failed to enrich ticket data: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  // ── Step 3: Build the prompt with full ticket context ─────────────────────
  const ticketContext = enrichedTickets
    .map((t) => {
      const lines: string[] = [
        `## ${t.key}: ${t.summary}`,
        `Type: ${t.type} | Status: ${t.status} | Priority: ${t.priority ?? "None"}`,
      ];
      if (t.description) lines.push(`\nDescription:\n${t.description}`);
      if (t.comments.length) lines.push(`\nComments (${t.comments.length}):\n${t.comments.join("\n---\n")}`);
      if (t.tfwsLinks.length) {
        lines.push(`\nLinked TFWS support tickets:`);
        for (const l of t.tfwsLinks) {
          lines.push(`  ${l.key}: ${l.summary}`);
        }
      }
      if (t.subtasks.length) {
        lines.push(`\nSub-tasks (${t.subtasks.length}):`);
        for (const s of t.subtasks) {
          lines.push(`  [${s.key}] ${s.summary} (${s.status})`);
          if (s.description) lines.push(`  Description: ${s.description}`);
          if (s.comments.length) lines.push(`  Comments:\n  ${s.comments.join("\n  ")}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const prompt = `You are writing release notes for TFW Sprint ${sprint} for stakeholders — product owners, project managers, and clients. They are non-technical but care about delivery and value.

Below is the full detail of every completed parent ticket, including descriptions, comments, sub-task content, and any linked TFWS support desk tickets. Use this material as source context when writing each entry.

${ticketContext}

---

Begin the output with this exact heading:

# TfW Rail — Sprint ${sprint} Release Notes

Then write release notes grouped into exactly four sections, in this order:

## 🐛 Bug Fixes
## ✨ Features & Enhancements
## ⚙️ Internal & Performance
## 🎫 Support Tickets

**Placement rules:**
- If a TFW ticket has one or more linked TFWS tickets (listed under "Linked TFWS support tickets"), it must appear ONLY in the 🎫 Support Tickets section. Exclude it entirely from Bug Fixes, Features & Enhancements, and Internal & Performance — even if its issuetype would normally place it there.
- All other tickets (no TFWS links) are placed according to the category definitions below.

**Category definitions — use these strictly:**

🐛 **Bug Fixes** — work that corrects broken or incorrect behaviour that end users could observe or be affected by. The thing existed, it didn't work correctly, we fixed it.

✨ **Features & Enhancements** — work that introduces something new or visibly improves something from a user-facing perspective. A non-technical stakeholder would notice or benefit from this directly.

⚙️ **Internal & Performance** — everything else. This includes: proof of concept (POC) work and technical investigations; pipeline, CI/CD, or deployment automation; API integrations or migrations; background jobs or scheduled tasks; performance improvements; dependency upgrades; code refactoring; and any work that does not directly change what end users see or do. When in doubt, ask: would a non-technical stakeholder notice or care about this directly? If no, it goes here.

**Format for Bug Fixes / Features & Enhancements / Internal & Performance entries:**

**[TFW ticket title]** (TFW-XXXX)
2–4 sentences following a two-part structure: first, a neutral description of the problem, context, or request (what was happening, what was missing, what needed doing); then the resolution phrased in active first-person — what we did and what the outcome is. Lead with the subject matter, not with "We". For example: "Apple Pay functionality was broken due to a domain configuration issue — we verified the setup and payment now works correctly across all supported devices." Do not open an entry with "We resolved", "We fixed", or "We implemented".

**Format for Support Tickets entries:**
Use the TFWS ticket summary as the entry title (not the TFW ticket title), since clients recognise support desk references more readily.

**[TFWS ticket summary]** (TFWS-XXXX / TFW-XXXX)
2–4 sentences following the same two-part structure: neutral description of the customer-reported issue, then what we did to resolve it. Lead with the subject matter, not with "We". Draw on the TFW ticket description, comments, and sub-tasks for context.
If a TFW ticket has multiple TFWS links, create one entry per TFWS ticket.

**General rules:**
- Only surface parent TFW tickets. Sub-tasks are context only — never list them as separate entries.
- Exclude any ticket whose summary contains the words "quality check" (case-insensitive) — this covers tickets like "Sprint Quality Check", "Release Quality Check [Engine]", and any similar variants. Do not include these anywhere in the output.
- Exclude pure QA, regression testing, UAT, and process/admin tickets entirely.
- Write for a non-technical client audience — specific and informative, but jargon-free.
- If a ticket's description and comments are empty or uninformative, write the best entry you can from the title and flag it with ⚠️ at the end.
- If a section has no tickets, write "Nothing to report this sprint." under the heading.
- Return only the markdown. No preamble, no sign-off, no extra commentary.`;

  // ── Step 4: Summarise with Claude ─────────────────────────────────────────
  let summary: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    summary = message.content[0].type === "text" ? message.content[0].text : "";
  } catch (err) {
    return Response.json(
      { error: `Claude summarisation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  // ── Inject sprint date subheading after the H1 ────────────────────────────
  const startFmt = formatSprintDate(sprintStartDate);
  const endFmt = formatSprintDate(sprintEndDate);
  if (startFmt || endFmt) {
    const dateLine = startFmt && endFmt
      ? `*${startFmt} – ${endFmt}*`
      : `*${startFmt ?? endFmt}*`;
    // Insert after the first H1 line
    const lines = summary.split("\n");
    const h1Index = lines.findIndex((l) => l.startsWith("# "));
    if (h1Index !== -1) {
      lines.splice(h1Index + 1, 0, "", dateLine);
      summary = lines.join("\n");
    }
  }

  const result: StoredResult = {
    sprint: `TFW Sprint ${sprint}`,
    total: data.total,
    returned: enrichedTickets.length,
    // ticketsFetched lets you verify exactly which keys reached the prompt —
    // if a ticket is missing here it was excluded by the JQL, not by Claude.
    ticketsFetched: enrichedTickets.map((t) => `${t.key}: ${t.summary}`),
    summary,
    generatedAt: new Date().toISOString(),
    sprintStartDate,
    sprintEndDate,
  };

  // ── Persist to KV ──────────────────────────────────────────────────────────
  if (isKvConfigured()) {
    try {
      await kv.set(kvKey(sprint), result);
      await kv.sadd("release-notes-sprints", sprint);
    } catch {
      // KV write failed — still return the result
    }
  }

  return Response.json(result);
}
