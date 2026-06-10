/**
 * Health / SuccessScore / Pulse handlers.
 */

import type { CSClient } from '../../api/client';
import { toolResult, dispositionLabel, bandLabel, daysSince } from '../../utils/format';
import { requireFields, ValidationError } from '../../utils/errors';
import { DISPOSITION_LABELS, DISPOSITION_TYPES, DISPOSITION_IDS } from '../../utils/constants';

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

  // The create endpoint accepts a different enum than the read side returns.
  // Reject invalid values here with a clear message — otherwise the API fails
  // them at JSON deserialization with an opaque 400 "Unable to parse request body".
  if (!(DISPOSITION_TYPES as readonly string[]).includes(args.dispositionType)) {
    throw new ValidationError(
      `Invalid dispositionType "${args.dispositionType}" for pulse. ` +
      `Valid values: ${DISPOSITION_TYPES.join(', ')}.`,
    );
  }

  // Body matches the ClientDispositionActivityDto schema: flat clientId, the
  // dispositionType enum, and its numeric dispositionId. (reasonCodes is NOT a
  // field on the create DTO, so it is intentionally not sent.)
  const body: any = {
    clientId: args.clientId,
    dispositionType: args.dispositionType,
    dispositionId: DISPOSITION_IDS[args.dispositionType],
    ...(args.note && { note: args.note }),
  };

  const data = await client.postV2('/pulse', body);
  return toolResult({ created: true, pulse: data });
}
