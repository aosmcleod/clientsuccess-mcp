/**
 * Portfolio summary — executive snapshot across all active clients.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, bandLabel, daysSince } from '../../../utils/format';

export async function portfolioSummary(client: CSClient, args: any) {
  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);

  const byStatus: Record<string, number> = { A: 0, I: 0, F: 0, T: 0 };
  for (const c of all) byStatus[c.statusCode] = (byStatus[c.statusCode] ?? 0) + 1;

  const active = all.filter(c => c.statusCode === 'A');
  const health = { Green: 0, Yellow: 0, Red: 0, Unknown: 0 };
  let scoreSum = 0, scoreCount = 0, noRecentTouch = 0;

  for (const c of active) {
    health[bandLabel(c.successScore) as keyof typeof health]++;
    if (c.successScore !== null && c.successScore !== undefined) { scoreSum += c.successScore; scoreCount++; }
    const days = daysSince(c.lastTouchDateTime);
    if (days === null || days >= 30) noRecentTouch++;
  }

  const worstFive = active
    .filter(c => c.successScore !== null)
    .sort((a, b) => (a.successScore ?? 0) - (b.successScore ?? 0))
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      name: c.name,
      successScore: c.successScore,
      band: bandLabel(c.successScore),
      segment: c.segment ?? null,
      assignedCSM: c.assignedCSM ?? null,
      daysSinceLastTouch: daysSince(c.lastTouchDateTime),
    }));

  return toolResult({
    asOf: new Date().toISOString().split('T')[0],
    clientCounts: { Active: byStatus.A, Inactive: byStatus.I, Trial: byStatus.F, Terminated: byStatus.T },
    totalClients: all.length,
    health,
    avgSuccessScore: scoreCount ? Math.round(scoreSum / scoreCount * 10) / 10 : null,
    activeNoTouchIn30Days: noRecentTouch,
    worstScoringActive: worstFive,
  });
}
