/**
 * Portfolio health distribution — count clients in each score band.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, bandLabel, pct } from '../../../utils/format';

export async function healthDistribution(client: CSClient, args: any) {
  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);
  const active = all.filter(c => c.statusCode === 'A');

  const dist = { Green: 0, Yellow: 0, Red: 0, Unknown: 0, total: active.length };
  for (const c of active) {
    dist[bandLabel(c.successScore) as keyof typeof dist]++;
  }

  return toolResult({
    total: dist.total,
    Green: dist.Green, GreenPct: pct(dist.Green, dist.total),
    Yellow: dist.Yellow, YellowPct: pct(dist.Yellow, dist.total),
    Red: dist.Red, RedPct: pct(dist.Red, dist.total),
    Unknown: dist.Unknown, UnknownPct: pct(dist.Unknown, dist.total),
  });
}
