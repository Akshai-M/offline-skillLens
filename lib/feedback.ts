import { z } from "zod";
import { CUTOFFS } from "@/lib/config";

// The AI-generated report JSON, as stored in column AJ and returned in raw_feedback_response.
const Priority = z.enum(["high", "medium", "low"]);

// "10/120" -> { score: 10, max: 120 }
const ScorePair = z
  .string()
  .regex(/^\s*\d+\s*\/\s*\d+\s*$/, "expected a score like '10/120'")
  .transform((value) => {
    const [score, max] = value.split("/").map((part) => Number(part.trim()));
    return { score, max };
  });

const ReportSchema = z.object({
  candidate: z.string().min(1),
  result: z.object({
    coding: ScorePair,
    mcq: ScorePair,
  }),
  summary: z.string().min(1),
  weak_areas: z.array(
    z.object({ topic: z.string(), detail: z.string(), priority: Priority }),
  ),
  action_items: z.array(
    z.object({ topic: z.string(), action: z.string(), priority: Priority }),
  ),
});

export type Report = z.infer<typeof ReportSchema> & {
  email: string;
  sections: {
    coding: SectionResult;
    mcq: SectionResult;
  };
  cleared: boolean;
};

export type SectionResult = {
  score: number;
  max: number;
  cutoff: number;
  passed: boolean;
};

export type FeedbackResult =
  | { ok: true; report: Report }
  | { ok: false; message: string };

// Each failure has a short, plain message for the student. The step name goes to the server log.
function fail(step: string, message: string, detail?: unknown): FeedbackResult {
  console.error(`[feedback] ${step} failed:`, detail ?? message);
  return { ok: false, message };
}

export async function fetchReport(email: string): Promise<FeedbackResult> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) {
    return fail("config", "The report service is not configured. Please contact the team.", "APPS_SCRIPT_URL is not set");
  }

  let response: Response;
  try {
    response = await fetch(`${url}?email=${encodeURIComponent(email)}`, { cache: "no-store" });
  } catch (error) {
    // Next aborts prerendering with this digest; it is not a real network failure, so let it propagate.
    if (error instanceof Error && "digest" in error && error.digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    return fail("fetch", "We could not reach the report service. Please try again shortly.", error);
  }

  if (!response.ok) {
    return fail("http", `The report service returned an error (HTTP ${response.status}). Please try again shortly.`);
  }

  const body = await response.text();

  // Apps Script reports "not found" and other errors as plain text starting with "ERROR:".
  if (body.trimStart().startsWith("ERROR:")) {
    const reason = body.trim().slice("ERROR:".length).trim();
    if (reason.toLowerCase().includes("no row found")) {
      return fail("lookup", `No report was found for ${email}. Check that you entered the email your coordinator has on record.`, reason);
    }
    return fail("lookup", `The report service could not return your report: ${reason}`, reason);
  }

  let envelope: { status?: unknown; raw_feedback_response?: unknown };
  try {
    envelope = JSON.parse(body);
  } catch (error) {
    return fail("envelope", "The report service sent an unexpected response.", error);
  }
  if (envelope.status !== "ok") {
    return fail("envelope", "The report service sent an unexpected response.", envelope);
  }

  const raw = envelope.raw_feedback_response;
  if (typeof raw !== "string" || raw.trim() === "") {
    return fail("raw", "Your report is not ready yet. Please check again later.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return fail("report-json", "Your report data could not be read. The team has been notified.", error);
  }

  const parsed = ReportSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".") || "(root)";
    return fail("schema", `Your report data is incomplete (field: ${field}). The team has been notified.`, parsed.error.issues);
  }

  const { coding, mcq } = parsed.data.result;
  const sections = {
    coding: {
      score: coding.score,
      max: coding.max,
      cutoff: CUTOFFS.coding,
      passed: coding.score >= CUTOFFS.coding,
    },
    mcq: {
      score: mcq.score,
      max: mcq.max,
      cutoff: CUTOFFS.mcq,
      passed: mcq.score >= CUTOFFS.mcq,
    },
  };

  return {
    ok: true,
    report: {
      ...parsed.data,
      email,
      sections,
      cleared: sections.coding.passed && sections.mcq.passed,
    },
  };
}
