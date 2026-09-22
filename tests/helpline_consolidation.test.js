import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SUPPORT_HELPLINE } from '../src/data/mockData.js';

describe('Part 1: Consolidated Support Helpline Number Suite', () => {
  test('1. SUPPORT_HELPLINE constant is defined in mockData.js with real number and temporary comment', () => {
    assert.strictEqual(SUPPORT_HELPLINE, '+91 78991 20704', 'SUPPORT_HELPLINE should match real contact number');
    const mockDataContent = fs.readFileSync(path.resolve('src/data/mockData.js'), 'utf8');
    assert.match(mockDataContent, /\/\/.*temporary admin number pending a dedicated support line/i, 'Should have temporary admin note comment');
    assert.match(mockDataContent, /export const SUPPORT_HELPLINE = '\+91 78991 20704';/, 'Should export SUPPORT_HELPLINE');
  });

  test('2. Consolidated components import and use SUPPORT_HELPLINE', () => {
    const filesToCheck = [
      'src/components/Footer.jsx',
      'src/components/RidePaymentModal.jsx',
      'src/components/UserProfileModal.jsx',
      'src/components/CancelBookingModal.jsx',
      'src/services/geminiService.js',
      'src/App.jsx'
    ];

    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.resolve(relPath), 'utf8');
      assert.match(content, /SUPPORT_HELPLINE/, `${relPath} should import/use SUPPORT_HELPLINE`);
      assert.doesNotMatch(content, /\+91 80 2555 0199/, `${relPath} should not contain old fake landline number`);
      assert.doesNotMatch(content, /\+91 98765 43210/, `${relPath} should not contain old fake helpline number`);
    }
  });
});
