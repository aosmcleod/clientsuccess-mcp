/**
 * Interaction / ClientNote handlers — list, get, add, update, delete.
 */

import type { CSClient } from '../../api/client';
import { toolResult, stripHtml, daysSince } from '../../utils/format';
import { requireFields } from '../../utils/errors';
import { INTERACTION_TYPE_NAMES, INTERACTION_TYPE_IDS } from '../../utils/constants';

export async function listInteractions(client: CSClient, args: any) {
  requireFields('interactions', args, ['clientId']);
  const limit = args.limit ?? 10;
  const page = args.page ?? 0;

  const result = await client.getV2(`/clientNote/search?clientId=${args.clientId}&size=${limit}&page=${page}`);
  const items = (result?.data ?? []).map((n: any) => ({
    id: n.id,
    subject: n.subject,
    type: INTERACTION_TYPE_NAMES[n.interactionTypeId] ?? `type_${n.interactionTypeId}`,
    author: n.author,
    daysAgo: n.createdTime ? Math.round((Date.now() - new Date(n.createdTime).getTime()) / 86400000) : null,
    note: (stripHtml(n.sanitizedNote) || stripHtml(n.note) || '').slice(0, args.response_format === 'detailed' ? 2000 : 500) || null,
  }));

  return toolResult({
    clientId: args.clientId,
    page,
    totalInteractions: result?.totalElements ?? items.length,
    totalPages: result?.totalPages ?? 1,
    interactions: items,
  });
}

export async function getInteraction(client: CSClient, args: any) {
  requireFields('interaction', args, ['id']);
  const n = await client.getV2(`/clientNote/${args.id}`);
  return toolResult({
    ...n,
    noteText: stripHtml(n?.sanitizedNote) || stripHtml(n?.note) || null,
    type: INTERACTION_TYPE_NAMES[n?.interactionTypeId] ?? `type_${n?.interactionTypeId}`,
  });
}

export async function addInteraction(client: CSClient, args: any) {
  requireFields('interaction', args, ['clientId', 'type', 'subject']);

  const body: any = {
    interactionTypeId: INTERACTION_TYPE_IDS[args.type] ?? 8,
    subject: args.subject,
    interactionDate: args.interactionDate ?? new Date().toISOString().split('T')[0],
    ...(args.note && { note: args.note }),
    ...(args.contactIds?.length && { contactIds: args.contactIds }),
  };
  const data = await client.postV1(`/clients/${args.clientId}/interactions`, body);
  return toolResult({ created: true, interaction: data });
}

export async function updateInteraction(client: CSClient, args: any) {
  requireFields('interaction', args, ['id']);
  const { id, ...fields } = args;

  // Map friendly type name to typeId if provided
  if (fields.type && typeof fields.type === 'string') {
    fields.interactionTypeId = INTERACTION_TYPE_IDS[fields.type] ?? undefined;
    delete fields.type;
  }

  const body = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  const data = await client.putV2(`/clientNote/${id}`, body);
  return toolResult({ updated: true, interaction: data });
}

export async function deleteInteraction(client: CSClient, args: any) {
  requireFields('interaction', args, ['id']);
  await client.deleteV2(`/clientNote/${args.id}`);
  return toolResult({ deleted: true, id: args.id });
}
