/**
 * Core types for the ClientSuccess MCP server.
 */

// ── API response shapes ─────────────────────────────────────────────────────

/** v2 paginated response envelope. */
export interface V2PaginatedResponse<T = any> {
  data: T[];
  first: boolean;
  last: boolean;
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

/** v2 task search response (uses different field names). */
export interface V2TaskResponse {
  content: any[];
  first: boolean;
  last: boolean;
  totalPages: number;
  totalElements: number;
}

/** Raw v2 client record (from /client/search). */
export interface V2RawClient {
  id: number;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'TERMINATED';
  successScore: number | null;
  segment?: { id: number; title: string } | string | null;
  managedByEmployee?: { id: number; name: string } | null;
  lastTouchDateTime?: string | null;
  lastTouchType?: string | null;
  externalId?: string | null;
  custom?: Record<string, any>;
}

/** Normalised client record (shared shape between v1 and v2). */
export interface NormalisedClient {
  id: number;
  name: string;
  statusCode: string;
  successScore: number | null;
  segment: string | null;
  clientSegmentId: number | null;
  managedByEmployeeId: number | null;
  assignedCSM: string | null;
  lastTouchDateTime: string | null;
  lastTouchType: string | null;
  externalId: string | null;
  segmentLabel: string | null; // value from the configured segment field
}

// ── Tool result types ───────────────────────────────────────────────────────

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface CSClientConfig {
  username: string;
  password: string;
  v1Base?: string;
  v2Base?: string;

  /**
   * Optional: custom field key used to segment clients into groups/products.
   * When set, the `segment_filter` parameter becomes available on list/analysis tools.
   * Example: "system__cs" (Function Software uses this to separate FP and FF clients)
   */
  segmentField?: string;

  /**
   * Optional: mapping of friendly segment names to their custom field values.
   * Used with segmentField to filter clients by group.
   * Example: { "FP": "", "FF": "functionfox" }
   * Empty string means "field is null or empty".
   */
  segmentValues?: Record<string, string>;

  /**
   * Optional: custom field key that holds the renewal/contract end date.
   * Used by the renewals handler to find upcoming renewals.
   * Example: "Next_Renewal_Date__cs"
   */
  renewalDateField?: string;
}

// ── Segment filter ──────────────────────────────────────────────────────────

/** Segment filter value — matches a key from segmentValues config, or 'ALL'. */
export type SegmentFilter = string;
