import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('deploy/nginx: headers the CDN and the browser rely on', () => {
  const conf = read('deploy/nginx/nginx.conf');
  const block = (loc: string) => {
    const start = conf.indexOf(`location ${loc} {`);
    expect(start, `location ${loc}`).toBeGreaterThan(-1);
    return conf.slice(start, conf.indexOf('}', start));
  };

  it('marks HTML no-transform, so the CDN injects nothing, and makes it revalidate', () => {
    expect(block('/')).toMatch(/Cache-Control "no-cache, no-transform"/);
  });

  it('caches hashed assets for a year and never falls back to HTML for a missing one', () => {
    const assets = block('/assets/');
    expect(assets).toMatch(/max-age=31536000, immutable";/); // no `always`: a 404 is not cached for a year
    expect(assets).toMatch(/try_files \$uri =404;/);
  });

  it('includes the shared headers in every location that adds its own (add_header drops inherited ones)', () => {
    const locations = conf.match(/location [^{]+\{[^}]*\}/g) ?? [];
    expect(locations.length).toBeGreaterThan(0);
    for (const l of locations.filter((x) => x.includes('add_header'))) expect(l).toContain('include /etc/nginx/headers.conf;');
  });
});

describe('build context: nothing private reaches the image', () => {
  const ignore = read('.dockerignore').split('\n').map((l) => l.trim());
  it.each(['.env', 'state/', 'keystore/', 'dalaman/', 'deploy/hos.env', '.git', '**/node_modules'])('excludes %s', (entry) => {
    expect(ignore).toContain(entry);
  });
});

describe('deploy/uptime.sh: two failures in a row send one alert, recovery sends one line', () => {
  let dir: string;
  let server: Server;
  let up = true;
  let url = '';

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.statusCode = up ? 200 : 503;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  // Async on purpose: a synchronous spawn would block the event loop and the test server could not answer.
  const run = async () => {
    const notify = join(dir, 'notify.sh');
    if (!existsSync(notify)) {
      writeFileSync(notify, `#!/bin/sh\nprintf '%s|%s\\n' "$2" "$1" >> "${join(dir, 'sent')}"\n`);
      chmodSync(notify, 0o755);
    }
    const child = spawn('bash', [join(root, 'deploy/uptime.sh')], {
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', UPTIME_URL: url, UPTIME_STATE: join(dir, 'state'), UPTIME_NOTIFY: notify },
      stdio: 'ignore',
    });
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(code).toBe(0);
  };
  const sent = () => (existsSync(join(dir, 'sent')) ? readFileSync(join(dir, 'sent'), 'utf8').trim().split('\n') : []);

  it('stays quiet after one failure, warns once after two, and reports the recovery once', async () => {
    dir = mkdtempSync(join(tmpdir(), 'sisir-uptime-'));
    up = false;
    await run();
    expect(sent()).toEqual([]);
    await run();
    await run();
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatch(/^warn\|Sisir playground .* failed 2 health checks in a row: \/=503 \/healthz=503/);
    up = true;
    await run();
    await run();
    expect(sent()).toHaveLength(2);
    expect(sent()[1]).toMatch(/^info\|Sisir playground .* is back/);
  });
});
