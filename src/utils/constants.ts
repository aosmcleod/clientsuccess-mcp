/**
 * Shared constants for the ClientSuccess MCP.
 * Single source of truth for lookup tables and labels.
 * NOTE: Company-specific configuration (segment fields, email domains)
 * is handled via CSClientConfig — not hard-coded here.
 */

// ── Status codes ────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  A: 'Active',
  I: 'Inactive',
  F: 'Trial',
  T: 'Terminated',
};

export const V2_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'A',
  INACTIVE: 'I',
  TRIAL: 'F',
  TERMINATED: 'T',
};

export const STATUS_CODE_TO_V2: Record<string, string> = {
  A: 'ACTIVE',
  I: 'INACTIVE',
  F: 'TRIAL',
  T: 'TERMINATED',
};

// ── Pulse / disposition ─────────────────────────────────────────────────────

export const DISPOSITION_LABELS: Record<string, string> = {
  VERY_SATISFIED: 'Very Satisfied',
  FAIRLY_SATISFIED: 'Fairly Satisfied',
  NEUTRAL: 'Neutral',
  FAIRLY_DISSATISFIED: 'Fairly Dissatisfied',
  VERY_DISSATISFIED: 'Very Dissatisfied',
  HIGH_RISK: 'High Risk',
  AT_RISK: 'At Risk',
  LOW_RISK: 'Low Risk',
  NO_SCORE: 'No Score',
};

export const DISPOSITION_TYPES = [
  'VERY_SATISFIED',
  'FAIRLY_SATISFIED',
  'NEUTRAL',
  'FAIRLY_DISSATISFIED',
  'VERY_DISSATISFIED',
] as const;

// ── Interaction types ───────────────────────────────────────────────────────

export const INTERACTION_TYPE_NAMES: Record<number, string> = {
  1: 'Note',
  2: 'Call',
  3: 'Meeting',
  4: 'Email',
  5: 'QBR',
  6: 'Chat',
  7: 'Support Ticket',
  8: 'Other',
};

export const INTERACTION_TYPE_IDS: Record<string, number> = {
  NOTE: 1,
  CALL: 2,
  MEETING: 3,
  EMAIL: 4,
  QBR: 5,
  CHAT: 6,
  SUPPORT_TICKET: 7,
  OTHER: 8,
};

export const INTERACTION_TYPES = [
  'NOTE', 'CALL', 'MEETING', 'EMAIL', 'QBR', 'CHAT', 'SUPPORT_TICKET', 'OTHER',
] as const;

// ── SuccessScore bands ──────────────────────────────────────────────────────

export const SCORE_BANDS = {
  GREEN_MIN: 67,
  YELLOW_MIN: 34,
} as const;

// ── Task affiliation types ──────────────────────────────────────────────────

export const TASK_AFFILIATIONS = [
  'ALL_OPEN_TASKS',
  'ALL_COMPLETED_TASKS',
  'ALL_TASKS',
  'MY_OPEN_TASKS',
  'MY_COMPLETED_TASKS',
  'MY_TASKS',
  'OVERDUE',
  'TODAY',
  'THIS_WEEK',
  'NEXT_WEEK',
  'THIS_MONTH',
  'NO_DUE_DATE',
] as const;
