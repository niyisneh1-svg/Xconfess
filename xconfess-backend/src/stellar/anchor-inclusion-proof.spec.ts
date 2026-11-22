import { createHash } from 'crypto';
import {
  AnchorInclusionProofInput,
  verifyAnchorInclusionProof,
} from './anchor-inclusion-proof';

const sha256 = (value: Buffer) =>
  createHash('sha256').update(value).digest('hex');

describe('verifyAnchorInclusionProof', () => {
  const commitment = '11'.repeat(32);
  const sibling = '22'.repeat(32);
  const leaf = Buffer.from(sha256(Buffer.concat([Buffer.from([0]), Buffer.from(commitment, 'hex')])), 'hex');
  const siblingLeaf = Buffer.from(sha256(Buffer.concat([Buffer.from([0]), Buffer.from(sibling, 'hex')])), 'hex');
  const root = sha256(
    Buffer.concat([Buffer.from([1]), leaf, siblingLeaf]),
  );
  const validProof: AnchorInclusionProofInput = {
    commitment,
    root,
    leafIndex: 0,
    siblings: [sibling],
  };

  it('accepts a commitment with a correctly ordered path', () => {
    expect(verifyAnchorInclusionProof(validProof)).toBe(true);
  });

  it('rejects altered commitments, roots, sibling paths, and directions', () => {
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        commitment: '33'.repeat(32),
      }),
    ).toBe(false);
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        root: '44'.repeat(32),
      }),
    ).toBe(false);
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        siblings: ['55'.repeat(32)],
      }),
    ).toBe(false);
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        leafIndex: 1,
      }),
    ).toBe(false);
  });

  it('rejects malformed or out-of-range proof input', () => {
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        commitment: 'not-a-hash',
      }),
    ).toBe(false);
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        leafIndex: 2,
      }),
    ).toBe(false);
    expect(
      verifyAnchorInclusionProof({
        ...validProof,
        siblings: Array(33).fill(sibling),
      }),
    ).toBe(false);
  });
});
