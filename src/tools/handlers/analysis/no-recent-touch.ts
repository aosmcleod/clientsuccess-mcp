/**
 * No recent touch — active clients with no logged interaction in N days.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, clientRow } from '../../../utils/format';

export async function noRecentTouch(client: CSClient, args: any) {
  const days = args.days ?? 30;
  const employeeId = args.employeeId;

  const all: NormalisedClient[] = await client.getAllClients(args.segment_filter);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const stale = all
    .filter(c => c.statusCode === 'A')
    .filter(c => !employeeId || c.managedByEmployeeId === employeeId)
    .filter(c => {
      if (!c.lastTouchDateTime) return true;
      return new Date(c.lastTouchDateTime) < cutoff;
    })
    .map(clientRow)
    .sort((a, b) => {
      if (a.daysSinceLastTouch === null) return -1;
      if (b.daysSinceLastTouch === null) return 1;
      return (b.daysSinceLastTouch ?? 0) - (a.daysSinceLastTouch ?? 0);
    });

  return toolResult({
    thresholdDays: days,
    count: stale.length,
    clients: stale,
  });
}
