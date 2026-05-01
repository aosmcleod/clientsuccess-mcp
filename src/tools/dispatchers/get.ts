/**
 * get_data — Consolidated get-by-ID dispatcher.
 * Routes by data_type to handler functions.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { getClient } from '../handlers/clients';
import { getContact } from '../handlers/contacts';
import { getInteraction } from '../handlers/interactions';
import { getTask } from '../handlers/tasks';
import { getContracts } from '../handlers/financials';
import { getSuccessScore, getPulseHistory } from '../handlers/health';

export function defineGetTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    client: (args) => getClient(csClient, args),
    contact: (args) => getContact(csClient, args),
    interaction: (args) => getInteraction(csClient, args),
    task: (args) => getTask(csClient, args),
    contracts: (args) => getContracts(csClient, args),
    success_score: (args) => getSuccessScore(csClient, args),
    pulse_history: (args) => getPulseHistory(csClient, args),
  };

  const DATA_TYPES = Object.keys(handlers);

  return {
    get_data: {
      description: `Get full details for a specific entity or dataset by ID.

Data types and required params:
• client — id (numeric client ID)
• contact — clientId + contactId
• interaction — id (interaction/clientNote ID)
• task — id (task UUID)
• contracts — clientId (returns all contracts for a client), limit
• success_score — clientId (current score + latest pulse entry)
• pulse_history — clientId, limit (all pulse/health entries)`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          data_type: { type: 'string', description: 'Type of data to get', enum: DATA_TYPES },
          id: { type: 'number', description: 'Entity ID (client, interaction)' },
          clientId: { type: 'number', description: 'Client ID (contact, contracts, success_score, pulse_history)' },
          contactId: { type: 'number', description: 'Contact ID (contact only)' },
          limit: { type: 'number', description: 'Max records (contracts, pulse_history)' },
        },
        required: ['data_type'],
      },
      handler: async (args: any) => {
        const handler = handlers[args.data_type];
        if (!handler) return toolError(`Unknown data_type: "${args.data_type}". Valid: ${DATA_TYPES.join(', ')}`);
        return handler(args);
      },
    },
  };
}
