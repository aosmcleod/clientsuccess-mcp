/**
 * analyze_portfolio — Portfolio-level analysis dispatcher.
 * Routes by analysis type to handler functions.
 */

import type { CSClient } from '../../api/client';
import { toolError } from '../../utils/format';
import { portfolioSummary } from '../handlers/analysis/portfolio-summary';
import { healthDistribution } from '../handlers/analysis/health-distribution';
import { csmPortfolio } from '../handlers/analysis/csm-portfolio';
import { atRiskClients } from '../handlers/analysis/at-risk';
import { noRecentTouch } from '../handlers/analysis/no-recent-touch';
import { churnedClients } from '../handlers/analysis/churned';
import { clientsMissingTasks } from '../handlers/analysis/missing-tasks';

export function defineAnalyzePortfolioTool(csClient: CSClient) {
  const handlers: Record<string, (args: any) => Promise<any>> = {
    summary: (args) => portfolioSummary(csClient, args),
    health_distribution: (args) => healthDistribution(csClient, args),
    csm_book: (args) => csmPortfolio(csClient, args),
    at_risk: (args) => atRiskClients(csClient, args),
    no_recent_touch: (args) => noRecentTouch(csClient, args),
    churned: (args) => churnedClients(csClient, args),
    missing_tasks: (args) => clientsMissingTasks(csClient, args),
  };

  const ANALYSIS_TYPES = Object.keys(handlers);

  return {
    analyze_portfolio: {
      description: `Run portfolio-level analysis across clients.

Analysis types:
• summary — Executive snapshot: status counts, health distribution, avg score, neglected accounts, worst 5
• health_distribution — Active client count by score band (red/yellow/green/unknown)
• csm_book — All active clients for a specific CSM with health breakdown. Requires employeeId.
• at_risk — Active clients at or below score threshold (default 33). threshold, includeNoScore, limit.
• no_recent_touch — Active clients with no interaction in N days (default 30). days, employeeId.
• churned — Terminated or inactive clients. statusCode (T/I/BOTH), limit.
• missing_tasks — Flag active clients with no open task assigned to a team. Requires teamEmployeeIds or teamEmailDomain.

Most analyses support segment_filter to scope to a configured client segment.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          analysis: { type: 'string', description: 'Type of portfolio analysis', enum: ANALYSIS_TYPES },
          segment_filter: { type: 'string', description: 'Segment filter (configured per-instance)' },
          employeeId: { type: 'number', description: 'CSM employee ID (csm_book, no_recent_touch)' },
          threshold: { type: 'number', description: 'Score threshold (at_risk, default 33)' },
          includeNoScore: { type: 'boolean', description: 'Include clients with no score (at_risk)' },
          days: { type: 'number', description: 'Days threshold (no_recent_touch, default 30)' },
          statusCode: { type: 'string', description: 'Status filter for churned: T, I, or BOTH' },
          limit: { type: 'number', description: 'Max results' },
          teamEmailDomain: { type: 'string', description: 'Team email domain (missing_tasks, e.g. "example.com")' },
          teamEmployeeIds: { type: 'array', description: 'Team employee IDs (missing_tasks)' },
          managedByEmployeeId: { type: 'number', description: 'Filter to one CSM (missing_tasks)' },
        },
        required: ['analysis'],
      },
      handler: async (args: any) => {
        const handler = handlers[args.analysis];
        if (!handler) return toolError(`Unknown analysis: "${args.analysis}". Valid: ${ANALYSIS_TYPES.join(', ')}`);
        return handler(args);
      },
    },
  };
}
