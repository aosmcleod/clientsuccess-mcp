/**
 * create_data — Consolidated create dispatcher.
 * Routes by data_type to handler functions.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { createContact } from '../handlers/contacts';
import { createTask } from '../handlers/tasks';
import { addInteraction } from '../handlers/interactions';
import { createPulse } from '../handlers/health';

export function defineCreateTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    contact: (args) => createContact(csClient, args),
    task: (args) => createTask(csClient, args),
    interaction: (args) => addInteraction(csClient, args),
    pulse: (args) => createPulse(csClient, args),
  };

  const DATA_TYPES = Object.keys(handlers);

  return {
    create_data: {
      description: `Create a new entity in ClientSuccess.

Data types and fields:
• contact — clientId*, firstName*, lastName*, email*, title, phone, executiveSponsor, champion, keyContact
• task — name*, assigneeId* (employee ID), clientId, dueDate (YYYY-MM-DD), description, priority (HIGH/MEDIUM/LOW), status (NOT_STARTED/IN_PROGRESS/COMPLETE)
• interaction — clientId*, type* (NOTE/CALL/MEETING/EMAIL/QBR/CHAT/SUPPORT_TICKET/OTHER), subject*, note, interactionDate (YYYY-MM-DD), contactIds
• pulse — clientId*, dispositionType* (EXTREMELY_SATISFIED/VERY_SATISFIED/FAIRLY_SATISFIED/SOME_RISK/HIGH_RISK/SEVERE_RISK), note

Fields marked * are required.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          data_type: { type: 'string', description: 'Type of entity to create', enum: DATA_TYPES },
          // Contact fields
          clientId: { type: 'number', description: 'Client ID' },
          firstName: { type: 'string', description: 'Contact first name' },
          lastName: { type: 'string', description: 'Contact last name' },
          email: { type: 'string', description: 'Email address' },
          title: { type: 'string', description: 'Job title' },
          phone: { type: 'string', description: 'Phone number' },
          executiveSponsor: { type: 'boolean', description: 'Mark as executive sponsor' },
          champion: { type: 'boolean', description: 'Mark as product champion' },
          keyContact: { type: 'boolean', description: 'Mark as key contact' },
          // Task fields
          name: { type: 'string', description: 'Task name' },
          dueDate: { type: 'string', description: 'Due date YYYY-MM-DD' },
          description: { type: 'string', description: 'Description' },
          priority: { type: 'string', description: 'Task priority: HIGH, MEDIUM, LOW' },
          assigneeId: { type: 'number', description: 'Assignee employee ID' },
          // Interaction fields
          type: { type: 'string', description: 'Interaction type (NOTE, CALL, MEETING, EMAIL, QBR, CHAT, SUPPORT_TICKET, OTHER)' },
          subject: { type: 'string', description: 'Interaction subject' },
          note: { type: 'string', description: 'Note/body content' },
          interactionDate: { type: 'string', description: 'Date YYYY-MM-DD (defaults to today)' },
          contactIds: { type: 'array', description: 'Contact IDs involved' },
          // Pulse fields
          dispositionType: { type: 'string', description: 'Pulse disposition (satisfied → at-risk scale): EXTREMELY_SATISFIED, VERY_SATISFIED, FAIRLY_SATISFIED, SOME_RISK, HIGH_RISK, SEVERE_RISK' },
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
