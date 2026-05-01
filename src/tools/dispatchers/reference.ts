/**
 * lookup_reference — Reference data lookup dispatcher.
 * Returns statuses, segments, employees, custom field definitions, and interaction types.
 */

import type { CSClient } from '../../api/client';
import { toolResult, toolError } from '../../utils/format';
import { INTERACTION_TYPE_NAMES } from '../../utils/constants';

export function defineReferenceTool(csClient: CSClient) {
  return {
    lookup_reference: {
      description: `Look up reference data configured in ClientSuccess. Use this to discover valid values for filters, find employee IDs for CSM queries, or understand custom field definitions.

Reference types:
• client_statuses — Status codes (A=Active, I=Inactive, F=Trial, T=Terminated)
• client_segments — Segment/tier definitions with IDs
• employees — All CSM/employee accounts with IDs, names, emails, roles
• custom_field_definitions — All custom field definitions (labels, types, picklist values)
• interaction_types — Interaction type names and IDs`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          reference_type: {
            type: 'string',
            description: 'Type of reference data to look up',
            enum: ['client_statuses', 'client_segments', 'employees', 'custom_field_definitions', 'interaction_types'],
          },
        },
        required: ['reference_type'],
      },
      handler: async (args: any) => {
        switch (args.reference_type) {
          case 'client_statuses': {
            const data = await csClient.getV1('/client-statuses');
            return toolResult(data);
          }
          case 'client_segments': {
            const data = await csClient.getV1('/client-segments');
            return toolResult(data);
          }
          case 'employees': {
            const data = await csClient.getV1<any[]>('/employees');
            const employees = Array.isArray(data) ? data : [];
            const slim = employees.map((e: any) => ({
              id: e.id,
              name: e.name ?? e.fullName ?? (`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || null),
              email: e.email,
              title: e.title || null,
              type: e.type,
              active: e.active,
              roleId: e.roleId ?? null,
              roleName: e.roleName ?? null,
            }));
            return toolResult({ total: slim.length, employees: slim });
          }
          case 'custom_field_definitions': {
            const data = await csClient.getV2('/customfield/all/CLIENT');
            const fields = Array.isArray(data) ? data : [];
            const slim = fields.map((f: any) => ({
              fieldLabel: f.fieldLabel,
              fieldKey: f.fieldKey ?? f.fieldName,
              fieldTypeName: f.fieldTypeName,
              required: f.required,
              picklistValues: f.picklistValues?.length ? f.picklistValues : undefined,
            }));
            return toolResult({ total: slim.length, fields: slim });
          }
          case 'interaction_types': {
            const types = Object.entries(INTERACTION_TYPE_NAMES).map(([id, name]) => ({
              id: parseInt(id, 10),
              name,
            }));
            return toolResult({ types });
          }
          default:
            return toolError(`Unknown reference_type: "${args.reference_type}".`);
        }
      },
    },
  };
}
