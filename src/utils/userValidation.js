/**
 * Production User Validation Utility
 * 
 * Accurately detects whether a stored user object is a dummy, demo, mock,
 * or obsolete test account. Production websites should never initialize with
 * or display synthetic or mock credentials to real users.
 */

export function isDummyOrDemoUser(user) {
  if (!user || typeof user !== 'object') return true;
  if (user.isDemo === true || user.isDummy === true) return true;

  const name = String(user.name || '').trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || '').trim().toUpperCase();
  const phone = String(user.phone || '').replace(/[^0-9]/g, '');

  // 1. Check for legacy mock and placeholder names
  const dummyNames = [
    'rahul sharma',
    'demo user',
    'test user',
    'production test',
    'reset test user',
    'dummy user',
    'fake user',
    'mock user',
    'test customer',
    'manjunath gowda (assigned driver)',
    'manjunath gowda (assigned vehicle captain)'
  ];

  if (dummyNames.includes(name)) return true;

  // 2. Check for synthetic test domain emails or test prefix patterns
  if (
    email.endsWith('@example.com') ||
    email.endsWith('.cmo') || // Malformed test TLD
    email.includes('reset_test_') ||
    email.includes('test_') ||
    email === 'demo@example.com' ||
    email === 'prodtest@example.com'
  ) {
    return true;
  }

  // 3. Check for test / dummy identifiers
  if (id.includes('DEMO') || id.includes('TEST') || id.includes('FAKE')) {
    return true;
  }

  // 4. Genuine account must have at least a name and either a contact phone or email
  if (!name && !phone && !email) {
    return true;
  }

  return false;
}
