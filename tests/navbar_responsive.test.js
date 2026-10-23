import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Navbar Device Responsiveness & Adaptive Navigation Suite', () => {
  const navbarPath = path.resolve('src/components/Navbar.jsx');

  test('1. Mobile drawer toggle button provides accessible aria attributes and responsive touch sizes', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /aria-label="Toggle Navigation Menu"/, 'Should have aria-label for accessibility');
    assert.match(content, /aria-expanded=\{mobileMenuOpen\}/, 'Should track aria-expanded state');
    assert.match(content, /aria-controls="mobile-nav-drawer"/, 'Should reference mobile-nav-drawer');
    assert.match(content, /min-w-\[38px\]|min-h-\[38px\]/, 'Should guarantee minimum comfortable mobile touch targets');
  });

  test('2. Mobile drawer supports Escape key closure and prevents background scroll lock', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /e\.key === 'Escape'/, 'Should close drawer on Escape key');
    assert.match(content, /document\.body\.style\.overflow = 'hidden'/, 'Should lock body scroll when mobile menu is active');
    assert.match(content, /document\.body\.style\.overflow = ''/, 'Should restore body scroll on close');
  });

  test('3. Mobile drawer provides backdrop scrim for tap-to-dismiss functionality', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /fixed inset-0/, 'Should have a backdrop scrim covering the screen');
    assert.match(content, /backdrop-blur/, 'Should apply backdrop blur for premium look');
    assert.match(content, /setMobileMenuOpen\(false\)/, 'Should dismiss drawer when backdrop is tapped');
  });

  test('4. Primary navigation items include icons and active indicators in mobile drawer', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /Home/, 'Should have Home link');
    assert.match(content, /Services/, 'Should have Services link');
    assert.match(content, /About/, 'Should have About link');
    assert.match(content, /Contact/, 'Should have Contact link');
    assert.match(content, /ChevronRight/, 'Should display navigation arrow indicators');
  });

  test('5. Customer auth buttons (Login/Signup) are removed from desktop and mobile drawer', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.doesNotMatch(content, /Log In|Login/, 'Navbar must not contain customer login buttons');
    assert.doesNotMatch(content, /Sign Up|Signup/, 'Navbar must not contain customer signup buttons');
  });

  test('6. Customer profile and logout controls are removed from mobile drawer', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.doesNotMatch(content, /My Profile & Ride History/, 'Navbar must not contain customer profile controls');
  });

  test('7. Desktop navbar renders links on lg+ and does not include Rent Vehicle button', () => {
    const content = fs.readFileSync(navbarPath, 'utf8');
    assert.match(content, /hidden lg:flex/, 'Desktop navigation links should show on lg screens and up');
    assert.doesNotMatch(content, /Rent Vehicle|Rent a Vehicle/, 'Navbar should NOT include Rent Vehicle button');
  });
});
