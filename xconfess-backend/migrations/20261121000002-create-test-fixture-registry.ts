import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CreateTestFixtureRegistry20261121000002 implements MigrationInterface {
  name = 'CreateTestFixtureRegistry20261121000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'test_fixture_registry',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'name', type: 'varchar', length: '128', isUnique: true, isNullable: false },
          { name: 'origin', type: 'varchar', length: '32', isNullable: false },
          { name: 'synthetic', type: 'boolean', default: 'false', isNullable: false },
          { name: 'permittedUse', type: 'text', isNullable: false },
          { name: 'cleanupPolicy', type: 'varchar', length: '64', isNullable: false },
          { name: 'files', type: 'text', default: "'[]'", isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP', isNullable: false },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('test_fixture_registry', true);
  }
}
