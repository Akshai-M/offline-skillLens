"use server";

import { redirect } from "next/navigation";
import { fetchReport, type FeedbackResult } from "@/lib/feedback";
import { getSessionEmail } from "@/lib/session";

// The only path to the Apps Script endpoint. It runs on the server and uses the signed-in email.
export async function loadReport(): Promise<FeedbackResult> {
  const email = await getSessionEmail();
  if (!email) {
    redirect("/login");
  }
  return fetchReport(email);
}
