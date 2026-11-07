"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleDotDashed, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadReport } from "./actions";
import { ReportDashboard } from "./report-dashboard";
import { parseCache, readCacheRaw, subscribeCache, writeCache, type CachedReport } from "./report-cache";
import { SignOutButton } from "./sign-out-button";

// Shows the cached report at once. Fetches from the server only when nothing is cached,
// or when the student presses Refresh.
export function ReportLoader({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const raw = useSyncExternalStore(
    subscribeCache,
    () => readCacheRaw(email),
    () => null,
  );
  const [fresh, setFresh] = useState<CachedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cached = fresh ?? parseCache(raw);

  // First visit on this browser: nothing cached, so fetch once.
  useEffect(() => {
    if (parseCache(raw)) return;
    let active = true;
    loadReport().then((result) => {
      if (!active) return;
      if (result.ok) {
        const next = { report: result.report, fetchedAt: new Date().toISOString() };
        writeCache(email, next);
        setFresh(next);
      } else {
        setError(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [email, raw]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const result = await loadReport();
    if (result.ok) {
      const next = { report: result.report, fetchedAt: new Date().toISOString() };
      writeCache(email, next);
      setFresh(next);
    } else {
      setError(result.message);
    }
    setRefreshing(false);
  }

  const toolbar = (
    <Toolbar fetchedAt={cached?.fetchedAt} refreshing={refreshing} onRefresh={refresh} signOut={signOut} />
  );

  if (!cached) {
    if (error) {
      return (
        <div className="flex flex-col gap-3">
          {toolbar}
          <Alert variant="destructive">
            <AlertTitle>We could not show your report.</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <a href="/login" className={cn(buttonVariants({ variant: "link" }), "w-fit px-0")}>
            Try a different email
          </a>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <CircleDotDashed className="size-5 animate-spin" aria-hidden="true" />
          Loading report
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Refresh failed.</AlertTitle>
          <AlertDescription>{error} The last saved report is still shown.</AlertDescription>
        </Alert>
      )}
      <ReportDashboard report={cached.report} />
    </div>
  );
}

// Order: last-updated time, Refresh, Sign out.
function Toolbar({
  fetchedAt,
  refreshing,
  onRefresh,
  signOut,
}: {
  fetchedAt: string | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  signOut: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {fetchedAt && (
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          Last updated {new Date(fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? (
          <CircleDotDashed className="animate-spin" data-icon="inline-start" />
        ) : (
          <RotateCw data-icon="inline-start" />
        )}
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
      <SignOutButton action={signOut} />
    </div>
  );
}
