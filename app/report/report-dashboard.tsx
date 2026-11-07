"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Compass,
  Search,
  Target,
  TrendingUp,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Report } from "@/lib/feedback";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";
type Filter = "all" | Priority;

type WeakArea = Report["weak_areas"][number];
type ActionItem = Report["action_items"][number];
type PlanRequest = { index: number; nonce: number };

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const SEVERITY: Record<Priority, { label: string; footer: string; text: string; card: string }> = {
  high: {
    label: "High severity",
    footer: "Immediate score blocker",
    text: "text-rose-600",
    card: "border-rose-200 bg-rose-50/50",
  },
  medium: {
    label: "Medium priority",
    footer: "Core concept review",
    text: "text-amber-700",
    card: "border-amber-200 bg-amber-50/50",
  },
  low: {
    label: "Refinement",
    footer: "Polishing topic",
    text: "text-slate-600",
    card: "border-slate-200 bg-slate-50",
  },
};

const IMPACT: Record<Priority, { label: string; text: string }> = {
  high: { label: "High impact", text: "text-rose-600" },
  medium: { label: "Medium impact", text: "text-amber-700" },
  low: { label: "Low impact", text: "text-slate-500" },
};

const TASKS_KEY_PREFIX = "report-tasks:";
const TASKS_EVENT = "report-tasks-changed";

// Per-viewer task progress. It lives in this browser only and never reaches the server.
// The in-memory copy keeps checkboxes working when storage is blocked (private mode).
const taskCache = new Map<string, string>();

function readTasks(key: string): string {
  const cached = taskCache.get(key);
  if (cached !== undefined) return cached;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(key);
  } catch {
    stored = null;
  }
  const value = stored ?? "[]";
  taskCache.set(key, value);
  return value;
}

function writeTasks(key: string, value: string) {
  taskCache.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: progress lasts for this page visit only.
  }
  window.dispatchEvent(new Event(TASKS_EVENT));
}

function subscribeTasks(onChange: () => void) {
  window.addEventListener(TASKS_EVENT, onChange);
  return () => window.removeEventListener(TASKS_EVENT, onChange);
}

function parseTasks(json: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(json);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// Weak areas and action items use slightly different topic names (e.g. "Graph traversal and connectivity"
// vs "Graph traversal"), so match on containment and fall back to position.
function findActionIndex(topic: string, actions: ActionItem[], fallback: number): number {
  const wanted = topic.toLowerCase();
  const exact = actions.findIndex((a) => a.topic.toLowerCase() === wanted);
  if (exact !== -1) return exact;
  const loose = actions.findIndex((a) => {
    const candidate = a.topic.toLowerCase();
    return wanted.includes(candidate) || candidate.includes(wanted);
  });
  return loose !== -1 ? loose : fallback;
}

export function ReportDashboard({ report }: { report: Report }) {
  const [actionFilter, setActionFilter] = useState<Filter>("all");
  const [planRequest, setPlanRequest] = useState<PlanRequest | null>(null);

  const weakAreas = useMemo(
    () => [...report.weak_areas].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [report.weak_areas],
  );
  const actions = report.action_items;

  const counts = useMemo(() => {
    const byPriority = { high: 0, medium: 0, low: 0 };
    for (const area of report.weak_areas) byPriority[area.priority]++;
    return byPriority;
  }, [report.weak_areas]);

  const { coding, mcq } = report.sections;
  const codingShort = Math.max(coding.cutoff - coding.score, 0);
  const mcqShort = Math.max(mcq.cutoff - mcq.score, 0);

  function openActionPlan(index: number) {
    // Show every action so the target is on screen, then ActionsSection scrolls to it.
    setActionFilter("all");
    setPlanRequest((previous) => ({ index, nonce: (previous?.nonce ?? 0) + 1 }));
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Offline Competency Assessment Report</p>
              <p className="mt-2 text-base">
                <span className="text-muted-foreground">Name: </span>
                <span className="font-semibold">{report.candidate}</span>
              </p>
              <p className="mt-1 break-all text-base">
                <span className="text-muted-foreground">Email: </span>
                <span className="font-semibold">{report.email}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "h-8 gap-1.5 px-3 text-sm font-semibold",
                  report.cleared
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                <TriangleAlert className="size-4" />
                {report.cleared ? "Cleared" : "Not cleared"}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Compass className="size-4 text-indigo-600" />
              Assessment summary
            </p>
            <p className="mt-2 text-sm leading-7 text-foreground/90 sm:text-base">{report.summary}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Coding score"
              aside={`${percent(coding.score, coding.max)}%`}
              value={`${coding.score}/${coding.max}`}
              progress={percent(coding.score, coding.max)}
              footnote={`Score: ${coding.score} of ${coding.max}`}
            />
            <StatCard
              label="MCQ score"
              aside={`${percent(mcq.score, mcq.max)}%`}
              value={`${mcq.score}/${mcq.max}`}
              progress={percent(mcq.score, mcq.max)}
              footnote={`Score: ${mcq.score} of ${mcq.max}`}
            />
            <StatCard
              label="Required cutoff"
              aside={<Target className="size-4" />}
              value={`${coding.cutoff} / ${mcq.cutoff}`}
              valueUnit="pts"
              progress={100}
              indicatorClassName="[&_[data-slot=progress-indicator]]:bg-slate-400"
              footnote="Coding / MCQ qualifying benchmark"
            />
            <StatCard
              label="Cutoff margin"
              aside={<TrendingUp className="size-4" />}
              warn
              value={`−${codingShort} / −${mcqShort}`}
              valueUnit="pts"
              progress={percent(coding.score, coding.cutoff)}
              indicatorClassName="[&_[data-slot=progress-indicator]]:bg-amber-500"
              footnote={
                report.cleared
                  ? "Both sections meet their cutoffs"
                  : `${codingShort} coding and ${mcqShort} MCQ points needed to clear`
              }
            />
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Diagnosed areas: <strong className="text-foreground">{report.weak_areas.length}</strong>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                High priority: <strong className="text-rose-600">{counts.high}</strong>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                Medium priority: <strong className="text-amber-700">{counts.medium}</strong>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>
                Low priority: <strong className="text-foreground">{counts.low}</strong>
              </span>
            </p>
            <p>
              Prescribed actions: <strong className="text-foreground">{actions.length} tasks</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <GapsSection weakAreas={weakAreas} actions={actions} counts={counts} onOpenPlan={openActionPlan} />

      <ActionsSection
        email={report.email}
        actions={actions}
        filter={actionFilter}
        onFilterChange={setActionFilter}
        planRequest={planRequest}
      />
    </div>
  );
}

function StatCard({
  label,
  aside,
  value,
  valueUnit,
  progress,
  indicatorClassName = "[&_[data-slot=progress-indicator]]:bg-indigo-600",
  footnote,
  warn = false,
}: {
  label: string;
  aside: ReactNode;
  value: string;
  valueUnit?: string;
  progress: number;
  indicatorClassName?: string;
  footnote: string;
  warn?: boolean;
}) {
  return (
    <Card className={cn("gap-3 p-4", warn && "border-amber-200 bg-amber-50/50")}>
      <div className="flex items-center justify-between text-sm">
        <span className={warn ? "text-amber-700" : "text-muted-foreground"}>{label}</span>
        <span className={warn ? "text-amber-600" : "text-muted-foreground"}>{aside}</span>
      </div>
      <p className={cn("font-mono text-2xl font-bold", warn ? "text-amber-800" : "text-foreground")}>
        {value}
        {valueUnit && <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">{valueUnit}</span>}
      </p>
      <Progress
        value={Math.min(progress, 100)}
        className={cn("gap-0 [&_[data-slot=progress-track]]:h-1.5", indicatorClassName)}
      />
      <p className="text-xs text-muted-foreground">{footnote}</p>
    </Card>
  );
}

// Tabs are controlled, so the filter lives in the parent and survives re-renders.
function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)} className="w-full min-w-0 sm:w-auto">
      <TabsList
        aria-label={label}
        className="group-data-horizontal/tabs:h-auto h-auto w-full max-w-full justify-start gap-1 overflow-x-auto [scrollbar-width:none] sm:w-auto sm:flex-wrap"
      >
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className="h-8 shrink-0 px-3">
            {option.label} ({option.count})
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function GapsSection({
  weakAreas,
  actions,
  counts,
  onOpenPlan,
}: {
  weakAreas: WeakArea[];
  actions: ActionItem[];
  counts: Record<Priority, number>;
  onOpenPlan: (index: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = weakAreas
    .map((area, position) => ({ area, rank: position + 1 }))
    .filter(({ area }) => {
      if (filter !== "all" && area.priority !== filter) return false;
      if (!needle) return true;
      return area.topic.toLowerCase().includes(needle) || area.detail.toLowerCase().includes(needle);
    });

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All gaps", count: weakAreas.length },
    { value: "high", label: "High", count: counts.high },
    { value: "medium", label: "Medium", count: counts.medium },
    { value: "low", label: "Low", count: counts.low },
  ];

  return (
    <Card>
      <CardHeader className="gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Section 01 · Diagnostic breakdown</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg sm:text-xl">
              <TriangleAlert className="size-5 text-amber-500" />
              Identified knowledge and implementation gaps
            </CardTitle>
            <CardDescription className="mt-1">
              {weakAreas.length} specific concept areas observed during coding and MCQ evaluation.
            </CardDescription>
          </div>
          <FilterTabs options={tabs} value={filter} onChange={setFilter} label="Filter gaps by priority" />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search gaps (e.g. dynamic programming, bit manipulation, euler)…"
            aria-label="Search gaps"
            className="h-10 pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {visible.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No gaps match this filter.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {visible.map(({ area, rank }) => (
              <GapCard
                key={area.topic}
                area={area}
                rank={rank}
                actionIndex={findActionIndex(area.topic, actions, rank - 1)}
                onOpenPlan={onOpenPlan}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapCard({
  area,
  rank,
  actionIndex,
  onOpenPlan,
}: {
  area: WeakArea;
  rank: number;
  actionIndex: number;
  onOpenPlan: (index: number) => void;
}) {
  const severity = SEVERITY[area.priority];
  return (
    <Card className={cn("gap-3 p-4 sm:p-5", severity.card)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", severity.text)}>
          <span className="inline-block size-2 rounded-sm bg-current" />
          {severity.label}
        </p>
        <span className="text-xs text-muted-foreground">#{rank}</span>
      </div>
      <h3 className="text-base font-semibold sm:text-lg">{area.topic}</h3>
      <p className="flex-1 text-sm leading-6 text-muted-foreground">{area.detail}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3 text-sm">
        <span className="min-w-0 text-muted-foreground">{severity.footer}</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 px-0 whitespace-nowrap"
          onClick={() => onOpenPlan(actionIndex)}
        >
          View action plan
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </div>
    </Card>
  );
}

function ActionsSection({
  email,
  actions,
  filter,
  onFilterChange,
  planRequest,
}: {
  email: string;
  actions: ActionItem[];
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  planRequest: PlanRequest | null;
}) {
  const storageKey = `${TASKS_KEY_PREFIX}${email}`;
  // Server render and first client render both use "[]", so there is no hydration mismatch.
  const savedJson = useSyncExternalStore(
    subscribeTasks,
    () => readTasks(storageKey),
    () => "[]",
  );
  const done = useMemo(() => parseTasks(savedJson), [savedJson]);

  // Scroll to the requested plan. The filter is already reset to "all" by the click handler.
  useEffect(() => {
    if (!planRequest) return;
    const target = document.getElementById(`action-${planRequest.index}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [planRequest]);

  const counts = useMemo(() => {
    const byPriority = { high: 0, medium: 0, low: 0 };
    for (const item of actions) byPriority[item.priority]++;
    return byPriority;
  }, [actions]);

  const visible = actions
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => filter === "all" || item.priority === filter);

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All items", count: actions.length },
    { value: "high", label: "High", count: counts.high },
    { value: "medium", label: "Medium", count: counts.medium },
    { value: "low", label: "Low", count: counts.low },
  ];

  const completed = actions.filter((item) => done.has(item.topic)).length;
  const completedPercent = percent(completed, actions.length);

  function toggle(topic: string) {
    const next = new Set(done);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    writeTasks(storageKey, JSON.stringify([...next]));
  }

  return (
    <Card>
      <CardHeader className="gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Section 02 · Prescriptive remediation</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg sm:text-xl">
              <Zap className="size-5 text-indigo-600" />
              Prescribed action items
            </CardTitle>
            <CardDescription className="mt-1">
              Targeted remediation tasks generated from the assessment.
            </CardDescription>
          </div>

          <Card className="w-full gap-3 p-4 md:w-80">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">Tasks completed</span>
              <span className="font-mono font-semibold whitespace-nowrap text-indigo-700">
                {completed} / {actions.length} ({completedPercent}%)
              </span>
            </div>
            <Progress
              value={completedPercent}
              className="gap-0 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-indigo-600"
            />
          </Card>
        </div>

        <FilterTabs options={tabs} value={filter} onChange={onFilterChange} label="Filter action items by priority" />
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <ul className="flex flex-col gap-3">
          {visible.map(({ item, index }) => {
            const isDone = done.has(item.topic);
            const impact = IMPACT[item.priority];
            const inputId = `task-${index}`;
            return (
              <li
                key={item.topic}
                id={`action-${index}`}
                className={cn(
                  "scroll-mt-6 rounded-xl border p-4 transition-colors sm:p-5",
                  isDone ? "border-emerald-200 bg-emerald-50/50" : "bg-card",
                )}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <Checkbox id={inputId} checked={isDone} onCheckedChange={() => toggle(item.topic)} className="mt-0.5" />
                  <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cn("font-semibold", isDone && "text-muted-foreground line-through")}>
                        {item.topic}
                      </span>
                      <span className={cn("text-xs font-semibold uppercase tracking-wider", impact.text)}>
                        · {impact.label}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-sm leading-6",
                        isDone ? "text-muted-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {item.action}
                    </span>
                  </label>
                  {isDone && <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" />}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
