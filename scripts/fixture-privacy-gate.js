#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const registryPath = path.join(ROOT, 'test-fixtures', 'registry.json');

const allowedOrigins = new Set([
  'generated-by-test',
  'repository-owned',
  'approved-vendor-synthetic',
]);
const allowedUses = new Set(['unit-test', 'integration-test', 'documentation']);
const allowedCleanup = new Set([
  'delete-after-test',
  'ephemeral-in-test-run',
  'retain-approved-anonymous',
]);

const secretPatterns = [
  { name: 'Stellar secret seed', regex: /\bS[ABCDEFGHJKLMNPQRSTUVWXYZ234567]{55}\b/g },
  { name: 'JWT', regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { name: 'GitHub PAT', regex: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
  { name: 'Stripe secret', regex: /\b(?:sk|rk)_live_[A-Za-z0-9]+\b/g },
  { name: 'AWS access key', regex: /\bAKIA[A-Z0-9]{16}\b/g },
  { name: 'Private key PEM', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

function fail(message) {
  console.error(`Fixture privacy gate failed: ${message}`);
  process.exitCode = 1;
}

function hasRealIdentifier(text) {
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  if (emails.some((email) =>
    !email.toLowerCase().endsWith('@example.com') &&
    !email.toLowerCase().endsWith('@test.invalid'))) {
    return `real-looking email address`;
  }
  if (/(?:phone|mobile|phoneNumber)\s*[:=]\s*[+0-9][0-9 ().-]{7,}/i.test(text)) {
    return 'real-looking phone number';
  }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    return 'real-looking SSN';
  }
  return null;
}

let registry;
if (!fs.existsSync(registryPath)) {
  fail(`missing registry ${path.relative(ROOT, registryPath)}`);
} else {
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    fail(`invalid registry JSON: ${error.message}`);
  }

  if (registry) {
    if (registry.version !== 1 || !Array.isArray(registry.fixtures)) {
      fail('registry must use version 1 and contain a fixtures array');
    } else {
      const names = new Set();
      for (const fixture of registry.fixtures) {
        if (!fixture || typeof fixture.name !== 'string' || fixture.name.length < 3) {
          fail('fixture name must be at least 3 characters');
          continue;
        }
        if (names.has(fixture.name)) fail(`duplicate fixture name: ${fixture.name}`);
        names.add(fixture.name);
        if (!allowedOrigins.has(fixture.origin)) {
          fail(`${fixture.name}: invalid fixture origin`);
        }
        if (fixture.synthetic !== true) {
          fail(`${fixture.name}: real or unspecified data is forbidden`);
        }
        if (!Array.isArray(fixture.permittedUse) || fixture.permittedUse.length === 0 ||
          fixture.permittedUse.some((use) => !allowedUses.has(use))) {
          fail(`${fixture.name}: permitted use is missing or invalid`);
        }
        if (!allowedCleanup.has(fixture.cleanupPolicy)) {
          fail(`${fixture.name}: cleanup policy is missing or invalid`);
        }
        if (!Array.isArray(fixture.files) || fixture.files.length === 0) {
          fail(`${fixture.name}: at least one fixture file is required`);
          continue;
        }

        for (const file of fixture.files) {
          if (typeof file !== 'string' || file.includes('..') || path.isAbsolute(file)) {
            fail(`${fixture.name}: unsafe fixture path`);
            continue;
          }
          const absolute = path.resolve(ROOT, file);
          if (!fs.existsSync(absolute)) {
            fail(`${fixture.name}: missing fixture file ${file}`);
            continue;
          }
          const text = fs.readFileSync(absolute, 'utf8');
          for (const pattern of secretPatterns) {
            if (pattern.regex.test(text)) {
              fail(`${fixture.name}: disallowed ${pattern.name} in ${file}`);
            }
            pattern.regex.lastIndex = 0;
          }
          const identifier = hasRealIdentifier(text);
          if (identifier) {
            fail(`${fixture.name}: disallowed ${identifier} in ${file}`);
          }
        }
      }
    }
  }
}

if (!process.exitCode) {
  console.log(`Fixture privacy gate passed: ${registry?.fixtures?.length ?? 0} synthetic fixtures registered.`);
}
