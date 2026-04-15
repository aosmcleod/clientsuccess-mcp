/**
 * Client handlers — list, get, search, update.
 * Pure functions: receive CSClient + args, return toolResult().
 */

import type { CSClient } from '../../api/client';
import type { NormalisedClient } from '../../api/types';
import { toolResult } from '../../utils/format';
import { clientRow, clientRowConcise, bandLabel } from '../../utils/format';

export async function listClients(client: CSClient, args: any) {
  let clients: NormalisedClient[] = await client.getAllClients(args.segment_filter);

  // Client-side filters
  if (args.name) {
    const q = args.name.toLowerCase();
    clients = clients.filter(c => (c.name ?? '').toLowerCase().includes(q));
  }
  if (args.statusCode) clients = clients.filter(c => c.statusCode === args.statusCode);
  if (args.managedByEmployeeId) clients = clients.filter(c => c.managedByEmployeeId === args.managedByEmployeeId);
  if (args.clientSegmentId) clients = clients.filter(c => c.clientSegmentId === args.clientSegmentId);

  const limit = args.limit ?? 500;
  const total = clients.length;
  clients = clients.slice(0, limit);

  const formatter = args.response_format === 'detailed' ? clientRow : clientRowConcise;

  return toolResult({
    total,
    returned: clients.length,
    truncated: total > clients.length,
    clients: clients.map(formatter),
  });
}

export async function getClient(client: CSClient, args: any) {
  const data = await client.getV1(`/clients/${args.id}`);
  return toolResult(data);
}

export async function updateClient(client: CSClient, args: any) {
  const { id, ...fields } = args;
  const body = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  const data = await client.putV1(`/clients/${id}`, body);
  client.clearCache();
  return toolResult({ updated: true, client: data });
}
