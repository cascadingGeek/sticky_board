// @vitest-environment node
// Regression: the Allow window asks Chrome for `siteOrigin(host)`. Chrome only
// grants origins that the manifest's optional_host_permissions cover, and it
// does not count `http://*/*` plus `https://*/*` as covering `*://site/*`.
// When they don't match, every Allow fails with "Chrome couldn't ask for access."
import { describe, expect, it } from 'vitest';
import config from '../../wxt.config';
import { siteOrigin } from './pageAccess';

const parse = (pattern: string) => {
  const m = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  if (!m) throw new Error(`not a match pattern: ${pattern}`);
  return { scheme: m[1]!, host: m[2]!, path: m[3]! };
};

/** Chrome's rule: a requested origin must sit inside one declared pattern. */
const covers = (declared: string, requested: string) => {
  const d = parse(declared);
  const r = parse(requested);
  const schemeOk = d.scheme === r.scheme || d.scheme === '*';
  const hostOk = d.host === '*' || d.host === r.host || (d.host.startsWith('*.') && r.host.endsWith(d.host.slice(1)));
  const pathOk = d.path === '/*' || d.path === r.path;
  return schemeOk && hostOk && pathOk;
};

const declared = (): string[] => {
  const manifest = config.manifest as { optional_host_permissions?: string[] };
  return manifest.optional_host_permissions ?? [];
};

describe('site access the Allow window can request', () => {
  it.each(['daily.dev', 'chatgpt.com', 'meet.google.com', 'localhost', '127.0.0.1'])(
    'the manifest covers the access pattern for %s',
    host => {
      const requested = siteOrigin(host);
      expect(declared().some(d => covers(d, requested))).toBe(true);
    },
  );

  it('would reject the old http and https pair, so the check above is not a free pass', () => {
    const old = ['http://*/*', 'https://*/*'];
    expect(old.some(d => covers(d, siteOrigin('daily.dev')))).toBe(false);
  });

  it('asks for web sites only, never every URL', () => {
    expect(declared()).not.toContain('<all_urls>');
    for (const d of declared()) expect(parse(d).scheme).toMatch(/^(\*|https?)$/);
  });
});
