/**
 * Response formatting utilities.
 * Standardises all tool responses and provides shared formatting helpers.
 */

import type { ToolResult, NormalisedClient } from '../api/types';
import { STATUS_LABELS, DISPOSITION_LABELS, SCORE_BANDS } from './constants';

// ── Tool response wrappers ──────────────────────────────────────────────────

/** Wrap data as a successful MCP tool result. */
export function toolResult(data: any): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap an error message as an MCP tool error result. */
export function toolError(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ── Label formatters ────────────────────────────────────────────────────────

/** "A" → "Active". Falls back to raw code. */
export function statusLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return STATUS_LABELS[code] ?? code;
}

/** "FAIRLY_SATISFIED" → "Fairly Satisfied". Falls back to raw value. */
export function dispositionLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return DISPOSITION_LABELS[type] ?? type;
}

/** SuccessScore → "Green" | "Yellow" | "Red" | "Unknown" */
export function bandLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Unknown';
  if (score >= SCORE_BANDS.GREEN_MIN) return 'Green';
  if (score >= SCORE_BANDS.YELLOW_MIN) return 'Yellow';
  return 'Red';
}

// ── Date/time helpers ───────────────────────────────────────────────────────

/** ISO date string → integer days since that date, or null. */
export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

/** Days until a future date, or null. */
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

/** Today as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Client row formatter ────────────────────────────────────────────────────

/** Compact client row for list/table rendering. */
export function clientRow(c: NormalisedClient) {
  return {
    id: c.id,
    name: c.name,
    status: statusLabel(c.statusCode),
    successScore: c.successScore ?? null,
    band: bandLabel(c.successScore),
    segment: c.segment ?? null,
    clientSegmentId: c.clientSegmentId ?? null,
    assignedCSM: c.assignedCSM ?? null,
    managedByEmployeeId: c.managedByEmployeeId ?? null,
    daysSinceLastTouch: daysSince(c.lastTouchDateTime),
    externalId: c.externalId ?? null,
    ...(c.segmentLabel && { segmentLabel: c.segmentLabel }),
  };
}

/** Concise client row — fewer fields for token savings. */
export function clientRowConcise(c: NormalisedClient) {
  return {
    id: c.id,
    name: c.name,
    status: statusLabel(c.statusCode),
    successScore: c.successScore ?? null,
    band: bandLabel(c.successScore),
    assignedCSM: c.assignedCSM ?? null,
    ...(c.segmentLabel && { segmentLabel: c.segmentLabel }),
  };
}

// ── HTML stripping ──────────────────────────────────────────────────────────

/** Strip HTML tags from note content, returning plain text. */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html || typeof html !== 'string') return null;
  return html
    // Remove style blocks entirely
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove script blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove HTML comments (including CSS wrapped in <!-- -->)
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

// ── Percentage helper ───────────────────────────────────────────────────────

export function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}
