import { createHash } from 'crypto';

export const MAX_ANCHOR_PROOF_DEPTH = 32;

export interface AnchorInclusionProofInput {
  commitment: string;
  root: string;
  leafIndex: number;
  siblings: string[];
}

const isHash = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);

function sha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(bytes).digest();
}

/**
 * Verifies an indexed binary Merkle proof. Leaves are domain-separated with
 * 0x00; internal nodes are SHA-256(0x01 || left || right). Siblings are ordered
 * from the leaf level upward, and leafIndex bits determine left/right order.
 */
export function verifyAnchorInclusionProof(
  proof: AnchorInclusionProofInput,
): boolean {
  const { commitment, root, leafIndex, siblings } = proof;
  if (
    !isHash(commitment) ||
    !isHash(root) ||
    !Number.isInteger(leafIndex) ||
    leafIndex < 0 ||
    leafIndex > 0xffff_ffff ||
    !Array.isArray(siblings) ||
    siblings.length > MAX_ANCHOR_PROOF_DEPTH ||
    siblings.some((sibling) => !isHash(sibling)) ||
    leafIndex >= 2 ** siblings.length
  ) {
    return false;
  }

  let node = sha256(
    Buffer.concat([Buffer.from([0]), Buffer.from(commitment, 'hex')]),
  );
  for (let level = 0; level < siblings.length; level++) {
    const sibling = Buffer.from(siblings[level], 'hex');
    const nodeIsRight = ((leafIndex >>> level) & 1) === 1;
    const left = nodeIsRight ? sibling : node;
    const right = nodeIsRight ? node : sibling;
    node = sha256(Buffer.concat([Buffer.from([1]), left, right]));
  }

  return node.toString('hex') === root.toLowerCase();
}
