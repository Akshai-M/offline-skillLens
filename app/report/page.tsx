import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { CircleDotDashed } from "lucide-react";
import { getSessionEmail } from "@/lib/session";
import { logout } from "@/app/login/actions";
import { ReportLoader } from "./report-loader";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <CircleDotDashed className="size-5 animate-spin" aria-hidden="true" />
            Loading report
          </div>
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

  return (
    <Shell>
      <ReportLoader email={email} signOut={logout} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-4 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {children}
      </div>
    </main>
  );
}
