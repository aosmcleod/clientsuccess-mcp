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

// Display labels. Superset of the create enum plus legacy values that older
// pulses may still return on read (the create and read enums diverge — see
// DISPOSITION_TYPES below).
export const DISPOSITION_LABELS: Record<string, string> = {
  EXTREMELY_SATISFIED: 'Extremely Satisfied',
  VERY_SATISFIED: 'Very Satisfied',
  FAIRLY_SATISFIED: 'Fairly Satisfied',
  SOME_RISK: 'Some Risk',
  HIGH_RISK: 'High Risk',
  SEVERE_RISK: 'Severe Risk',
  // Legacy / read-only labels — not valid for create.
  NEUTRAL: 'Neutral',
  FAIRLY_DISSATISFIED: 'Fairly Dissatisfied',
  VERY_DISSATISFIED: 'Very Dissatisfied',
  AT_RISK: 'At Risk',
  LOW_RISK: 'Low Risk',
  NO_SCORE: 'No Score',
};

// Valid dispositionType values accepted by POST /pulse. Confirmed against the
// live API: the create endpoint rejects any other value (including the
// read-side labels NEUTRAL/FAIRLY_DISSATISFIED/VERY_DISSATISFIED) at JSON
// deserialization with a 400 "Unable to parse request body".
export const DISPOSITION_TYPES = [
  'EXTREMELY_SATISFIED',
  'VERY_SATISFIED',
  'FAIRLY_SATISFIED',
  'SOME_RISK',
  'HIGH_RISK',
  'SEVERE_RISK',
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
