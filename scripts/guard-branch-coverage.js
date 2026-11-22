#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'xconfess-backend');
const EXCEPTIONS_PATH = path.join(ROOT, '.github', 'guard-coverage-exceptions.json');
const SELECTED_FILES = [
  'src/auth/admin.guard.ts',
  'src/auth/capabilities/capability.guard.ts',
  'src/auth/guards/moderation-access-grant.guard.ts',
  'src/auth/guards/step-up.guard.ts',
  'src/common/guards/ownership.guard.ts',
];
const SELECTED_TESTS = [
  'src/auth/admin.guard.spec.ts',
  'src/auth/capabilities/capability.guard.spec.ts',
  'src/auth/guards/moderation-access-grant.guard.spec.ts',
  'src/auth/guards/step-up.guard.spec.ts',
  'src/common/guards/ownership.guard.spec.ts',
];
const MAX_EXCEPTION_AGE_DAYS = 90;

function branchKey(file, line, type, branchIndex) {
  return `${file}:${line}:${type}:${branchIndex}`;
}

function validateCoverage(coverage, manifest, now = new Date()) {
  const errors = [];
  const branches = [];
  const exceptions = new Map();
  const seenFiles = new Set();

  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.exceptions)) {
    return { errors: ['exception manifest must use version 1 and contain exceptions'], branches };
  }

  for (const exception of manifest.exceptions) {
    if (!exception || typeof exception !== 'object') {
      errors.push('each exception must be an object');
      continue;
    }
    const required = ['file', 'line', 'type', 'branchIndex', 'reason', 'reviewer', 'reviewRef', 'reviewedAt', 'expiresAt'];
    if (required.some((field) => exception[field] === undefined || exception[field] === '')) {
      errors.push('each exception must include file, branch coordinates, reason, reviewer, reviewRef, reviewedAt, and expiresAt');
      continue;
    }
    if (!SELECTED_FILES.includes(exception.file) ||
      !Number.isInteger(exception.line) ||
      !Number.isInteger(exception.branchIndex) ||
      typeof exception.type !== 'string' ||
      typeof exception.reason !== 'string' || exception.reason.trim().length < 20 ||
      typeof exception.reviewer !== 'string' || exception.reviewer.trim().length < 2 ||
      !/^#\d+$/.test(exception.reviewRef)) {
      errors.push(`invalid exception metadata for ${exception.file}`);
      continue;
    }
    const reviewedAt = Date.parse(exception.reviewedAt);
    const expiresAt = Date.parse(exception.expiresAt);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(expiresAt) ||
      reviewedAt > now.getTime() || expiresAt <= now.getTime() ||
      expiresAt - reviewedAt > MAX_EXCEPTION_AGE_DAYS * 24 * 60 * 60 * 1000) {
      errors.push(`exception for ${exception.file}:${exception.line} must have a current review and expire within 90 days`);
      continue;
    }
    const key = branchKey(exception.file, exception.line, exception.type, exception.branchIndex);
    if (exceptions.has(key)) {
      errors.push(`duplicate exception for ${key}`);
    } else {
      exceptions.set(key, exception);
    }
  }

  for (const [absolutePath, fileCoverage] of Object.entries(coverage || {})) {
    const file = path.relative(BACKEND, absolutePath).split(path.sep).join('/');
    if (!SELECTED_FILES.includes(file)) continue;
    seenFiles.add(file);
    for (const [id, branch] of Object.entries(fileCoverage.branchMap || {})) {
      const counts = fileCoverage.b?.[id] || [];
      const locations = branch.locations?.length ? branch.locations : [branch.loc];
      locations.forEach((location, branchIndex) => {
        const key = branchKey(file, location.start.line, branch.type, branchIndex);
        const count = counts[branchIndex] || 0;
        const exception = exceptions.get(key);
        branches.push({ key, file, line: location.start.line, covered: count > 0, excepted: Boolean(exception) });
        if (count === 0 && !exception) errors.push(`uncovered branch requires a reviewed exception: ${key}`);
        if (count > 0 && exception) errors.push(`exception is stale because branch is covered: ${key}`);
        if (exception) exceptions.delete(key);
      });
    }
  }

  for (const file of SELECTED_FILES) {
    if (!seenFiles.has(file)) errors.push(`coverage report is missing selected file: ${file}`);
  }
  if (branches.length === 0) errors.push('coverage report contains no selected branches');

  for (const staleKey of exceptions.keys()) {
    errors.push(`exception does not match a current uncovered branch: ${staleKey}`);
  }

  const excepted = branches.filter((branch) => branch.excepted).length;
  return {
    errors,
    branches,
    covered: branches.filter((branch) => branch.covered).length,
    excepted,
    total: branches.length,
  };
}

function run() {
  const coverageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'xconfess-guard-coverage-'));
  try {
    const jestBin = require.resolve('jest/bin/jest', { paths: [BACKEND] });
    const result = spawnSync(process.execPath, [
      jestBin,
      '--config',
      'jest.guard-coverage.config.js',
      '--coverage',
      '--runInBand',
      '--runTestsByPath',
      ...SELECTED_TESTS,
    ], {
      cwd: BACKEND,
      env: { ...process.env, GUARD_COVERAGE_DIRECTORY: coverageDirectory },
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    if (process.exitCode) return;

    const reportPath = path.join(coverageDirectory, 'coverage-final.json');
    if (!fs.existsSync(reportPath)) {
      throw new Error('Jest did not produce coverage-final.json');
    }
    const coverage = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, 'utf8'));
    const resultSummary = validateCoverage(coverage, manifest);
    console.log(`\nSelected guard branches: ${resultSummary.covered}/${resultSummary.total} covered; ${resultSummary.excepted} reviewed exceptions.`);
    for (const error of resultSummary.errors) console.error(`✗ ${error}`);
    if (resultSummary.errors.length > 0) process.exitCode = 1;
    else console.log('✓ Guard branch coverage gate passed.');
  } catch (error) {
    console.error(`Guard branch coverage gate failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(coverageDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) run();

module.exports = { branchKey, validateCoverage };
