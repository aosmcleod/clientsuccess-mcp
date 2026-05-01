/**
 * list_data — Consolidated list/search dispatcher.
 * Routes by data_type to handler functions.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { listClients } from '../handlers/clients';
import { listContacts, findContact } from '../handlers/contacts';
import { listInteractions } from '../handlers/interactions';
import { listTasks } from '../handlers/tasks';
import { listRenewals, listProducts } from '../handlers/financials';

export function defineListTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    clients: (args) => listClients(csClient, args),
    contacts: (args) => listContacts(csClient, args),
    contact_by_email: (args) => findContact(csClient, args),
    interactions: (args) => listInteractions(csClient, args),
    tasks: (args) => listTasks(csClient, args),
    renewals: (args) => listRenewals(csClient, args),
    products: () => listProducts(csClient),
  };

  const DATA_TYPES = Object.keys(handlers);

  // Build segment filter description dynamically from config
  const segmentDesc = csClient.hasSegmentConfig()
    ? ` segment_filter (${csClient.getSegmentKeys().join('/')}/ALL — filters by configured client segment),`
    : '';

  return {
    list_data: {
      description: `List or search ClientSuccess data. Pass data_type and optional filters.

Data types and filters:
• clients — name (substring search), statusCode (A/I/F/T), managedByEmployeeId, clientSegmentId,${segmentDesc} limit
• contacts — clientId (required)
• contact_by_email — email (exact match, global lookup)
• interactions — clientId (required), limit, page
• tasks — clientId, assigneeEmployeeIds (array), affiliationTask (ALL_OPEN_TASKS, ALL_COMPLETED_TASKS, OVERDUE, THIS_WEEK, THIS_MONTH, etc.), limit
• renewals — startDate, endDate (YYYY-MM-DD), statusCode,${segmentDesc ? ' segment_filter,' : ''} limit
• products — (no filters)

Use response_format "concise" (default) for fewer tokens, "detailed" for all fields.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          data_type: { type: 'string', description: 'Type of data to list', enum: DATA_TYPES },
          name: { type: 'string', description: 'Client name substring search (clients only)' },
          clientId: { type: 'number', description: 'Client ID (required for contacts, interactions)' },
          email: { type: 'string', description: 'Exact email (contact_by_email only)' },
          statusCode: { type: 'string', description: 'Status filter: A, I, F, or T' },
          managedByEmployeeId: { type: 'number', description: 'CSM employee ID filter' },
          clientSegmentId: { type: 'number', description: 'Segment ID filter' },
          segment_filter: { type: 'string', description: 'Segment filter (configured per-instance)' },
          assigneeEmployeeIds: { type: 'array', description: 'Task assignee employee IDs' },
          affiliationTask: { type: 'string', description: 'Task scope filter (ALL_OPEN_TASKS, OVERDUE, etc.)' },
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD (renewals)' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD (renewals)' },
          limit: { type: 'number', description: 'Max records to return' },
          page: { type: 'number', description: 'Page number (0-indexed, interactions only)' },
          response_format: { type: 'string', description: 'concise (default) or detailed', enum: ['concise', 'detailed'] },
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
