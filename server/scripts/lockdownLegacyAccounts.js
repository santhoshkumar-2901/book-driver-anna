import { fileURLToPath } from 'url';
import { queryAll, queryOne, execute } from '../db/database.js';

// Deterministic compound selection criteria extracted from legacy auto-provisioning
export const KNOWN_LEGACY_ACCOUNTS = [
  {
    type: 'admin',
    expectedUserId: 'ADM-PROD-PRIMARY',
    expectedEmail: 'bookdriveranna@gmail.com',
    expectedRole: 'admin',
    canonicalPhoneLast10: '7899120704'
  },
  {
    type: 'admin',
    expectedUserId: 'ADM-PROD-ROOT',
    expectedEmail: 'admin@bookdriveranna.com',
    expectedRole: 'admin',
    canonicalPhoneLast10: '9876500000'
  },
  {
    type: 'driver',
    expectedUserId: 'USR-DRV-1001',
    expectedDriverId: 'DRV-1001',
    expectedEmail: 'manjunath.gowda@driveranna.com',
    expectedLicenseClean: 'KA0420210098745',
    expectedRole: 'driver',
    canonicalPhoneLast10: '9886012345'
  },
  {
    type: 'driver',
    expectedUserId: 'USR-DRV-1002',
    expectedDriverId: 'DRV-1002',
    expectedEmail: 'venkatesh.prasad@driveranna.com',
    expectedLicenseClean: 'KA0520200081234',
    expectedRole: 'driver',
    canonicalPhoneLast10: '9845067890'
  },
  {
    type: 'driver',
    expectedUserId: 'USR-DRV-1003',
    expectedDriverId: 'DRV-1003',
    expectedEmail: 'suresh.kumar@driveranna.com',
    expectedLicenseClean: 'KA0120190043120',
    expectedRole: 'driver',
    canonicalPhoneLast10: '9900255667'
  }
];

function cleanDigits(val) {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
}

function cleanAlphaNum(val) {
  if (!val) return '';
  return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function parseLockdownArgs(argv) {
  const isApply = argv.includes('--apply');
  const isConfirmProd = argv.includes('--confirm-production');
  return { isApply, isConfirmProd };
}

export async function lockdownLegacyAccounts(options = {}) {
  const isApply = Boolean(options.apply);
  const isConfirmProd = Boolean(options.confirmProduction);

  // Safety check: Prevent running in production without explicit confirmation
  if (process.env.NODE_ENV === 'production' && isApply && !isConfirmProd) {
    throw new Error('Safety guard: modifying production database requires --confirm-production alongside --apply.');
  }

  console.log(`[LOCKDOWN] Mode: ${isApply ? 'APPLY (Live Modifications)' : 'DRY RUN (Zero writes)'}`);
  console.log('[LOCKDOWN] Inspecting candidate accounts using compound identity verification...');

  const verifiedLegacyUsers = [];
  const verifiedLegacyDrivers = [];
  const conflicts = [];
  const skipped = [];

  // 1. Audit user candidates matching any legacy identifier (ID, email, or phone)
  const allUserIds = KNOWN_LEGACY_ACCOUNTS.map(k => k.expectedUserId);
  const allEmails = KNOWN_LEGACY_ACCOUNTS.map(k => k.expectedEmail.toLowerCase());

  // Query all users that share ANY of the legacy keys
  const candidateUsers = await queryAll(`
    SELECT id, name, email, phone, role, status
    FROM users
    WHERE id IN (${allUserIds.map(() => '?').join(',')})
       OR LOWER(email) IN (${allEmails.map(() => '?').join(',')})
  `, [...allUserIds, ...allEmails]);

  // Also fetch users whose phone numbers match any legacy phone
  for (const template of KNOWN_LEGACY_ACCOUNTS) {
    const phoneCandidates = await queryAll(`
      SELECT id, name, email, phone, role, status
      FROM users
      WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
    `, [`%${template.canonicalPhoneLast10}`]);

    for (const pc of phoneCandidates) {
      if (!candidateUsers.some(u => u.id === pc.id)) {
        candidateUsers.push(pc);
      }
    }
  }

  // Verify each candidate user using strict compound matching
  for (const user of candidateUsers) {
    const userEmail = (user.email || '').toLowerCase().trim();
    const userPhoneDigits = cleanDigits(user.phone).slice(-10);
    const userRole = (user.role || '').toLowerCase().trim();

    // Find if there is a matching legacy template
    const templateById = KNOWN_LEGACY_ACCOUNTS.find(t => t.expectedUserId === user.id);
    const templateByEmail = KNOWN_LEGACY_ACCOUNTS.find(t => t.expectedEmail.toLowerCase() === userEmail);
    const templateByPhone = KNOWN_LEGACY_ACCOUNTS.find(t => t.canonicalPhoneLast10 === userPhoneDigits);

    const relevantTemplate = templateById || templateByEmail || templateByPhone;

    if (!relevantTemplate) {
      continue;
    }

    // Verify all expected compound identity fields
    const isIdMatch = user.id === relevantTemplate.expectedUserId;
    const isEmailMatch = userEmail === relevantTemplate.expectedEmail.toLowerCase();
    const isRoleMatch = userRole === relevantTemplate.expectedRole.toLowerCase();
    const isPhoneMatch = !userPhoneDigits || userPhoneDigits === relevantTemplate.canonicalPhoneLast10;

    const isExactCompoundMatch = isIdMatch && isEmailMatch && isRoleMatch && isPhoneMatch;

    if (isExactCompoundMatch) {
      verifiedLegacyUsers.push(user);
    } else {
      // Conflict detected! A legitimate or altered account reuses a legacy phone, email, or id
      const conflictReason = `User [${user.id}] role='${user.role}' email='${user.email}' phone='${user.phone}' ` +
        `partially matched legacy template '${relevantTemplate.expectedUserId}', but failed compound verification ` +
        `(idMatch=${isIdMatch}, emailMatch=${isEmailMatch}, roleMatch=${isRoleMatch}, phoneMatch=${isPhoneMatch}).`;

      conflicts.push({
        type: 'user',
        userId: user.id,
        reason: conflictReason
      });
      skipped.push({
        type: 'user',
        userId: user.id,
        reason: 'CONFLICT_PREVENTED_LOCKOUT'
      });
      console.warn(`[LOCKDOWN CONFLICT] Skipped user account to prevent false positive: ${conflictReason}`);
    }
  }

  // 2. Audit driver candidates matching legacy driver templates
  const driverTemplates = KNOWN_LEGACY_ACCOUNTS.filter(t => t.type === 'driver');
  const allDriverIds = driverTemplates.map(t => t.expectedDriverId);
  const allDriverUserIds = driverTemplates.map(t => t.expectedUserId);

  const candidateDrivers = await queryAll(`
    SELECT id, user_id, name, phone, license_number, status
    FROM drivers
    WHERE id IN (${allDriverIds.map(() => '?').join(',')})
       OR user_id IN (${allDriverUserIds.map(() => '?').join(',')})
  `, [...allDriverIds, ...allDriverUserIds]);

  for (const template of driverTemplates) {
    const phoneCandidates = await queryAll(`
      SELECT id, user_id, name, phone, license_number, status
      FROM drivers
      WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
    `, [`%${template.canonicalPhoneLast10}`]);

    for (const pc of phoneCandidates) {
      if (!candidateDrivers.some(d => d.id === pc.id)) {
        candidateDrivers.push(pc);
      }
    }
  }

  for (const driver of candidateDrivers) {
    const driverPhoneDigits = cleanDigits(driver.phone).slice(-10);
    const driverDlClean = cleanAlphaNum(driver.license_number);

    const templateById = driverTemplates.find(t => t.expectedDriverId === driver.id);
    const templateByUserId = driverTemplates.find(t => t.expectedUserId === driver.user_id);
    const templateByPhone = driverTemplates.find(t => t.canonicalPhoneLast10 === driverPhoneDigits);
    const templateByDl = driverTemplates.find(t => t.expectedLicenseClean === driverDlClean);

    const relevantTemplate = templateById || templateByUserId || templateByPhone || templateByDl;

    if (!relevantTemplate) {
      continue;
    }

    const isDriverIdMatch = driver.id === relevantTemplate.expectedDriverId;
    const isUserIdMatch = driver.user_id === relevantTemplate.expectedUserId;
    const isLicenseMatch = driverDlClean === relevantTemplate.expectedLicenseClean;
    const isPhoneMatch = !driverPhoneDigits || driverPhoneDigits === relevantTemplate.canonicalPhoneLast10;

    const isExactCompoundMatch = isDriverIdMatch && isUserIdMatch && isLicenseMatch && isPhoneMatch;

    if (isExactCompoundMatch) {
      verifiedLegacyDrivers.push(driver);
    } else {
      const conflictReason = `Driver [${driver.id}] user_id='${driver.user_id}' DL='${driver.license_number}' phone='${driver.phone}' ` +
        `partially matched template '${relevantTemplate.expectedDriverId}', but failed compound verification ` +
        `(driverIdMatch=${isDriverIdMatch}, userIdMatch=${isUserIdMatch}, licenseMatch=${isLicenseMatch}, phoneMatch=${isPhoneMatch}).`;

      conflicts.push({
        type: 'driver',
        driverId: driver.id,
        reason: conflictReason
      });
      skipped.push({
        type: 'driver',
        driverId: driver.id,
        reason: 'CONFLICT_PREVENTED_LOCKOUT'
      });
      console.warn(`[LOCKDOWN CONFLICT] Skipped driver profile to prevent false positive: ${conflictReason}`);
    }
  }

  // Report Summary
  console.log(`\n[LOCKDOWN SUMMARY]`);
  console.log(`  - Matched Verified Legacy Users: ${verifiedLegacyUsers.length}`);
  console.log(`  - Matched Verified Legacy Drivers: ${verifiedLegacyDrivers.length}`);
  console.log(`  - Conflicts Detected & Safely Skipped: ${conflicts.length}`);

  for (const u of verifiedLegacyUsers) {
    console.log(`  - VERIFIED USER: [${u.id}] ${u.name} | ${u.email} | ${u.phone} | role: ${u.role} | status: ${u.status} -> TARGET: status='Inactive', password_hash='*LOCKED*'`);
  }
  for (const d of verifiedLegacyDrivers) {
    console.log(`  - VERIFIED DRIVER: [${d.id}] ${d.name} | DL: ${d.license_number} | status: ${d.status} -> TARGET: status='Inactive'`);
  }

  if (!isApply) {
    console.log('\n[LOCKDOWN] DRY RUN complete. 0 writes performed. To apply changes, run with --apply.');
    return {
      dryRun: true,
      matchedUsersCount: verifiedLegacyUsers.length,
      matchedDriversCount: verifiedLegacyDrivers.length,
      conflictsCount: conflicts.length,
      skippedCount: skipped.length,
      conflicts,
      skipped,
      modifiedUsersCount: 0,
      modifiedDriversCount: 0
    };
  }

  // Live Apply: modify status and password_hash ONLY for positively verified accounts. NEVER DELETE.
  let modifiedUsersCount = 0;
  if (verifiedLegacyUsers.length > 0) {
    const userIds = verifiedLegacyUsers.map(u => u.id);
    const placeholders = userIds.map(() => '?').join(',');
    await execute(
      `UPDATE users SET password_hash = '*LOCKED*', status = 'Inactive' WHERE id IN (${placeholders})`,
      userIds
    );
    modifiedUsersCount = userIds.length;
  }

  let modifiedDriversCount = 0;
  if (verifiedLegacyDrivers.length > 0) {
    const driverIds = verifiedLegacyDrivers.map(d => d.id);
    const placeholders = driverIds.map(() => '?').join(',');
    await execute(
      `UPDATE drivers SET status = 'Inactive' WHERE id IN (${placeholders})`,
      driverIds
    );
    modifiedDriversCount = driverIds.length;
  }

  console.log(`\n[LOCKDOWN] APPLY complete. Modified ${modifiedUsersCount} users and ${modifiedDriversCount} drivers. Zero deletions performed.`);

  return {
    dryRun: false,
    matchedUsersCount: verifiedLegacyUsers.length,
    matchedDriversCount: verifiedLegacyDrivers.length,
    conflictsCount: conflicts.length,
    skippedCount: skipped.length,
    conflicts,
    skipped,
    modifiedUsersCount,
    modifiedDriversCount
  };
}

// CLI Execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { isApply, isConfirmProd } = parseLockdownArgs(process.argv.slice(2));
  lockdownLegacyAccounts({ apply: isApply, confirmProduction: isConfirmProd })
    .then((result) => {
      console.log('[LOCKDOWN] Finished:', JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[LOCKDOWN ERROR]:', err.message);
      process.exit(1);
    });
}
