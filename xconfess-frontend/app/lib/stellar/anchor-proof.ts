export interface AnchorInclusionProof {
  commitment: string;
  root: string;
  leafIndex: number;
  siblings: string[];
}

const HASH_PATTERN = /^[0-9a-f]{64}$/i;

function decodeHash(value: string): Uint8Array | null {
  if (!HASH_PATTERN.test(value)) return null;
  return Uint8Array.from(
    value.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
}

async function sha256(value: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return new Uint8Array(digest);
}

function concat(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((length, value) => length + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyAnchorInclusionProof(
  proof: AnchorInclusionProof,
): Promise<boolean> {
  if (
    !proof ||
    !Number.isInteger(proof.leafIndex) ||
    proof.leafIndex < 0 ||
    proof.leafIndex > 0xffff_ffff ||
    !Array.isArray(proof.siblings) ||
    proof.siblings.length > 32 ||
    proof.leafIndex >= 2 ** proof.siblings.length
  ) {
    return false;
  }

  const commitment = decodeHash(proof.commitment);
  const root = decodeHash(proof.root);
  const siblings = proof.siblings.map(decodeHash);
  if (!commitment || !root || siblings.some((sibling) => !sibling)) {
    return false;
  }

  let node = await sha256(concat(new Uint8Array([0]), commitment));
  for (let level = 0; level < siblings.length; level++) {
    const sibling = siblings[level];
    if (!sibling) return false;
    const nodeIsRight = ((proof.leafIndex >>> level) & 1) === 1;
    node = await sha256(
      nodeIsRight
        ? concat(new Uint8Array([1]), sibling, node)
        : concat(new Uint8Array([1]), node, sibling),
    );
  }

  return toHex(node) === toHex(root);
}
