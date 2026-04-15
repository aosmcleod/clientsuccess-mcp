/**
 * Financial handlers — contracts, renewals, products.
 */

import type { CSClient } from '../../api/client';
import { toolResult, bandLabel } from '../../utils/format';
import { requireFields } from '../../utils/errors';

export async function getContracts(client: CSClient, args: any) {
  requireFields('contracts', args, ['clientId']);
  const limit = args.limit ?? 10;

  const result = await client.getV2(`/contract/search?tenantClientId=${args.clientId}&size=${limit}&page=0`);
  const contracts = (result?.data ?? []).map((c: any) => ({
    id: c.id,
    uuid: c.uuid,
    name: c.name,
    arr: c.arr,
    mrr: c.mrr,
    assignedArr: c.assignedArr,
    assignedMrr: c.assignedMrr,
    acv: c.acv,
    tcv: c.tcv,
    total: c.total,
    termStartDate: c.termStartDate,
    termEndDate: c.termEndDate,
    bookingDate: c.bookingDate,
    stage: c.stage?.label ?? c.stage,
    autoRenew: c.autoRenew,
    currency: c.currency,
    items: c.items,
  }));

  return toolResult({
    clientId: args.clientId,
    totalContracts: result?.totalElements ?? contracts.length,
    latestArr: contracts[0]?.arr ?? null,
    contracts,
  });
}

export async function listRenewals(client: CSClient, args: any) {
  const renewalField = client.renewalDateField;
  if (!renewalField) {
    return toolResult({ error: 'Renewal date field not configured. Set CS_RENEWAL_DATE_FIELD environment variable (e.g. "Next_Renewal_Date__cs").' });
  }

  const today = new Date();
  const start = new Date(args.startDate ?? today.toISOString().split('T')[0]);
  const end = new Date(args.endDate ?? (() => { const d = new Date(today); d.setDate(d.getDate() + 90); return d.toISOString().split('T')[0]; })());
  const segment: string | undefined = args.segment_filter;
  const statusCode = args.statusCode;

  const allClients = await client.fetchAllV2('/client/search');
  const filtered = client.filterBySegment(allClients, segment ?? 'ALL');

  const renewals = filtered
    .filter((c: any) => {
      if (statusCode) {
        const codeMap: Record<string, string> = { A: 'ACTIVE', I: 'INACTIVE', F: 'TRIAL', T: 'TERMINATED' };
        if (c.status !== codeMap[statusCode]) return false;
      } else {
        if (c.status === 'TERMINATED') return false;
      }
      const rawDate = c.custom?.[renewalField] ?? null;
      if (!rawDate) return false;
      const rd = new Date(rawDate);
      return rd >= start && rd <= end;
    })
    .map((c: any) => {
      const rawDate = c.custom?.[renewalField] ?? null;
      const rd = rawDate ? new Date(rawDate) : null;
      const daysUntil = rd ? Math.round((rd.getTime() - today.getTime()) / 86400000) : null;
      return {
        id: c.id,
        name: c.name,
        renewalDate: rawDate ? rawDate.split('T')[0] : null,
        daysUntilRenewal: daysUntil,
        successScore: c.successScore ?? null,
        band: bandLabel(c.successScore),
        status: c.status,
        segment: c.segment?.title ?? c.segment ?? null,
        assignedCSM: c.managedByEmployee?.name ?? null,
      };
    })
    .sort((a: any, b: any) => (a.renewalDate ?? '').localeCompare(b.renewalDate ?? ''));

  return toolResult({
    window: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
    count: renewals.length,
    renewals,
  });
}

export async function listProducts(client: CSClient) {
  const data = await client.getV1('/products');
  return toolResult(data);
}
