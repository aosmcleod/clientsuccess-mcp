/**
 * Contact handlers — list, get, find, create, update.
 */

import type { CSClient } from '../../api/client';
import { toolResult } from '../../utils/format';
import { requireFields } from '../../utils/errors';

export async function listContacts(client: CSClient, args: any) {
  requireFields('contacts', args, ['clientId']);
  const data = await client.getV1(`/clients/${args.clientId}/contacts`);
  const contacts = Array.isArray(data) ? data : (data?.contacts ?? data?.data ?? []);

  if (args.response_format === 'concise') {
    const slim = contacts.map((c: any) => ({
      id: c.id,
      name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.name || null,
      email: c.email ?? null,
      title: c.title ?? null,
      isPrimary: c.isPrimary ?? false,
    }));
    return toolResult({ clientId: args.clientId, total: slim.length, contacts: slim });
  }

  return toolResult({ clientId: args.clientId, total: contacts.length, contacts });
}

export async function getContact(client: CSClient, args: any) {
  requireFields('contact', args, ['clientId', 'contactId']);
  const data = await client.getV1(`/clients/${args.clientId}/contacts/${args.contactId}`);
  return toolResult(data);
}

export async function findContact(client: CSClient, args: any) {
  requireFields('contact', args, ['email']);
  const data = await client.getV1(`/contacts?email=${encodeURIComponent(args.email)}`);
  return toolResult(data);
}

export async function createContact(client: CSClient, args: any) {
  requireFields('contact', args, ['clientId', 'firstName', 'lastName', 'email']);
  const body: any = {
    firstName: args.firstName,
    lastName: args.lastName,
    email: args.email,
    ...(args.title !== undefined && { title: args.title }),
    ...(args.phone !== undefined && { phone: args.phone }),
    ...(args.executiveSponsor !== undefined && { executiveSponsor: args.executiveSponsor }),
    ...(args.champion !== undefined && { champion: args.champion }),
    ...(args.keyContact !== undefined && { keyContact: args.keyContact }),
  };
  const data = await client.postV1(`/clients/${args.clientId}/contacts`, body);
  return toolResult({ created: true, contact: data });
}

export async function updateContact(client: CSClient, args: any) {
  requireFields('contact', args, ['clientId', 'contactId']);
  const { clientId, contactId, ...fields } = args;
  const body = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  const data = await client.putV1(`/clients/${clientId}/contacts/${contactId}`, body);
  return toolResult({ updated: true, contact: data });
}
