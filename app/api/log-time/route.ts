interface WorklogEntry {
  issueKey: string;
  timeSpentSeconds: number;
  started: string;
  comment: object;
}

interface WorklogResult {
  issueKey: string;
  success: boolean;
  status: number;
  error?: string;
}

export async function POST(request: Request) {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }

  let entries: WorklogEntry[];
  try {
    entries = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const results: WorklogResult[] = [];

  for (const entry of entries) {
    const url = `${JIRA_BASE_URL}/rest/api/3/issue/${entry.issueKey}/worklog`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeSpentSeconds: entry.timeSpentSeconds,
          started: entry.started,
          comment: entry.comment,
        }),
      });

      if (res.ok) {
        results.push({ issueKey: entry.issueKey, success: true, status: res.status });
      } else {
        const err = await res.json().catch(() => ({}));
        const message = (err as { errorMessages?: string[] }).errorMessages?.[0] ?? `HTTP ${res.status}`;
        results.push({ issueKey: entry.issueKey, success: false, status: res.status, error: message });
      }
    } catch (err) {
      results.push({ issueKey: entry.issueKey, success: false, status: 0, error: (err as Error).message });
    }
  }

  return Response.json({ results });
}
