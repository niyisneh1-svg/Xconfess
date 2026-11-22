import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStellarAnchorProofs20261121000001
  implements MigrationInterface
{
  name = 'CreateStellarAnchorProofs20261121000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stellar_anchor_proofs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "network" varchar(16) NOT NULL,
        "contract_id" varchar(56) NOT NULL,
        "root" varchar(64) NOT NULL,
        "commitment" varchar(64) NOT NULL,
        "leaf_index" bigint NOT NULL CHECK ("leaf_index" >= 0 AND "leaf_index" <= 4294967295),
        "siblings" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_stellar_anchor_proof_identity"
          UNIQUE ("network", "contract_id", "root", "commitment", "leaf_index")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stellar_anchor_proofs_commitment"
        ON "stellar_anchor_proofs" ("network", "contract_id", "commitment");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_stellar_anchor_proofs_commitment";',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "stellar_anchor_proofs";');
  }
}
