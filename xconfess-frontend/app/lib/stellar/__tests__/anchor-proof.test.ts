import { createHash, webcrypto } from 'crypto';
import {
  AnchorInclusionProof,
  verifyAnchorInclusionProof,
} from '../anchor-proof';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

const sha256 = (value: Buffer) =>
  createHash('sha256').update(value).digest('hex');

describe('verifyAnchorInclusionProof', () => {
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
  const proof: AnchorInclusionProof = {
    commitment,
    root,
    leafIndex: 0,
    siblings: [sibling],
  };

  it('independently accepts a valid proof and rejects altered inputs', async () => {
    await expect(verifyAnchorInclusionProof(proof)).resolves.toBe(true);
    await expect(
      verifyAnchorInclusionProof({ ...proof, commitment: '33'.repeat(32) }),
    ).resolves.toBe(false);
    await expect(
      verifyAnchorInclusionProof({ ...proof, leafIndex: 1 }),
    ).resolves.toBe(false);
  });
});
