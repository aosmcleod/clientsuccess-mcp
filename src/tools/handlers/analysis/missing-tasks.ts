/**
 * Flag clients missing open tasks assigned to a specified team.
 * Fully configurable — no hard-coded email domains or team definitions.
 */

import type { CSClient } from '../../../api/client';
import type { NormalisedClient } from '../../../api/types';
import { toolResult, toolError, clientRow } from '../../../utils/format';

export async function clientsMissingTasks(client: CSClient, args: any) {
  const segment = args.segment_filter;

  // 1. Resolve team employee IDs
  let teamIds: number[];
  let teamResolution: any;

  if (args.teamEmployeeIds?.length) {
    teamIds = args.teamEmployeeIds;
    teamResolution = { source: 'explicit', count: teamIds.length };
  } else if (args.teamEmailDomain) {
    const domain = args.teamEmailDomain;
    const employees = await client.getV1<any[]>('/employees');
    const matched = (Array.isArray(employees) ? employees : []).filter((e: any) =>
      e.active !== false && e.email && e.email.toLowerCase().endsWith('@' + domain.toLowerCase()),
    );
    teamIds = matched.map((e: any) => e.id);
    teamResolution = {
      source: 'emailDomain',
      domain,
      members: matched.map((e: any) => ({ id: e.id, name: e.name ?? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(), email: e.email })),
    };
  } else {
    return toolError('Provide either teamEmployeeIds (array of IDs) or teamEmailDomain (e.g. "example.com") to identify the team.');
  }

  if (!teamIds.length) {
    return toolError(`No employees matched the team criteria (${JSON.stringify(teamResolution)})`);
  }

  // 2. Fetch active clients
  let clients: NormalisedClient[] = await client.getAllClients(segment);
  clients = clients.filter(c => c.statusCode === 'A');
  if (args.managedByEmployeeId) {
    clients = clients.filter(c => c.managedByEmployeeId === args.managedByEmployeeId);
  }

  // 3. Open tasks assigned to team members
  const teamOpenTasks = await client.fetchAllV2Tasks({
    affiliationTask: 'ALL_OPEN_TASKS',
    taskAssignedEmployeeIds: teamIds,
  });
  const teamClientIds = new Set<number>();
  for (const t of teamOpenTasks) {
    const cid = t.clientId ?? t.client?.id;
    if (cid != null) teamClientIds.add(cid);
  }

  // 4. All open tasks for diagnostic count
  const allOpenTasks = await client.fetchAllV2Tasks({ affiliationTask: 'ALL_OPEN_TASKS' });
  const openCountByClient = new Map<number, number>();
  for (const t of allOpenTasks) {
    const cid = t.clientId ?? t.client?.id;
    if (cid == null) continue;
    openCountByClient.set(cid, (openCountByClient.get(cid) ?? 0) + 1);
  }

  // 5. Flag clients with no team-assigned open task
  const flagged = clients
    .filter(c => !teamClientIds.has(c.id))
    .map(c => ({
      ...clientRow(c),
      totalOpenTaskCount: openCountByClient.get(c.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.totalOpenTaskCount !== b.totalOpenTaskCount) return a.totalOpenTaskCount - b.totalOpenTaskCount;
      const aTouch = a.daysSinceLastTouch ?? -1;
      const bTouch = b.daysSinceLastTouch ?? -1;
      return bTouch - aTouch;
    });

  return toolResult({
    team: teamResolution,
    activeClientsChecked: clients.length,
    openTasksAssignedToTeam: teamOpenTasks.length,
    totalOpenTasks: allOpenTasks.length,
    flaggedCount: flagged.length,
    flaggedClients: flagged,
  });
}
