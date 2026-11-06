// Usage: node --env-file=.env scripts/generate-feedback.mjs <email>
// Fetches a student's report from the Apps Script endpoint and prints the feedback as JSON only.

const email = process.argv[2];
const url = process.env.APPS_SCRIPT_URL;

if (!email) {
  console.error(JSON.stringify({ error: "Usage: generate-feedback.mjs <email>" }));
  process.exit(1);
}
if (!url) {
  console.error(JSON.stringify({ error: "APPS_SCRIPT_URL is not set in .env" }));
  process.exit(1);
}

const response = await fetch(`${url}?email=${encodeURIComponent(email)}`);
if (!response.ok) {
  console.error(JSON.stringify({ error: `Request failed with HTTP ${response.status}` }));
  process.exit(1);
}

const payload = await response.json();
if (payload.status !== "ok") {
  console.error(JSON.stringify({ error: "Endpoint returned a non-ok status", status: payload.status }));
  process.exit(1);
}

// The report is itself a JSON string inside raw_feedback_response.
const report = JSON.parse(payload.raw_feedback_response);

const feedback = {
  email: payload.email,
  candidate: report.candidate,
  result: report.result,
  summary: report.summary,
  weak_areas: report.weak_areas,
  action_items: report.action_items,
};

console.log(JSON.stringify(feedback, null, 2));
