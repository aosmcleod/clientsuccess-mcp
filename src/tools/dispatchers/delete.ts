/**
 * delete_data — Consolidated delete dispatcher.
 * Currently only supports interaction deletion.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { deleteInteraction } from '../handlers/interactions';

export function defineDeleteTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    interaction: (args) => deleteInteraction(csClient, args),
  };

  const DATA_TYPES = Object.keys(handlers);

  return {
    delete_data: {
      description: `Delete an entity from ClientSuccess.

Data types:
• interaction — id* (clientNote ID). Permanently deletes the interaction.

This action is irreversible.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          data_type: { type: 'string', description: 'Type of entity to delete', enum: DATA_TYPES },
          id: { type: 'number', description: 'Entity ID to delete' },
        },
        required: ['data_type', 'id'],
      },
      mode: 'destructive',
      handler: async (args: any) => {
        const handler = handlers[args.data_type];
        if (!handler) return toolError(`Unknown data_type: "${args.data_type}". Valid: ${DATA_TYPES.join(', ')}`);
        return handler(args);
      },
    },
  };
}
