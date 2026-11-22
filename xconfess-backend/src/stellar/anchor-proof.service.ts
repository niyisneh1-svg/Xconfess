import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarConfigService } from './stellar-config.service';
import { ContractService } from './contract.service';
import { VerifyAnchorProofDto } from './dto/verify-anchor-proof.dto';
import { StellarAnchorProof } from './entities/stellar-anchor-proof.entity';
import { verifyAnchorInclusionProof } from './anchor-inclusion-proof';

@Injectable()
export class AnchorProofService {
  constructor(
    private readonly stellarConfig: StellarConfigService,
    private readonly contractService: ContractService,
    @InjectRepository(StellarAnchorProof)
    private readonly proofRepository: Repository<StellarAnchorProof>,
  ) {}

  async verifyAndStore(dto: VerifyAnchorProofDto) {
    const identity = this.getIdentity();
    const proof = {
      commitment: dto.commitment.toLowerCase(),
      root: dto.root.toLowerCase(),
      leafIndex: dto.leafIndex,
      siblings: dto.siblings.map((sibling) => sibling.toLowerCase()),
    };

    if (!verifyAnchorInclusionProof(proof)) {
      return {
        verified: false,
        reason: 'proof_mismatch' as const,
        ...identity,
        ...proof,
      };
    }

    const rootRecordedAtLedger = await this.contractService.verifyAnchorRoot(
      proof.root,
    );
    if (rootRecordedAtLedger === null) {
      return {
        verified: false,
        reason: 'root_not_recorded' as const,
        ...identity,
        ...proof,
      };
    }

    await this.proofRepository.upsert(
      {
        ...identity,
        ...proof,
        leafIndex: String(proof.leafIndex),
      },
      ['network', 'contractId', 'root', 'commitment', 'leafIndex'],
    );

    return {
      verified: true,
      ...identity,
      ...proof,
      rootRecordedAtLedger,
    };
  }

  async getVerifiedProofs(commitment: string) {
    const normalizedCommitment = commitment.toLowerCase();
    const identity = this.getIdentity();
    const proofs = await this.proofRepository.find({
      where: { ...identity, commitment: normalizedCommitment },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return Promise.all(
      proofs.map(async (proof) => {
        const rootRecordedAtLedger =
          await this.contractService.verifyAnchorRoot(proof.root);
        const validPath = verifyAnchorInclusionProof({
          commitment: proof.commitment,
          root: proof.root,
          leafIndex: Number(proof.leafIndex),
          siblings: proof.siblings,
        });
        return {
          ...proof,
          leafIndex: Number(proof.leafIndex),
          verified: validPath && rootRecordedAtLedger !== null,
          reason: !validPath
            ? 'proof_mismatch'
            : rootRecordedAtLedger === null
              ? 'root_not_recorded'
              : null,
          rootRecordedAtLedger,
        };
      }),
    );
  }

  private getIdentity() {
    return {
      network: this.stellarConfig.getConfig().network,
      contractId: this.stellarConfig.getContractId('confessionAnchor'),
    };
  }
}
