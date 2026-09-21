import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Production 404 Not Found Page & Routing Suite', () => {
  const rootDir = process.cwd();
  const notFoundPagePath = path.join(rootDir, 'src/pages/NotFound.jsx');
  const appPath = path.join(rootDir, 'src/App.jsx');

  const appContent = fs.readFileSync(appPath, 'utf8');
  const resolveRouteFnCode = appContent
    .match(/export function resolveRoute\([\s\S]*?\n\}/)[0]
    .replace('export function resolveRoute', 'function resolveRoute');
  const resolveRoute = new Function(`${resolveRouteFnCode}; return resolveRoute;`)();

  test('1. resolveRoute routes unmapped URLs to not-found page instead of redirecting to home', () => {
    // Required test cases from prompt:
    const invalidRoutes = [
      '/lkxnklxbcjmxblk',
      '/random-page',
      '/does-not-exist',
      '/anything',
      '/nested/unknown/route',
      '/some/bogus/path/here'
    ];

    for (const route of invalidRoutes) {
      const resolved = resolveRoute(route);
      assert.equal(
        resolved.page,
        'not-found',
        `Route "${route}" must resolve to page: "not-found", got: "${resolved.page}"`
      );
    }
  });

  test('2. resolveRoute preserves all existing valid routes without breaking them', () => {
    const validRoutes = [
      { path: '/', expectedPage: 'home' },
      { path: '', expectedPage: 'home' },
      { path: '/services', expectedPage: 'services' },
      { path: '/about', expectedPage: 'about' },
      { path: '/contact', expectedPage: 'contact' },
      { path: '/admin', expectedPage: 'admin' },
      { path: '/admin/dashboard', expectedPage: 'admin' },
      { path: '/driver', expectedPage: 'driver-login' },
      { path: '/driver/login', expectedPage: 'driver-login' },
      { path: '/driver/signup', expectedPage: 'driver-signup' },
      { path: '/driver/portal', expectedPage: 'driver-portal' },
      { path: '/login', expectedPage: 'login' },
      { path: '/signup', expectedPage: 'signup' },
      { path: '/reset-password', expectedPage: 'reset-password' }
    ];

    for (const { path: routePath, expectedPage } of validRoutes) {
      const resolved = resolveRoute(routePath);
      assert.equal(
        resolved.page,
        expectedPage,
        `Valid route "${routePath}" must resolve to "${expectedPage}", got "${resolved.page}"`
      );
    }
  });

  test('3. NotFound.jsx conforms to design, content, and accessibility requirements', () => {
    const content = fs.readFileSync(notFoundPagePath, 'utf8');

    // Hierarchy content
    assert.match(content, /404/, 'NotFound must display 404 code');
    assert.match(content, /Page Not Found/, 'NotFound must display "Page Not Found" heading');
    assert.match(
      content,
      /The page you're looking for doesn't exist or may have been moved\./,
      'NotFound must display required explanatory message'
    );

    // Primary Go Home button
    assert.match(content, /id="not-found-go-home-btn"/, 'NotFound must have primary Go Home button');
    assert.match(content, /Go Home/, 'Go Home button must have "Go Home" text');
    assert.match(content, /handleGoHome|onNavigateHome/, 'Go Home button must invoke internal navigation');

    // Document title management
    assert.match(content, /document\.title\s*=.*404 - Page Not Found/, 'NotFound must set document.title to 404');

    // Design language tokens
    assert.match(content, /font-\['Outfit'\]/, 'NotFound must use Outfit typography');
    assert.match(content, /bg-amber-400|from-amber-400/, 'NotFound must use brand amber accents');
    assert.match(content, /bg-slate-950/, 'NotFound must use slate-950 background');
  });

  test('4. App.jsx wires NotFound into code-split chunk and renders conditionally', () => {
    // Code splitting
    assert.match(appContent, /lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/NotFound['"]\)\)/, 'App.jsx must lazy-load NotFound');

    // Conditional rendering
    assert.match(appContent, /activePage\s*===\s*['"]not-found['"]/, 'App.jsx must conditionally render NotFound');
    assert.match(appContent, /<NotFound/, 'App.jsx must render NotFound component');
    assert.match(appContent, /onNavigateHome=\{\(\)\s*=>\s*changePage\(['"]home['"]\)\}/, 'App.jsx must pass onNavigateHome handler to changePage');
  });
});
