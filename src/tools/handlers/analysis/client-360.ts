/**
 * Client 360 — Complete view of one client from multiple sources in parallel.
 */

import type { CSClient } from '../../../api/client';
import { toolResult, stripHtml, dispositionLabel, daysSince } from '../../../utils/format';
import { requireFields } from '../../../utils/errors';
import { INTERACTION_TYPE_NAMES } from '../../../utils/constants';

export async function client360(client: CSClient, args: any) {
  requireFields('client_360', args, ['clientId']);
  const clientId = args.clientId;

  const [clientData, contacts, notes, contracts, pulse] = await Promise.allSettled([
    client.getV1(`/clients/${clientId}`),
    client.getV1(`/clients/${clientId}/contacts`),
    client.getV2(`/clientNote/search?clientId=${clientId}&size=10&page=0`),
    client.getV2(`/contract/search?tenantClientId=${clientId}&size=10&page=0`),
    client.getV2(`/pulse/search?clientId=${clientId}&size=5&page=0`),
  ]);

  const val = (r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? r.value : { error: r.reason?.message };

  const clientResult = val(clientData);
  const contactsResult = val(contacts);
  const notesResult = val(notes);
  const contractsResult = val(contracts);
  const pulseResult = val(pulse);

  // Shape contacts
  const contactList = Array.isArray(contactsResult)
    ? contactsResult.map((c: any) => ({
        id: c.id,
        name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.name || null,
        email: c.email ?? null,
        title: c.title ?? null,
        isPrimary: c.isPrimary ?? false,
      }))
    : contactsResult;

  // Shape interactions
  const interactions = (notesResult?.data ?? []).map((n: any) => ({
    id: n.id,
    subject: n.subject,
    type: INTERACTION_TYPE_NAMES[n.interactionTypeId] ?? `type_${n.interactionTypeId}`,
    author: n.author,
    daysAgo: daysSince(n.createdTime),
    note: (stripHtml(n.sanitizedNote) || stripHtml(n.note) || '').slice(0, 600) || null,
  }));

  // Shape contracts
  const contractList = (contractsResult?.data ?? []).map((c: any) => ({
    name: c.name,
    arr: c.arr,
    mrr: c.mrr,
    startDate: c.termStartDate,
    endDate: c.termEndDate,
    stage: c.stage?.label ?? c.stage,
    autoRenew: c.autoRenew,
  }));

  // Shape pulse
  const pulseList = (pulseResult?.data ?? []).map((p: any) => ({
    disposition: dispositionLabel(p.dispositionType),
    note: p.note,
    scoreAfter: p.currentScore,
    scoreChange: p.totalScoreChange,
    daysAgo: daysSince(p.createdTimestamp),
    reasonCodes: p.reasonCodes?.length ? p.reasonCodes : undefined,
  }));

  return toolResult({
    client: clientResult,
    contacts: contactList,
    recentInteractions: {
      total: notesResult?.totalElements ?? 0,
      shown: interactions.length,
      items: interactions,
    },
    contracts: {
      total: contractsResult?.totalElements ?? 0,
      shown: contractList.length,
      items: contractList,
      latestArr: contractList[0]?.arr ?? null,
    },
    pulseHistory: {
      total: pulseResult?.totalElements ?? 0,
      shown: pulseList.length,
      items: pulseList,
    },
  });
}
