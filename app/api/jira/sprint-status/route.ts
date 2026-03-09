// ── Types ─────────────────────────────────────────────────────────────────────

export interface SprintIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  timeOriginalEstimate: number | null; // seconds
  timeSpent: number | null;            // seconds
  created: string;                     // ISO
  lastUpdated: string;                 // ISO
  lastStatusChange: string | null;     // ISO
  priority: string;
  issueType: string;
  url: string;
  storyPoints: number | null;
}

export interface SprintStatusResponse {
  sprint: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    percentElapsed: number;
  };
  summary: {
    total: number;
    done: number;
    inProgress: number;
    toDo: number;
    storyPointsTotal: number;
    storyPointsDone: number;
  };
  flags: {
    overEstimate: SprintIssue[];
    staleInReview: SprintIssue[];
    staleInProgress: SprintIssue[];
    notStarted: SprintIssue[];
    noAssignee: SprintIssue[];
    addedMidSprint: SprintIssue[];
  };
  allIssues: SprintIssue[];
}

// ── Jira raw shapes ───────────────────────────────────────────────────────────

interface JiraChangelogItem {
  field: string;
  fromString: string | null;
  toString: string | null;
}

interface JiraChangelogHistory {
  created: string;
  items: JiraChangelogItem[];
}

interface JiraRawIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string } | null;
    timeoriginalestimate: number | null;
    timespent: number | null;
    updated: string;
    created: string;
    priority: { name: string } | null;
    issuetype: { name: string };
    customfield_10016: number | null; // story points
  };
  changelog: {
    histories: JiraChangelogHistory[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function isDone(status: string): boolean {
  return /done|delivered|closed|complete/i.test(status);
}

function isInProgress(status: string): boolean {
  return /progress|development|review|testing|staging|pilot/i.test(status);
}

function lastStatusChangeDate(histories: JiraChangelogHistory[]): string | null {
  // histories are oldest-first; iterate in reverse for the most recent status change
  for (let i = histories.length - 1; i >= 0; i--) {
    if (histories[i].items.some((item) => item.field === "status")) {
      return histories[i].created;
    }
  }
  return null;
}

function toSprintIssue(raw: JiraRawIssue, baseUrl: string): SprintIssue {
  return {
    key: raw.key,
    summary: raw.fields.summary,
    status: raw.fields.status.name,
    assignee: raw.fields.assignee?.displayName ?? null,
    timeOriginalEstimate: raw.fields.timeoriginalestimate,
    timeSpent: raw.fields.timespent,
    created: raw.fields.created,
    lastUpdated: raw.fields.updated,
    lastStatusChange: lastStatusChangeDate(raw.changelog.histories),
    priority: raw.fields.priority?.name ?? "None",
    issueType: raw.fields.issuetype.name,
    url: `${baseUrl}/browse/${raw.key}`,
    storyPoints: raw.fields.customfield_10016,
  };
}

// ── Jira fetch helpers ────────────────────────────────────────────────────────

async function jiraGet(path: string, baseUrl: string, credentials: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Jira request failed: ${res.status} ${path}`);
  }
  return res.json();
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira environment variables" }, { status: 500 });
  }

  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  try {
    // 1. Find TFW scrum board
    const boardData = await jiraGet(
      "/rest/agile/1.0/board?projectKeyOrId=TFW&type=scrum",
      JIRA_BASE_URL,
      credentials,
    );
    const boardId: number = boardData.values?.[0]?.id;
    if (!boardId) throw new Error("No TFW scrum board found");

    // 2. Get active sprint
    const sprintData = await jiraGet(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active`,
      JIRA_BASE_URL,
      credentials,
    );
    const sprint = sprintData.values?.[0];
    if (!sprint) throw new Error("No active sprint found");

    const sprintStart = new Date(sprint.startDate);
    const sprintEnd = new Date(sprint.endDate);
    const now = Date.now();
    const totalMs = sprintEnd.getTime() - sprintStart.getTime();
    const elapsedMs = now - sprintStart.getTime();
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const endMidnight = new Date(sprintEnd); endMidnight.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(0, Math.round((endMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));
    const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

    // 3. Get sprint issues with changelog
    const fields = [
      "summary", "status", "assignee",
      "timeoriginalestimate", "timespent",
      "updated", "created", "priority", "issuetype", "customfield_10016",
    ].join(",");

    const issueData = await jiraGet(
      `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=100&expand=changelog&fields=${fields}`,
      JIRA_BASE_URL,
      credentials,
    );

    const rawIssues: JiraRawIssue[] = issueData.issues ?? [];
    const allIssues = rawIssues.map((r) => toSprintIssue(r, JIRA_BASE_URL));

    // 4. Summary counts
    let done = 0, inProgress = 0, toDo = 0;
    let storyPointsTotal = 0, storyPointsDone = 0;

    for (const issue of allIssues) {
      if (isDone(issue.status)) {
        done++;
        if (issue.storyPoints) storyPointsDone += issue.storyPoints;
      } else if (isInProgress(issue.status)) {
        inProgress++;
      } else {
        toDo++;
      }
      if (issue.storyPoints) storyPointsTotal += issue.storyPoints;
    }

    // 5. Flags
    const overEstimate = allIssues.filter(
      (i) => i.timeSpent !== null && i.timeOriginalEstimate !== null && i.timeSpent > i.timeOriginalEstimate,
    );

    const staleInReview = allIssues.filter(
      (i) =>
        /review|testing|qa/i.test(i.status) &&
        i.lastStatusChange !== null &&
        daysSince(i.lastStatusChange) > 2,
    );

    const staleInProgress = allIssues.filter(
      (i) =>
        /in progress|in development/i.test(i.status) &&
        daysSince(i.lastUpdated) > 2,
    );

    const notStarted = allIssues.filter(
      (i) => /^(to do|open)$/i.test(i.status.trim()) && percentElapsed > 50,
    );

    const noAssignee = allIssues.filter(
      (i) => i.assignee === null && !isDone(i.status) && !/^(to do|open)$/i.test(i.status.trim()),
    );

    const createdAfterSprintStart = allIssues.filter((issue) => {
      const raw = rawIssues.find((r) => r.key === issue.key);
      return raw && new Date(raw.fields.created) > sprintStart && !isDone(issue.status);
    });

    const response: SprintStatusResponse = {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        daysRemaining,
        percentElapsed,
      },
      summary: {
        total: allIssues.length,
        done,
        inProgress,
        toDo,
        storyPointsTotal,
        storyPointsDone,
      },
      flags: {
        overEstimate,
        staleInReview,
        staleInProgress,
        notStarted,
        noAssignee,
        addedMidSprint: createdAfterSprintStart,
      },
      allIssues,
    };

    return Response.json(response);
  } catch (err) {
    console.error("[sprint-status]", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
