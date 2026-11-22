import { createHash } from 'crypto';
import { AnchorProofService } from './anchor-proof.service';
import { StellarConfigService } from './stellar-config.service';
import { ContractService } from './contract.service';
import { StellarAnchorProof } from './entities/stellar-anchor-proof.entity';

const sha256 = (value: Buffer) =>
  createHash('sha256').update(value).digest('hex');

describe('AnchorProofService', () => {
  const commitment = '11'.repeat(32);
  const sibling = '22'.repeat(32);
  const leaf = Buffer.from(
    sha256(Buffer.concat([Buffer.from([0]), Buffer.from(commitment, 'hex')])),
    'hex',
  );
  const siblingLeaf = Buffer.from(
    sha256(Buffer.concat([Buffer.from([0]), Buffer.from(sibling, 'hex')])),
    'hex',
  );
  const root = sha256(
    Buffer.concat([Buffer.from([1]), leaf, siblingLeaf]),
  );
  let contractService: { verifyAnchorRoot: jest.Mock };
  let repository: { upsert: jest.Mock; find: jest.Mock };
  let service: AnchorProofService;

  beforeEach(() => {
    contractService = {
      verifyAnchorRoot: jest.fn().mockResolvedValue(81),
    };
    repository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([] as StellarAnchorProof[]),
    };
    service = new AnchorProofService(
      {
        getConfig: () => ({ network: 'testnet' }),
        getContractId: () => 'C_ANCHOR',
      } as unknown as StellarConfigService,
      contractService as unknown as ContractService,
      repository as unknown as any,
    );
  });

  it('stores a valid proof only after its root is found on the configured chain', async () => {
    const result = await service.verifyAndStore({
      commitment,
      root,
      leafIndex: 0,
      siblings: [sibling],
    });

    expect(result).toMatchObject({
      verified: true,
      network: 'testnet',
      contractId: 'C_ANCHOR',
      root,
      commitment,
      leafIndex: 0,
      rootRecordedAtLedger: 81,
    });
    expect(contractService.verifyAnchorRoot).toHaveBeenCalledWith(root);
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'testnet', contractId: 'C_ANCHOR' }),
      ['network', 'contractId', 'root', 'commitment', 'leafIndex'],
    );
  });

  it('does not query or persist a proof whose path does not match the root', async () => {
    const result = await service.verifyAndStore({
      commitment,
      root,
      leafIndex: 0,
      siblings: ['33'.repeat(32)],
    });

    expect(result).toMatchObject({
      verified: false,
      reason: 'proof_mismatch',
    });
    expect(contractService.verifyAnchorRoot).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('does not persist a valid path when the root was never recorded on-chain', async () => {
    contractService.verifyAnchorRoot.mockResolvedValue(null);

    const result = await service.verifyAndStore({
      commitment,
      root,
      leafIndex: 0,
      siblings: [sibling],
    });

    expect(result).toMatchObject({
      verified: false,
      reason: 'root_not_recorded',
    });
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('propagates RPC outages instead of reporting an invalid proof', async () => {
    contractService.verifyAnchorRoot.mockRejectedValue(
      new Error('RPC unavailable'),
    );

    await expect(
      service.verifyAndStore({
        commitment,
        root,
        leafIndex: 0,
        siblings: [sibling],
      }),
    ).rejects.toThrow('RPC unavailable');
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});
