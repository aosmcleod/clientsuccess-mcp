/**
 * analyze_client — Client-level analysis dispatcher.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { client360 } from '../handlers/analysis/client-360';

export function defineAnalyzeClientTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    full_360: (args) => client360(csClient, args),
  };

  const ANALYSIS_TYPES = Object.keys(handlers);

  return {
    analyze_client: {
      description: `Run client-level analysis for a single client.

Analysis types:
• full_360 — Complete 360° view: profile + contacts + last 10 interactions + contracts (ARR/MRR) + pulse history. Ideal for QBR prep, escalation triage, account reviews.

Requires clientId.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          analysis: { type: 'string', description: 'Type of client analysis', enum: ANALYSIS_TYPES },
          clientId: { type: 'number', description: 'Client ID (required)' },
        },
        required: ['analysis', 'clientId'],
      },
      handler: async (args: any) => {
        const handler = handlers[args.analysis];
        if (!handler) return toolError(`Unknown analysis: "${args.analysis}". Valid: ${ANALYSIS_TYPES.join(', ')}`);
        return handler(args);
      },
    },
  };
}
