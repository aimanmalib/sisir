import { catalog as defaultCatalog } from '../rules/catalog.js';
import type { CatalogEntry, Level } from '../rules/types.js';
import { allFindings, parseFailures, type RunResult } from './summary.js';

const SARIF_SCHEMA = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json';
const INFO_URI = 'https://github.com/aimanmalib/sisir';
const SARIF_LEVEL: Record<Level, 'error' | 'warning' | 'note'> = { error: 'error', warning: 'warning', info: 'note' };

/** SARIF 2.1.0 log with one run. Parse errors become tool execution notifications. */
export function formatSarif(run: RunResult, catalog: ReadonlyMap<string, CatalogEntry> = defaultCatalog): string {
  const entries = [...catalog.values()];
  const index = new Map(entries.map((e, i) => [e.id, i]));
  const failures = parseFailures(run);
  const log = {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'sisir',
            version: run.version,
            informationUri: INFO_URI,
            rules: entries.map((e) => ({
              id: e.id,
              name: e.name,
              shortDescription: { text: e.message },
              help: { text: e.fix },
              helpUri: e.docs,
              defaultConfiguration: { level: SARIF_LEVEL[e.level] },
            })),
          },
        },
        invocations: [
          {
            executionSuccessful: failures.length === 0,
            toolExecutionNotifications: failures.map((e) => ({
              level: 'error',
              message: { text: `parse error: ${e.message}` },
              locations: [location(e.file, e.line, e.column)],
            })),
          },
        ],
        results: allFindings(run).map((f) => ({
          ruleId: f.ruleId,
          ...(index.has(f.ruleId) ? { ruleIndex: index.get(f.ruleId) } : {}),
          level: SARIF_LEVEL[f.level],
          message: { text: `${f.message} Fix: ${f.fix}` },
          locations: [location(f.file, f.line, f.column, f.endLine, f.endColumn)],
        })),
      },
    ],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}

function location(uri: string, startLine: number, startColumn: number, endLine?: number, endColumn?: number) {
  const region: Record<string, number> = { startLine, startColumn };
  if (endLine !== undefined && endColumn !== undefined) {
    region.endLine = endLine;
    region.endColumn = endColumn;
  }
  return { physicalLocation: { artifactLocation: { uri: encodeURI(uri) }, region } };
}
