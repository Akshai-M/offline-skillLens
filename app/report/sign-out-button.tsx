"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearReportCaches } from "./report-cache";

export function SignOutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={() => clearReportCaches()}>
      <Button type="submit" variant="outline" size="sm">
        <LogOut data-icon="inline-start" />
        Sign out
      </Button>
    </form>
  );
}
