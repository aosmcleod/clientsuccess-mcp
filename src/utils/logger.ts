/**
 * Structured logger for the ClientSuccess MCP server.
 * Writes JSON to stderr (stdout is reserved for MCP protocol).
 * Level controlled by CS_LOG_LEVEL env var (debug | info | warn | error).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private level: number;

  constructor() {
    const envLevel = (process.env.CS_LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
    this.level = LEVELS[envLevel] ?? LEVELS.info;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LEVELS[level] < this.level) return;

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: message,
    };
    if (data) Object.assign(entry, data);
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  debug(msg: string, data?: Record<string, unknown>) { this.log('debug', msg, data); }
  info(msg: string, data?: Record<string, unknown>) { this.log('info', msg, data); }
  warn(msg: string, data?: Record<string, unknown>) { this.log('warn', msg, data); }
  error(msg: string, data?: Record<string, unknown>) { this.log('error', msg, data); }

  /** Log a tool invocation. */
  toolCall(name: string, args: Record<string, unknown>) {
    this.info('tool_call', { tool: name, args });
  }

  /** Log a tool result (duration + success/error). */
  toolResult(name: string, durationMs: number, isError: boolean) {
    this.info('tool_result', { tool: name, duration_ms: durationMs, error: isError });
  }

  /** Log an API request. */
  apiRequest(method: string, path: string, status: number, durationMs: number) {
    this.debug('api_request', { method, path, status, duration_ms: durationMs });
  }

  /** Log an auth event. */
  auth(event: 'login_success' | 'login_failed' | 'token_refresh' | 'token_cleared', detail?: string) {
    const lvl = event === 'login_failed' ? 'warn' : 'info';
    this.log(lvl, event, detail ? { detail } : undefined);
  }
}

export const logger = new Logger();
