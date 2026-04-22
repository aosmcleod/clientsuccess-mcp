/**
 * At-risk clients — active clients at or below score threshold.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, clientRow } from '../../../utils/format';

export async function atRiskClients(client: CSClient, args: any) {
  const threshold = args.threshold ?? 33;
  const includeNoScore = args.includeNoScore ?? false;
  const limit = args.limit ?? 50;

  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);
  const atRisk = all
    .filter(c => c.statusCode === 'A')
    .filter(c => {
      const s = c.successScore ?? null;
      return s === null ? includeNoScore : s <= threshold;
    })
    .map(clientRow)
    .sort((a, b) => {
      if (a.successScore === null) return 1;
      if (b.successScore === null) return -1;
      return (a.successScore ?? 0) - (b.successScore ?? 0);
    });

  const totalCount = atRisk.length;
  const shown = atRisk.slice(0, limit);

  return toolResult({
    threshold,
    totalCount,
    shown: shown.length,
    truncated: totalCount > shown.length,
    clients: shown,
  });
}
