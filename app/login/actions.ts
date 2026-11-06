"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export type LoginState = { error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    await setSessionCookie(email);
  } catch (error) {
    console.error("[login] could not create session:", error);
    return { error: "Sign-in is not configured. Please contact the team." };
  }

  redirect("/report");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
