/**
 * CSM portfolio — all active clients for a specific CSM.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, clientRow, bandLabel } from '../../../utils/format';
import { requireFields } from '../../../utils/errors';

export async function csmPortfolio(client: CSClient, args: any) {
  requireFields('csm_portfolio', args, ['employeeId']);

  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);
  const portfolio = all
    .filter(c => c.managedByEmployeeId === args.employeeId && c.statusCode === 'A')
    .map(clientRow)
    .sort((a, b) => {
      if (a.successScore === null) return 1;
      if (b.successScore === null) return -1;
      return (a.successScore ?? 0) - (b.successScore ?? 0);
    });

  const scored = portfolio.filter(c => c.successScore !== null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, c) => s + (c.successScore ?? 0), 0) / scored.length * 10) / 10
    : null;

  return toolResult({
    employeeId: args.employeeId,
    totalClients: portfolio.length,
    avgSuccessScore: avgScore,
    healthBreakdown: {
      Green: portfolio.filter(c => c.band === 'Green').length,
      Yellow: portfolio.filter(c => c.band === 'Yellow').length,
      Red: portfolio.filter(c => c.band === 'Red').length,
      Unknown: portfolio.filter(c => c.band === 'Unknown').length,
    },
    clients: portfolio,
  });
}
