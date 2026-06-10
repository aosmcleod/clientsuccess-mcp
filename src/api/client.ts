/**
 * CSClient — Single class encapsulating all ClientSuccess API interaction.
 *
 * Handles:
 *   - Authentication (username/password → token, auto-refresh)
 *   - Request timeouts (30s per request)
 *   - Retry with backoff (401 re-auth, 429 rate limit, 5xx)
 *   - Response caching (LRU, 10 min TTL)
 *   - v1 and v2 API routing
 *   - Paginated v2 fetching
 *   - Configurable segment-based client filtering
 *   - Client normalisation (v2 → shared shape)
 *
 * Auth notes (confirmed via live testing):
 *   - Endpoint: POST /v1/auth with { username, password }
 *   - Response: { access_token, token_type, expires_in: 43200 }
 *   - Authorization header: bare token — NO "Bearer" prefix (causes 401)
 */

import type { CSClientConfig, V2PaginatedResponse, V2TaskResponse, V2RawClient, NormalisedClient, SegmentFilter } from './types';
import { ResponseCache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { V2_STATUS_MAP } from '../utils/constants';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

const CACHEABLE_V1_PATHS = new Set([
  '/clients',
  '/employees',
  '/client-statuses',
  '/client-segments',
  '/products',
]);

export class CSClient {
  private v1Base: string;
  private v2Base: string;
  private username: string;
  private password: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private cache = new ResponseCache(200, 10 * 60 * 1000);

  /** Configurable segment field for client filtering. */
  readonly segmentField: string | undefined;
  readonly segmentValues: Record<string, string> | undefined;
  readonly renewalDateField: string | undefined;

  constructor(config: CSClientConfig) {
    this.username = config.username;
    this.password = config.password;
    this.v1Base = config.v1Base ?? 'https://api.clientsuccess.com/v1';
    this.v2Base = config.v2Base ?? 'https://api.clientsuccess.com/v2';
    this.segmentField = config.segmentField;
    this.segmentValues = config.segmentValues;
    this.renewalDateField = config.renewalDateField;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async login(): Promise<string> {
    if (!this.username || !this.password) {
      throw new ApiError(
        'auth_failed',
        'CS_USERNAME and CS_PASSWORD must be configured in the MCP settings.',
        401,
      );
    }

    const start = Date.now();
    const res = await fetchWithTimeout(`${this.v1Base}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    }, DEFAULT_TIMEOUT_MS);

    const elapsed = Date.now() - start;
    logger.apiRequest('POST', '/v1/auth', res.status, elapsed);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.auth('login_failed', `${res.status}: ${text}`);
      throw new ApiError('auth_failed', `Login failed (${res.status}): ${text}`, res.status);
    }

    const data = await res.json() as Record<string, any>;
    const token = data.access_token ?? data.token ?? data.accessToken;
    const expiresIn = data.expires_in ?? 43200;

    if (!token) {
      logger.auth('login_failed', 'No token in response');
      throw new ApiError('auth_failed', 'Login response missing access_token.', 401);
    }

    this.token = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    logger.auth('login_success', `expires in ${Math.round(expiresIn / 3600)}h`);
    return token;
  }

  /**
   * Verify credentials at startup. Returns null on success, or a human-readable
   * error message on failure. Reuses the obtained token for subsequent requests.
   */
  async verifyAuth(): Promise<string | null> {
    try {
      await this.login();
      return null;
    } catch (e: any) {
      return e?.message ?? 'Unknown authentication error';
    }
  }

  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
      return this.token;
    }
    if (this.token) logger.auth('token_refresh');
    return this.login();
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: token,
      'Content-Type': 'application/json',
    };
  }

  // ── Core request ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const headers = await this.getHeaders();
    const opts: RequestInit = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    opts.signal = controller.signal;

    const start = Date.now();
    let res: Response;

    try {
      res = await fetch(url, opts);
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
          logger.warn('api_timeout_retry', { method, url, attempt, delay_ms: delay });
          await sleep(delay);
          return this.request<T>(method, url, body, attempt + 1);
        }
        throw new ApiError('timeout', `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s: ${method} ${url}`, 408);
      }
      // Connection-level failures (ECONNRESET, socket hang up, fetch failed) —
      // often seen when a ClientSuccess backend is cycling during maintenance.
      // Retry with backoff, then surface a clean, actionable message.
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        logger.warn('api_connection_retry', { method, url, attempt, delay_ms: delay, error: e?.code ?? e?.message });
        await sleep(delay);
        return this.request<T>(method, url, body, attempt + 1);
      }
      throw new ApiError(
        'unavailable',
        'Unable to reach ClientSuccess (connection reset). The service may be undergoing maintenance — please retry in a few minutes.',
        503,
      );
    }
    clearTimeout(timer);

    const elapsed = Date.now() - start;
    const path = url.replace(this.v1Base, '').replace(this.v2Base, '');
    logger.apiRequest(method, path, res.status, elapsed);

    if (res.status === 401 && attempt === 1) {
      logger.warn('auth_expired, retrying');
      this.token = null;
      return this.request<T>(method, url, body, attempt + 1);
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn('api_retry', { method, path, status: res.status, attempt, delay_ms: delay });
      await sleep(delay);
      return this.request<T>(method, url, body, attempt + 1);
    }

    if (res.status === 429) {
      throw new ApiError('rate_limited', 'ClientSuccess is temporarily limiting requests. Try again shortly.', 429);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // ClientSuccess serves a static HTML "System Maintenance" page (not a JSON
      // error) when a backend service is down for maintenance/upgrade. Detect it
      // and return a clear message instead of leaking the HTML app-shell.
      const looksHtml = (res.headers.get('content-type') ?? '').includes('html') || text.trimStart().startsWith('<');
      if (looksHtml || text.includes('System Maintenance')) {
        throw new ApiError(
          'unavailable',
          `ClientSuccess is temporarily unavailable for ${method} ${path} (system maintenance in progress on this endpoint). Please retry in a few minutes.`,
          503,
        );
      }
      throw new ApiError('api_error', `API ${res.status} ${method} ${path}: ${text.substring(0, 200)}`, res.status);
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null as T;
    return res.json() as T;
  }

  // ── v1 API ────────────────────────────────────────────────────────────────

  async getV1<T = any>(path: string): Promise<T> {
    if (CACHEABLE_V1_PATHS.has(path)) {
      const cached = this.cache.get<T>(`v1:${path}`);
      if (cached !== undefined) return cached;
      const data = await this.request<T>('GET', `${this.v1Base}${path}`);
      this.cache.set(`v1:${path}`, data);
      return data;
    }
    return this.request<T>('GET', `${this.v1Base}${path}`);
  }

  async postV1<T = any>(path: string, body: unknown): Promise<T> {
    this.cache.delete(`v1:${path.split('/').slice(0, 2).join('/')}`);
    return this.request<T>('POST', `${this.v1Base}${path}`, body);
  }

  async putV1<T = any>(path: string, body: unknown): Promise<T> {
    this.cache.delete('v1:/clients');
    return this.request<T>('PUT', `${this.v1Base}${path}`, body);
  }

  // ── v2 API ────────────────────────────────────────────────────────────────

  async getV2<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', `${this.v2Base}${path}`);
  }

  async postV2<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', `${this.v2Base}${path}`, body);
  }

  async putV2<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', `${this.v2Base}${path}`, body);
  }

  async patchV2<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', `${this.v2Base}${path}`, body);
  }

  async deleteV2(path: string): Promise<void> {
    await this.request<unknown>('DELETE', `${this.v2Base}${path}`);
  }

  // ── Paginated v2 fetch ────────────────────────────────────────────────────

  async fetchAllV2<T = any>(basePath: string, pageSize = 200, maxPages = 20): Promise<T[]> {
    const cacheKey = `v2-all:${basePath}:${pageSize}`;
    const cached = this.cache.get<T[]>(cacheKey);
    if (cached !== undefined) return cached;

    const sep = basePath.includes('?') ? '&' : '?';
    let page = 0;
    let all: T[] = [];

    while (page < maxPages) {
      const result = await this.getV2<V2PaginatedResponse<T>>(
        `${basePath}${sep}page=${page}&size=${pageSize}`,
      );
      const items = result?.data ?? [];
      all = all.concat(items);
      if (result?.last || items.length < pageSize) break;
      page++;
    }

    this.cache.set(cacheKey, all);
    return all;
  }

  async fetchAllV2Tasks(
    filterBy: Record<string, any> = {},
    sortBy: Array<{ key: string; value: string }> = [],
    pageSize = 200,
    maxPages = 50,
  ): Promise<any[]> {
    let page = 0;
    let all: any[] = [];

    while (page < maxPages) {
      const body: any = { filterBy, pagination: { taskPage: page, taskSize: pageSize } };
      if (sortBy.length) body.sortBy = sortBy;
      const result = await this.postV2<V2TaskResponse>('/task/all', body);
      const items = result?.content ?? [];
      all = all.concat(items);
      if (result?.last || items.length < pageSize) break;
      page++;
    }

    return all;
  }

  // ── Client helpers (business-level) ───────────────────────────────────────

  /**
   * Get all clients, optionally filtered by segment.
   * When a segment filter is provided and segmentField is configured, uses v2 (slower but has custom fields).
   * Otherwise uses v1 (fast, single call).
   */
  async getAllClients(segment?: SegmentFilter): Promise<NormalisedClient[]> {
    if (segment && segment !== 'ALL' && this.segmentField && this.segmentValues) {
      const raw = await this.fetchAllV2<V2RawClient>('/client/search');
      const filtered = this.filterBySegment(raw, segment);
      return filtered.map(c => this.normalizeV2Client(c));
    }
    // v1 fast path
    const data = await this.getV1<any>('/clients');
    const clients = Array.isArray(data) ? data : (data?.clients ?? data?.data ?? []);
    return clients;
  }

  /**
   * Filter v2 clients by configured segment field.
   * Returns all clients if no segment config exists.
   */
  filterBySegment(clients: V2RawClient[], segment: SegmentFilter): V2RawClient[] {
    if (!segment || segment === 'ALL') return clients;
    if (!this.segmentField || !this.segmentValues) return clients;

    const targetValue = this.segmentValues[segment];
    if (targetValue === undefined) return clients; // unknown segment key

    // Empty string means "field is null, empty, or missing"
    if (targetValue === '') {
      return clients.filter(c =>
        !c.custom?.[this.segmentField!] || c.custom[this.segmentField!] === '' || c.custom[this.segmentField!] === '__empty__',
      );
    }

    return clients.filter(c => c.custom?.[this.segmentField!] === targetValue);
  }

  /** Normalise a v2 client to the shared shape. */
  normalizeV2Client(c: V2RawClient): NormalisedClient {
    // Determine segment label from configured field
    let segmentLabel: string | null = null;
    if (this.segmentField && this.segmentValues) {
      const fieldValue = c.custom?.[this.segmentField] ?? '';
      for (const [label, value] of Object.entries(this.segmentValues)) {
        if (value === '' && (!fieldValue || fieldValue === '' || fieldValue === '__empty__')) {
          segmentLabel = label;
          break;
        }
        if (fieldValue === value) {
          segmentLabel = label;
          break;
        }
      }
    }

    return {
      id: c.id,
      name: c.name,
      statusCode: V2_STATUS_MAP[c.status] ?? c.status,
      successScore: c.successScore ?? null,
      segment: typeof c.segment === 'object' ? c.segment?.title ?? null : (c.segment as string | null) ?? null,
      clientSegmentId: typeof c.segment === 'object' ? c.segment?.id ?? null : null,
      managedByEmployeeId: c.managedByEmployee?.id ?? null,
      assignedCSM: c.managedByEmployee?.name ?? null,
      lastTouchDateTime: c.lastTouchDateTime ?? null,
      lastTouchType: c.lastTouchType ?? null,
      externalId: c.externalId ?? null,
      segmentLabel,
    };
  }

  /** Get configured segment keys (for tool descriptions). */
  getSegmentKeys(): string[] {
    if (!this.segmentValues) return [];
    return Object.keys(this.segmentValues);
  }

  /** Check if segment filtering is configured. */
  hasSegmentConfig(): boolean {
    return !!(this.segmentField && this.segmentValues && Object.keys(this.segmentValues).length > 0);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
