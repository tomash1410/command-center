import { kv } from "@vercel/kv";

interface StoredResult {
  sprint: string;
  total: number;
  returned: number;
  generatedAt: string;
  sprintStartDate?: string | null;
  sprintEndDate?: string | null;
}

export async function GET() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return Response.json({ sprints: [] });
  }

  let sprintNumbers: string[];
  try {
    sprintNumbers = (await kv.smembers("release-notes-sprints")) as string[];
  } catch {
    return Response.json({ sprints: [] });
  }

  if (!sprintNumbers.length) {
    return Response.json({ sprints: [] });
  }

  const entries = await Promise.all(
    sprintNumbers.map(async (rawNum) => {
      const num = String(rawNum);
      try {
        const data = await kv.get<StoredResult>(`release-notes-sprint-${num}`);
        if (!data) return null;
        return {
          number: num,
          sprint: data.sprint,
          total: data.total,
          returned: data.returned,
          generatedAt: data.generatedAt,
          sprintStartDate: data.sprintStartDate ?? null,
          sprintEndDate: data.sprintEndDate ?? null,
        };
      } catch {
        return null;
      }
    })
  );

  return Response.json({
    sprints: entries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => Number(b.number) - Number(a.number)),
  });
}
