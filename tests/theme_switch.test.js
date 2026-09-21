import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Navbar Icon-Only Theme Switch & Eye-Friendly Light Theme Tests', () => {
  const homePagePath = path.resolve('src/pages/HomePage.jsx');
  const navbarPath = path.resolve('src/components/Navbar.jsx');
  const themeContextPath = path.resolve('src/utils/themeContext.jsx');
  const indexCssPath = path.resolve('src/index.css');
  const mainPath = path.resolve('src/main.jsx');

  test('1. ThemeContext provides theme state, toggleTheme, and persists to localStorage', () => {
    const content = fs.readFileSync(themeContextPath, 'utf8');
    assert.match(content, /createContext/, 'ThemeContext should be created');
    assert.match(content, /ThemeProvider/, 'ThemeProvider should be exported');
    assert.match(content, /useTheme/, 'useTheme hook should be exported');
    assert.match(content, /bda_theme/, 'Theme should be persisted using bda_theme in localStorage');
    assert.match(content, /toggleTheme/, 'toggleTheme function should be provided');
  });

  test('2. Main entry point wraps application in ThemeProvider', () => {
    const content = fs.readFileSync(mainPath, 'utf8');
    assert.match(content, /<ThemeProvider>/, 'main.jsx should wrap App in ThemeProvider');
  });

  test('3. HomePage does NOT contain theme toggle buttons (only on navbar)', () => {
    const content = fs.readFileSync(homePagePath, 'utf8');
    assert.doesNotMatch(content, /home-switch-theme-btn/, 'HomePage hero should not have theme switch button');
    assert.doesNotMatch(content, /home-floating-theme-toggle/, 'HomePage should not have floating theme button');
  });

  test('4. Navbar includes theme switch button and it is icon-only with NO "dark" or "light" text', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /id="navbar-theme-toggle-btn"/, 'Navbar should have theme toggle button');
    assert.match(content, /toggleTheme/, 'Navbar button should trigger toggleTheme');

    // Extract the navbar button code block
    const btnMatch = content.match(/<button[^>]*id="navbar-theme-toggle-btn"[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(btnMatch, 'navbar-theme-toggle-btn should be found in Navbar');
    const btnInner = btnMatch[1];

    // Must NOT contain visible text saying "dark" or "light"
    assert.doesNotMatch(btnInner, />\s*(dark|light|dark mode|light mode)\s*</i, 'Button should not render text saying dark or light');
    // Must render Sun or Moon icons
    assert.match(btnInner, /<Sun/, 'Button should render Sun icon in dark mode');
    assert.match(btnInner, /<Moon/, 'Button should render Moon icon in light mode');
  });

  test('5. index.css defines eye-friendly, muted, less bright light theme', () => {
    const content = fs.readFileSync(indexCssPath, 'utf8');
    assert.match(content, /html\.light/, 'index.css should define html.light styles');
    assert.match(content, /html\.light \.card-surface/, 'index.css should style card-surface in light mode');
    // Verify soft low-glare slate backgrounds instead of harsh 100% white
    assert.match(content, /#dde2ea/, 'index.css should use soft low-glare slate background');
    assert.match(content, /#eaedf3|#f1f4f8/, 'index.css should use soft muted card background');
  });
});
