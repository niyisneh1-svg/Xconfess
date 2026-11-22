import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateJourneyOperationSamples20261121000001
  implements MigrationInterface
{
  name = 'CreateJourneyOperationSamples20261121000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'journey_operation_samples',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'journey', type: 'varchar', length: '16', isNullable: false },
          { name: 'outcome', type: 'varchar', length: '16', isNullable: false },
          { name: 'latencyMs', type: 'integer', isNullable: false },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'journey_operation_samples',
      new TableIndex({
        name: 'IDX_journey_operation_samples_journey_created',
        columnNames: ['journey', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('journey_operation_samples', true);
  }
}
