/**
 * Task handlers — list, get, create, update, complete.
 */

import type { CSClient } from '../../api/client';
import { toolResult } from '../../utils/format';
import { requireFields } from '../../utils/errors';

/** Slim down a v2 task to the fields Claude actually displays. */
function taskRow(t: any) {
  const assignee = t.assignedToEmployee;
  return {
    id: t.id,
    uuid: t.uuid,
    name: t.name,
    completed: t.completed,
    statusDesc: t.status?.description ?? null,
    priority: t.priority?.code ?? null,
    dueDate: t.dueDate ?? null,
    clientId: t.clientId ?? t.client?.id ?? null,
    clientName: t.client?.name ?? null,
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() || null : null,
    assigneeEmail: assignee?.user?.email ?? null,
  };
}

/** Concise task row — fewer fields. */
function taskRowConcise(t: any) {
  return {
    id: t.id,
    uuid: t.uuid,
    name: t.name,
    completed: t.completed,
    dueDate: t.dueDate ?? null,
    clientName: t.client?.name ?? null,
    assigneeName: t.assignedToEmployee
      ? `${t.assignedToEmployee.firstName ?? ''} ${t.assignedToEmployee.lastName ?? ''}`.trim() || null
      : null,
  };
}

export async function listTasks(client: CSClient, args: any) {
  const filterBy: any = { affiliationTask: args.affiliationTask ?? 'ALL_OPEN_TASKS' };
  if (args.clientId) filterBy.clientIds = [args.clientId];
  if (args.assigneeEmployeeIds?.length) filterBy.taskAssignedEmployeeIds = args.assigneeEmployeeIds;
  const sortBy = [{ key: 'dueDate', value: 'asc' }];

  const limit = args.limit ?? 200;
  const all = await client.fetchAllV2Tasks(filterBy, sortBy);
  const rows = all.slice(0, limit);
  const formatter = args.response_format === 'detailed' ? taskRow : taskRowConcise;

  return toolResult({
    affiliationTask: filterBy.affiliationTask,
    totalFetched: all.length,
    returned: rows.length,
    tasks: rows.map(formatter),
  });
}

export async function getTask(client: CSClient, args: any) {
  requireFields('task', args, ['id']);
  const data = await client.getV2(`/task/${args.id}`);
  return toolResult(data);
}

/**
 * Task status IDs: 1=NOT_STARTED, 2=IN_PROGRESS, 3=COMPLETE
 * Task priority IDs: 1=Low, 2=Medium, 3=High
 */
const STATUS_MAP: Record<string, { id: number; description: string }> = {
  NOT_STARTED: { id: 1, description: 'NOT_STARTED' },
  IN_PROGRESS: { id: 2, description: 'IN_PROGRESS' },
  COMPLETE: { id: 3, description: 'COMPLETE' },
};

const PRIORITY_MAP: Record<string, { id: number; code: string }> = {
  LOW: { id: 1, code: 'Low' },
  MEDIUM: { id: 2, code: 'Medium' },
  HIGH: { id: 3, code: 'High' },
};

export async function createTask(client: CSClient, args: any) {
  requireFields('task', args, ['name', 'assigneeId']);

  const priority = PRIORITY_MAP[(args.priority ?? 'MEDIUM').toUpperCase()] ?? PRIORITY_MAP.MEDIUM;
  const status = STATUS_MAP[(args.status ?? 'NOT_STARTED').toUpperCase()] ?? STATUS_MAP.NOT_STARTED;

  const body: any = {
    name: args.name,
    status,
    priority,
    assignedToEmployee: { id: args.assigneeId },
    ...(args.clientId !== undefined && { clientId: args.clientId }),
    ...(args.dueDate !== undefined && { dueDate: args.dueDate }),
    ...(args.description !== undefined && { description: args.description }),
  };

  const data = await client.postV2('/task', body);
  return toolResult({ created: true, task: taskRow(data) });
}

export async function updateTask(client: CSClient, args: any) {
  requireFields('task', args, ['id']);
  const { id, ...fields } = args;

  // Map priority string to object
  if (fields.priority && typeof fields.priority === 'string') {
    const p = PRIORITY_MAP[fields.priority.toUpperCase()];
    if (p) fields.priority = p;
  }
  // Map status string to object
  if (fields.status && typeof fields.status === 'string') {
    const s = STATUS_MAP[fields.status.toUpperCase()];
    if (s) fields.status = s;
  }
  // Map assigneeId to object
  if (fields.assigneeId !== undefined) {
    fields.assignedToEmployee = fields.assigneeId ? { id: fields.assigneeId } : null;
    delete fields.assigneeId;
  }

  const body = Object.fromEntries(
    Object.entries(fields).filter(([k, v]) => v !== undefined && k !== 'response_format' && k !== 'data_type'),
  );
  const data = await client.patchV2(`/task/${id}`, body);
  return toolResult({ updated: true, task: taskRow(data) });
}

export async function completeTask(client: CSClient, args: any) {
  requireFields('task', args, ['id']);
  const data = await client.patchV2(`/task/${args.id}`, { completed: true });
  return toolResult({ completed: true, task: data });
}
