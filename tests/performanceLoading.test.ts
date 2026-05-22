import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const modeHubSource = readFileSync(new URL('../src/pages/ModeHubPage.tsx', import.meta.url), 'utf8');
const appLayoutSource = readFileSync(new URL('../src/components/AppLayout.tsx', import.meta.url), 'utf8');
const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

describe('iPad loading performance', () => {
  it('does not reload the page when the service worker changes controller', () => {
    expect(mainSource).not.toContain('controllerchange');
    expect(mainSource).not.toContain('window.location.reload');
    expect(mainSource).not.toContain('registration.update()');
  });

  it('serves static app assets from cache before falling back to network', () => {
    expect(serviceWorkerSource).toContain('isStaticAssetRequest');
    expect(serviceWorkerSource).toContain('cacheFirst');
    expect(serviceWorkerSource).toContain("requestUrl.pathname.startsWith('/audio/')");
  });

  it('keeps decorative hub imagery off the critical decoding path', () => {
    expect(modeHubSource).toContain('fetchPriority="high"');
    expect(modeHubSource).toMatch(/<img\s+src=\{step\.icon\}[^>]*decoding="async"/s);
    expect(modeHubSource).toMatch(/<img\s+src=\{card\.icon\}[^>]*loading="lazy"[^>]*decoding="async"/s);
    expect(appLayoutSource).toMatch(/className="bottom-nav-image-icon"[^>]*loading="lazy"[^>]*decoding="async"/s);
  });
});
