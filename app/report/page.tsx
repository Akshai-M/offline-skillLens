import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { fetchReport } from "@/lib/feedback";
import { getSessionEmail } from "@/lib/session";
import { logout } from "@/app/login/actions";
import { ReportDashboard } from "./report-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p className="text-sm text-muted-foreground">Loading your report…</p>
        </Shell>
      }
    >
      <ReportContent />
    </Suspense>
  );
}

async function ReportContent() {
  const email = await getSessionEmail();
  if (!email) {
    redirect("/login");
  }

  const result = await fetchReport(email);
  if (!result.ok) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertTitle>We could not show your report.</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
        <a href="/login" className={buttonVariants({ variant: "link", className: "mt-2 px-0" })}>
          Try a different email
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <ReportDashboard report={result.report} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-4 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex justify-end">
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        {children}
      </div>
    </main>
  );
}
