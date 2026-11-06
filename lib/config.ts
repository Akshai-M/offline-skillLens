// Section-wise cutoffs. A student clears only if every section meets its cutoff.
export const CUTOFFS = {
  coding: 50,
  mcq: 5,
} as const;

export const SESSION_COOKIE = "report_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
