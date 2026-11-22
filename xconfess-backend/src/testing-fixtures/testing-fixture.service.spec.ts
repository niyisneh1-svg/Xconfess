import { BadRequestException } from '@nestjs/common';
import { TestingFixtureService } from './testing-fixture.service';

const baseFixture = {
  name: 'synthetic-auth-fixture',
  origin: 'repository-owned' as const,
  synthetic: true,
  permittedUse: ['unit-test' as const],
  cleanupPolicy: 'delete-after-test' as const,
  files: ['test-fixtures/auth.json'],
};

describe('TestingFixtureService', () => {
  it('registers a valid synthetic fixture and exposes only aggregate metadata', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'fixture-id', ...value, createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new TestingFixtureService(repository as any);

    const result = await service.register(baseFixture);

    expect(result).toEqual(baseFixture);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects real fixtures and missing cleanup metadata', async () => {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const service = new TestingFixtureService(repository as any);

    await expect(service.register({ ...baseFixture, synthetic: false }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register({ ...baseFixture, cleanupPolicy: 'not-a-policy' as any }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid permitted use and unsafe fixture paths', async () => {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const service = new TestingFixtureService(repository as any);

    await expect(service.register({ ...baseFixture, permittedUse: ['production' as any] }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register({ ...baseFixture, files: ['../../real/data.json'] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists compatibility-safe fixture records', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        { id: 'id', ...baseFixture, createdAt: new Date(), updatedAt: new Date() },
      ]),
    };
    const service = new TestingFixtureService(repository as any);
    await expect(service.list()).resolves.toEqual([baseFixture]);
  });
});
