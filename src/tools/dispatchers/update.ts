/**
 * update_data — Consolidated update dispatcher.
 * Routes by data_type to handler functions.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { updateClient } from '../handlers/clients';
import { updateContact } from '../handlers/contacts';
import { updateTask, completeTask } from '../handlers/tasks';
import { updateInteraction } from '../handlers/interactions';

export function defineUpdateTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    client: (args) => updateClient(csClient, args),
    contact: (args) => updateContact(csClient, args),
    task: (args) => updateTask(csClient, args),
    complete_task: (args) => completeTask(csClient, args),
    interaction: (args) => updateInteraction(csClient, args),
  };

  const DATA_TYPES = Object.keys(handlers);

  return {
    update_data: {
      description: `Update an existing entity in ClientSuccess. Only provide the fields you want to change.

Data types and updatable fields:
• client — id*, name, managedByEmployeeId (CSM), externalId, npsScore, siteUrl, note
• contact — clientId*, contactId*, firstName, lastName, email, title, phone, executiveSponsor, champion, keyContact
• task — id* (UUID), name, dueDate, description, priority, completed, assigneeId
• complete_task — id* (UUID) — convenience shortcut to mark a task done
• interaction — id*, subject, note, type (NOTE/CALL/MEETING/EMAIL/QBR/CHAT/SUPPORT_TICKET/OTHER)

Fields marked * are required identifiers.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          data_type: { type: 'string', description: 'Type of entity to update', enum: DATA_TYPES },
          id: { type: 'number', description: 'Entity ID (client, interaction, or task UUID)' },
          clientId: { type: 'number', description: 'Client ID (contact updates)' },
          contactId: { type: 'number', description: 'Contact ID (contact updates)' },
          // Client fields
          name: { type: 'string', description: 'Name' },
          managedByEmployeeId: { type: 'number', description: 'Assigned CSM employee ID' },
          externalId: { type: 'string', description: 'External/CRM ID' },
          npsScore: { type: 'number', description: 'NPS score (-100 to 100)' },
          siteUrl: { type: 'string', description: 'Website URL' },
          note: { type: 'string', description: 'Note/body content' },
          // Contact fields
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          email: { type: 'string', description: 'Email' },
          title: { type: 'string', description: 'Job title' },
          phone: { type: 'string', description: 'Phone' },
          executiveSponsor: { type: 'boolean', description: 'Executive sponsor flag' },
          champion: { type: 'boolean', description: 'Champion flag' },
          keyContact: { type: 'boolean', description: 'Key contact flag' },
          // Task fields
          dueDate: { type: 'string', description: 'Due date YYYY-MM-DD' },
          description: { type: 'string', description: 'Description' },
          priority: { type: 'string', description: 'Priority: HIGH, MEDIUM, LOW' },
          completed: { type: 'boolean', description: 'Completion status' },
          assigneeId: { type: 'number', description: 'Assignee employee ID' },
          // Interaction fields
          subject: { type: 'string', description: 'Subject' },
          type: { type: 'string', description: 'Interaction type' },
        },
        required: ['data_type'],
      },
      mode: 'write',
      handler: async (args: any) => {
        const handler = handlers[args.data_type];
        if (!handler) return toolError(`Unknown data_type: "${args.data_type}". Valid: ${DATA_TYPES.join(', ')}`);
        return handler(args);
      },
    },
  };
}
