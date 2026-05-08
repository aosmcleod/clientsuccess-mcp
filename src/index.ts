/**
 * ClientSuccess MCP Server
 * Provides read, write, and analysis tools for the ClientSuccess platform.
 * 8 consolidated tools covering clients, contacts, health, interactions,
 * financials, tasks, and portfolio intelligence.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { CSClient } from './api/client';
import { logger } from './utils/logger';
import { toolError } from './utils/format';
import { ApiError, ValidationError } from './utils/errors';

// Tool dispatchers (8 tools)
import { defineListTool } from './tools/dispatchers/list';
import { defineGetTool } from './tools/dispatchers/get';
import { defineCreateTool } from './tools/dispatchers/create';
import { defineUpdateTool } from './tools/dispatchers/update';
import { defineDeleteTool } from './tools/dispatchers/delete';
import { defineAnalyzePortfolioTool } from './tools/dispatchers/analyze-portfolio';
import { defineAnalyzeClientTool } from './tools/dispatchers/analyze-client';
import { defineReferenceTool } from './tools/dispatchers/reference';

// ── Validate config ─────────────────────────────────────────────────────────

const config: import('./api/types').CSClientConfig = {
  username: process.env.CS_USERNAME ?? '',
  password: process.env.CS_PASSWORD ?? '',
  // Optional: segment filtering (for multi-product accounts)
  segmentField: cleanEnv(process.env.CS_SEGMENT_FIELD),
  segmentValues: parseJsonEnv(process.env.CS_SEGMENT_VALUES),
  // Optional: renewal date custom field
  renewalDateField: cleanEnv(process.env.CS_RENEWAL_DATE_FIELD),
};

/** Safely parse a JSON env var — returns undefined on empty/invalid. */
function parseJsonEnv(value: string | undefined): Record<string, string> | undefined {
  if (!value || value === 'undefined' || value.startsWith('${')) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return undefined;
  } catch {
    logger.warn('config_parse_error', { field: 'CS_SEGMENT_VALUES', value: value.substring(0, 50) });
    return undefined;
  }
}

/** Clean an env var — returns undefined if empty or an unresolved template placeholder. */
function cleanEnv(value: string | undefined): string | undefined {
  if (!value || value === 'undefined' || value.startsWith('${')) return undefined;
  return value;
}

if (!config.username || !config.password) {
  console.error('CS_USERNAME and CS_PASSWORD must be configured.');
  process.exit(1);
}

// ── Initialize ──────────────────────────────────────────────────────────────

const csClient = new CSClient(config);

const server = new McpServer({
  name: 'clientsuccess-mcp',
  version: '2.0.2',
});

// ── JSON Schema → Zod conversion (for MCP SDK) ─────────────────────────────

function jsonSchemaToZod(schema: any): Record<string, z.ZodTypeAny> | undefined {
  if (!schema?.properties) return undefined;

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
    let field: z.ZodTypeAny;

    if (prop.enum) {
      field = z.enum(prop.enum as [string, ...string[]]);
    } else {
      switch (prop.type) {
        case 'number':
          field = z.number();
          break;
        case 'boolean':
          field = z.boolean();
          break;
        case 'array':
          field = z.array(z.any());
          break;
        case 'object':
          field = z.any();
          break;
        case 'string':
        default:
          field = z.string();
          break;
      }
    }

    if (prop.description) field = field.describe(prop.description);
    if (!required.has(key)) field = field.optional();

    shape[key] = field;
  }

  return shape;
}

// ── Register tools ──────────────────────────────────────────────────────────

function registerTools() {
  const toolSets = [
    // Read (3 tools)
    defineListTool(csClient),
    defineGetTool(csClient),
    defineReferenceTool(csClient),
    // Write (2 tools)
    defineCreateTool(csClient),
    defineUpdateTool(csClient),
    // Destructive (1 tool)
    defineDeleteTool(csClient),
    // Analysis (2 tools)
    defineAnalyzePortfolioTool(csClient),
    defineAnalyzeClientTool(csClient),
  ];

  let toolCount = 0;

  for (const toolSet of toolSets) {
    for (const [name, def] of Object.entries(toolSet)) {
      const { description, inputSchema, handler, mode } = def as any;
      toolCount++;

      const zodSchema = jsonSchemaToZod(inputSchema);

      // Tool annotations
      const isWrite = mode === 'write';
      const isDestructive = mode === 'destructive';
      const annotations = isWrite || isDestructive
        ? { readOnlyHint: false, destructiveHint: isDestructive, openWorldHint: true }
        : { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

      if (zodSchema) {
        (server as any).tool(name, description, zodSchema, annotations, async (args: any) => {
          const start = Date.now();
          logger.toolCall(name, args);
          try {
            const result = await handler(args);
            logger.toolResult(name, Date.now() - start, false);
            return result;
          } catch (err: any) {
            logger.toolResult(name, Date.now() - start, true);
            logger.error('tool_error', { tool: name, code: err.code, message: err.message });

            if (err instanceof ValidationError) return toolError(err.message);
            if (err instanceof ApiError) {
              if (err.code === 'auth_failed') return toolError(err.message);
              if (err.code === 'rate_limited') return toolError(err.message);
              if (err.code === 'timeout') return toolError(err.message);
              return toolError(err.message);
            }
            return toolError(`Something went wrong: ${err.message?.substring(0, 200) ?? 'Unknown error'}`);
          }
        });
      }
    }
  }

  logger.info('tools_registered', { count: toolCount });
}

registerTools();

// ── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('server_connected');

  // Warm the client list cache in the background
  csClient.getV1('/clients').catch((e: Error) =>
    logger.warn('cache_warm_failed', { error: e.message }),
  );
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
