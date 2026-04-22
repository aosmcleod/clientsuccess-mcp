/**
 * Churned clients — terminated or inactive clients.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, clientRow } from '../../../utils/format';

export async function churnedClients(client: CSClient, args: any) {
  const statusCode = args.statusCode ?? 'T';
  const limit = args.limit ?? 100;

  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);
  const churned = all
    .filter(c => statusCode === 'BOTH'
      ? c.statusCode === 'T' || c.statusCode === 'I'
      : c.statusCode === statusCode)
    .slice(0, limit)
    .map(clientRow);

  return toolResult({ statusCode, count: churned.length, clients: churned });
}
