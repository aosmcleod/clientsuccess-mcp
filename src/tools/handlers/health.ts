/**
 * Health / SuccessScore / Pulse handlers.
 */

import type { CSClient } from '../../api/client';
import { toolResult, dispositionLabel, bandLabel, daysSince } from '../../utils/format';
import { requireFields } from '../../utils/errors';
import { DISPOSITION_LABELS } from '../../utils/constants';

export async function getSuccessScore(client: CSClient, args: any) {
  requireFields('success_score', args, ['clientId']);

  const [clientData, pulseResult] = await Promise.all([
    client.getV1(`/clients/${args.clientId}`),
    client.getV2(`/pulse/search?clientId=${args.clientId}&size=1&page=0`),
  ]);

  const latestPulse = pulseResult?.data?.[0] ?? null;

  return toolResult({
    clientId: clientData.id,
    name: clientData.name,
    successScore: clientData.successScore ?? null,
    band: bandLabel(clientData.successScore),
    assignedCSM: clientData.assignedCSM ?? null,
    segment: clientData.clientSegment ?? null,
    latestPulse: latestPulse ? {
      id: latestPulse.id,
      disposition: dispositionLabel(latestPulse.dispositionType),
      note: latestPulse.note,
      scoreAtTime: latestPulse.currentScore,
      scoreChange: latestPulse.totalScoreChange,
      daysAgo: daysSince(latestPulse.createdTimestamp),
      reasonCodes: latestPulse.reasonCodes,
    } : null,
    totalPulseEntries: pulseResult?.totalElements ?? 0,
  });
}

export async function getPulseHistory(client: CSClient, args: any) {
  requireFields('pulse_history', args, ['clientId']);
  const limit = args.limit ?? 20;

  const result = await client.getV2(`/pulse/search?clientId=${args.clientId}&size=${limit}&page=0`);
  const entries = (result?.data ?? []).map((p: any) => ({
    id: p.id,
    disposition: dispositionLabel(p.dispositionType),
    note: p.note,
    scoreBefore: p.startingScore,
    scoreAfter: p.currentScore,
    scoreChange: p.totalScoreChange,
    daysAgo: daysSince(p.createdTimestamp),
    reasonCodes: p.reasonCodes?.length ? p.reasonCodes : undefined,
  }));

  return toolResult({
    clientId: args.clientId,
    totalEntries: result?.totalElements ?? entries.length,
    entries,
  });
}

export async function createPulse(client: CSClient, args: any) {
  requireFields('pulse', args, ['clientId', 'dispositionType']);

  const body: any = {
    clientId: args.clientId,
    dispositionType: args.dispositionType,
    ...(args.note && { note: args.note }),
    ...(args.reasonCodes?.length && { reasonCodes: args.reasonCodes }),
  };

  const data = await client.postV2('/pulse', body);
  return toolResult({ created: true, pulse: data });
}
