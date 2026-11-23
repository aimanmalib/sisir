import { readFile, stat } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { collectFiles } from '../../../src/cli/files.js';
import { reportDigest, type ReportDigest, type ReportFile } from '../../../src/report/hash.js';
import { catalog, lintSource, rules, type Finding } from '../../../src/rules/index.js';

/**
 * Lint a file or folder with the same engine and hash as the CLI and the playground, and return what
 * `SisirLedger.anchor` takes. Paths in the report follow decision 0006: the file name for one file (as the playground
 * names an uploaded file), the path below the folder otherwise. The report is independent of where the repository is.
 */
export async function digestPath(target: string): Promise<ReportDigest & { files: string[] }> {
  const full = resolve(target);
  const info = await stat(full).catch(() => undefined);
  if (!info) throw new Error(`no such file or folder: ${target}`);
  const paths = await collectFiles([full], '/');
  if (paths.length === 0) throw new Error(`no .sol files in ${target}`);
  const name = (p: string) => (info.isDirectory() ? relative(full, p).split(sep).join('/') : basename(p));
  const files: ReportFile[] = [];
  const findings: Finding[] = [];
  for (const p of paths) {
    const file: ReportFile = { path: name(p), source: await readFile(p, 'utf8') };
    files.push(file);
    const result = lintSource(file.source, { file: file.path, rules, catalog });
    // A file the parser cannot read has no findings to anchor; anchoring it would record a clean report.
    if (result.error) throw new Error(`${file.path} does not parse: ${result.error.message}`);
    findings.push(...result.findings);
  }
  return { ...reportDigest(files, findings), files: files.map((f) => f.path) };
}
