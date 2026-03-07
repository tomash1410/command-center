export async function GET() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/field`, {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
    },
  });

  const data: { id: string; name: string; custom: boolean; schema?: { type: string } }[] = await res.json();

  // Sort custom fields first, then filter to anything with "comment" or "author" in the name
  // so the relevant field is easy to spot at the top of the response
  const sorted = [...data].sort((a, b) => {
    const aMatch = /comment|author/i.test(a.name) ? 0 : 1;
    const bMatch = /comment|author/i.test(b.name) ? 0 : 1;
    return aMatch - bMatch || a.name.localeCompare(b.name);
  });

  return Response.json(sorted, { status: res.status });
}
