/**
 * Typed error classes for the ClientSuccess MCP.
 * Central error handling in index.ts maps these to user-friendly tool responses.
 */

/** API-level errors (HTTP failures, auth issues, rate limits). */
export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Input validation errors (missing required fields, invalid values). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that all required fields are present and non-empty.
 * Throws a ValidationError listing all missing fields.
 */
export function requireFields(
  entityType: string,
  fields: Record<string, unknown>,
  required: string[],
): void {
  const missing = required.filter(
    (key) => fields[key] === undefined || fields[key] === null || fields[key] === '',
  );
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields for ${entityType}: ${missing.join(', ')}.`,
    );
  }
}
