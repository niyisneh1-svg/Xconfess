import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('stellar_anchor_proofs')
@Unique('uq_stellar_anchor_proof_identity', [
  'network',
  'contractId',
  'root',
  'commitment',
  'leafIndex',
])
@Index('idx_stellar_anchor_proofs_commitment', ['network', 'contractId', 'commitment'])
export class StellarAnchorProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  network: string;

  @Column({ name: 'contract_id', type: 'varchar', length: 56 })
  contractId: string;

  @Column({ type: 'varchar', length: 64 })
  root: string;

  @Column({ type: 'varchar', length: 64 })
  commitment: string;

  @Column({ name: 'leaf_index', type: 'bigint' })
  leafIndex: string;

  @Column({ type: 'jsonb' })
  siblings: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
