import { readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import walkConfig from './walk.json' with { type: 'json' };

/** Folders that never hold the user's own contracts, at any depth. */
const ALWAYS_SKIP = new Set(walkConfig.alwaysSkip);
/** Dependency and build folders of a toolchain: skipped only next to a root marker such as `foundry.toml`. */
const ROOT_SKIP = new Set(walkConfig.rootSkip);
const ROOT_MARKERS = new Set(walkConfig.rootMarkers);

export class PathError extends Error {}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  const isRoot = entries.some((e) => e.isFile() && ROOT_MARKERS.has(e.name));
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      const skip = ALWAYS_SKIP.has(e.name) || (isRoot && ROOT_SKIP.has(e.name));
      if (!skip) await walk(full, out);
    } else if (e.isFile() && e.name.endsWith('.sol')) {
      out.push(full);
    }
  }
}

/** Expands files and folders (relative to cwd) into a sorted, de-duplicated list of absolute .sol paths. */
export async function collectFiles(paths: readonly string[], cwd: string): Promise<string[]> {
  const found: string[] = [];
  for (const p of paths) {
    const full = resolve(cwd, p);
    const info = await stat(full).catch(() => undefined);
    if (!info) throw new PathError(`no such file or folder: ${p}`);
    if (info.isDirectory()) await walk(full, found);
    else found.push(full);
  }
  return [...new Set(found)].sort();
}

/** Path shown in reports: relative to the working folder, with forward slashes. */
export function displayPath(file: string, cwd: string): string {
  const rel = relative(cwd, file);
  const shown = rel === '' || rel.startsWith('..') || isAbsolute(rel) ? file : rel;
  return shown.split(sep).join('/');
}
