import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type JourneyName = 'publish' | 'report' | 'review';
export type JourneyOutcome = 'success' | 'failure';

@Entity('journey_operation_samples')
@Index(['journey', 'createdAt'])
export class JourneyOperationEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 16 })
  journey: JourneyName;

  @Column({ type: 'varchar', length: 16 })
  outcome: JourneyOutcome;

  @Column({ type: 'integer' })
  latencyMs: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
