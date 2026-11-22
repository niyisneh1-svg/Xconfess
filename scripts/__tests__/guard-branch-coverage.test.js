'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { validateCoverage } = require('../guard-branch-coverage');

const now = new Date('2026-11-21T00:00:00.000Z');
const file = 'src/auth/admin.guard.ts';
const coverage = {
  '/workspaces/Xconfess/xconfess-backend/src/auth/admin.guard.ts': {
    branchMap: {
      0: {
        type: 'if',
        loc: { start: { line: 10, column: 0 }, end: { line: 10, column: 20 } },
        locations: [
          { start: { line: 10, column: 0 }, end: { line: 10, column: 10 } },
          { start: { line: 10, column: 11 }, end: { line: 10, column: 20 } },
        ],
      },
    },
    b: { 0: [1, 0] },
  },
};

describe('guard branch coverage validation', () => {
  it('fails uncovered branches without an explicit reviewed exception', () => {
    const result = validateCoverage(coverage, { version: 1, exceptions: [] }, now);
    assert.ok(result.errors.includes(
      'uncovered branch requires a reviewed exception: src/auth/admin.guard.ts:10:if:1',
    ));
  });

  it('accepts a current, reviewed exception for the exact uncovered branch', () => {
    const exception = {
      file,
      line: 10,
      type: 'if',
      branchIndex: 1,
      reason: 'Unreachable for the authenticated request type.',
      reviewer: 'security-team',
      reviewRef: '#884',
      reviewedAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    };
    const result = validateCoverage(
      coverage,
      { version: 1, exceptions: [exception] },
      now,
    );
    assert.equal(result.excepted, 1);
    assert.ok(result.errors.every((error) =>
      error.startsWith('coverage report is missing selected file:'),
    ));
  });

  it('rejects stale exceptions and incomplete review metadata', () => {
    const stale = {
      file,
      line: 10,
      type: 'if',
      branchIndex: 0,
      reason: 'Already covered branch.',
      reviewer: 'security-team',
      reviewRef: '#884',
      reviewedAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    };
    const result = validateCoverage(
      coverage,
      { version: 1, exceptions: [stale, { ...stale, branchIndex: 1, reviewer: '' }] },
      now,
    );
    assert.ok(result.errors.some((error) => error.includes('exception is stale')));
    assert.ok(result.errors.some((error) => error.includes('must include')));
  });

  it('fails closed when the coverage report omits selected source files', () => {
    const result = validateCoverage(coverage, { version: 1, exceptions: [] }, now);
    assert.ok(result.errors.some((error) =>
      error.includes('coverage report is missing selected file: src/auth/guards/step-up.guard.ts'),
    ));
  });
});
