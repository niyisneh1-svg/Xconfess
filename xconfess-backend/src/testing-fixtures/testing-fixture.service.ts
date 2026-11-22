import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FixtureCleanupPolicy,
  FixtureOrigin,
  FixturePermittedUse,
  TestFixtureEntity,
} from './entities/test-fixture.entity';

export interface TestFixtureRecord {
  name: string;
  origin: FixtureOrigin;
  synthetic: boolean;
  permittedUse: FixturePermittedUse[];
  cleanupPolicy: FixtureCleanupPolicy;
  files: string[];
}

const ORIGINS = new Set(['generated-by-test', 'repository-owned', 'approved-vendor-synthetic']);
const PERMITTED_USES = new Set(['unit-test', 'integration-test', 'documentation']);
const CLEANUP_POLICIES = new Set([
  'delete-after-test',
  'ephemeral-in-test-run',
  'retain-approved-anonymous',
]);

@Injectable()
export class TestingFixtureService {
  constructor(
    @InjectRepository(TestFixtureEntity)
    private readonly repository: Repository<TestFixtureEntity>,
  ) {}

  async list(): Promise<TestFixtureRecord[]> {
    const records = await this.repository.find({ order: { name: 'ASC' } });
    return records.map((record) => this.toContract(record));
  }

  async register(input: TestFixtureRecord): Promise<TestFixtureRecord> {
    this.validate(input);
    const existing = await this.repository.findOne({ where: { name: input.name } });
    const record = this.repository.create({
      ...(existing ?? {}),
      name: input.name,
      origin: input.origin,
      synthetic: input.synthetic,
      permittedUse: input.permittedUse,
      cleanupPolicy: input.cleanupPolicy,
      files: input.files,
    });
    return this.toContract(await this.repository.save(record));
  }

  private validate(input: TestFixtureRecord): void {
    if (!input || typeof input.name !== 'string' || input.name.length < 3 || input.name.length > 128) {
      throw new BadRequestException({ code: 'INVALID_FIXTURE_NAME', message: 'Fixture name must be 3-128 characters.' });
    }
    if (!ORIGINS.has(input.origin)) {
      throw new BadRequestException({ code: 'INVALID_FIXTURE_ORIGIN', message: 'Fixture origin is not permitted.' });
    }
    if (input.synthetic !== true) {
      throw new BadRequestException({ code: 'REAL_FIXTURE_REJECTED', message: 'Fixtures must be synthetic.' });
    }
    if (!Array.isArray(input.permittedUse) || input.permittedUse.length === 0 ||
      input.permittedUse.some((use) => !PERMITTED_USES.has(use))) {
      throw new BadRequestException({ code: 'INVALID_PERMITTED_USE', message: 'A permitted test use is required.' });
    }
    if (!CLEANUP_POLICIES.has(input.cleanupPolicy)) {
      throw new BadRequestException({ code: 'INVALID_CLEANUP_POLICY', message: 'A cleanup policy is required.' });
    }
    if (!Array.isArray(input.files) || input.files.length === 0 ||
      input.files.some((file) => typeof file !== 'string' || file.length === 0 || file.includes('\\0') || file.includes('..'))) {
      throw new BadRequestException({ code: 'INVALID_FIXTURE_FILES', message: 'Fixture files must be bounded repository paths.' });
    }
  }

  private toContract(record: TestFixtureEntity): TestFixtureRecord {
    return {
      name: record.name,
      origin: record.origin,
      synthetic: record.synthetic,
      permittedUse: record.permittedUse,
      cleanupPolicy: record.cleanupPolicy,
      files: record.files,
    };
  }
}
