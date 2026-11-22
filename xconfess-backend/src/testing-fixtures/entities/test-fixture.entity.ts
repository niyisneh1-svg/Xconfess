import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type FixtureOrigin =
  | 'generated-by-test'
  | 'repository-owned'
  | 'approved-vendor-synthetic';
export type FixturePermittedUse =
  | 'unit-test'
  | 'integration-test'
  | 'documentation';
export type FixtureCleanupPolicy =
  | 'delete-after-test'
  | 'ephemeral-in-test-run'
  | 'retain-approved-anonymous';

@Entity('test_fixture_registry')
export class TestFixtureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  origin: FixtureOrigin;

  @Column({ type: 'boolean', default: false })
  synthetic: boolean;

  @Column({ type: 'simple-json' })
  permittedUse: FixturePermittedUse[];

  @Column({ type: 'varchar', length: 64 })
  cleanupPolicy: FixtureCleanupPolicy;

  @Column({ type: 'simple-json', default: '[]' })
  files: string[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
