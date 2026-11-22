# Stellar confession anchor inclusion proofs

## Trust and identity

The confession-anchor Soroban contract is the source of truth for a Merkle
root. `record_anchor_root(caller, root)` accepts a root only from the contract
owner or an admin; repeating a registration returns the original ledger and
does not emit another event. `verify_anchor_root(root)` is public and returns
the registration ledger, or `None` when the root is not currently recorded.
Root entries use persistent storage and have their TTL renewed on registration
and lookup.

The API never accepts a caller-selected network or contract ID. It uses the
backend's configured `STELLAR_NETWORK` and confession-anchor contract ID, and
returns both values with every proof result. A proof recorded on another
network or contract is therefore not interchangeable. The verifier reports
an RPC/simulation outage as `503` rather than treating it as a negative proof.

## Proof format

The verifier uses an indexed binary Merkle tree:

1. A commitment is the existing 32-byte `stellarHash`.
2. The leaf is `SHA-256(0x00 || commitment)`.
3. Each parent is `SHA-256(0x01 || left || right)`.
4. `siblings` is ordered from the leaf level to the root. Bit `i` of
   `leafIndex` selects whether the node at level `i` is the right child.

All hashes are 64-character hexadecimal strings. The proof is limited to 32
levels and a `u32` leaf index. The verifier stores only the commitment, root,
index, sibling hashes, configured network/contract identity, and creation
time. It never stores confession text, encryption keys, or commitment-opening
data.

Example request:

```json
{
  "commitment": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "root": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "leafIndex": 0,
  "siblings": [
    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  ]
}
```

## API behavior

- `POST /stellar/anchor/verify-proof` checks the path deterministically before
  making an RPC call. It queries `verify_anchor_root` on the configured
  contract/network and persists the proof only if both checks pass.
- `GET /stellar/anchor/proofs/:commitment` returns up to 20 stored proofs for
  the configured network/contract and rechecks their Merkle paths and on-chain
  root registration.
- `verified: false` with `proof_mismatch` means the path does not match the
  submitted commitment and root. `root_not_recorded` means the proof path is
  valid but the root is not currently present in that contract's live state.
- Malformed hashes, indices, and sibling lists are rejected with `400`.
  Stellar RPC errors return `503`; clients may retry. Database write failures
  are surfaced as errors, and retrying a verified proof is idempotent.
- `GET /stellar/anchor/verify/:confessionHash` retains its existing response
  shape. Provider failures now surface as `503` rather than looking like an
  absent anchor.

The confession detail page offers a JSON proof-package input. It recomputes
the Merkle path in the browser before submitting the proof for the on-chain
root check. A successful response identifies the configured network,
contract, and root-recording ledger.

## Rollout and compatibility

The contract additions are additive: existing `anchor_confession` and
`verify_confession` behavior and stored anchors are unchanged. No migration or
backfill of existing confession rows is required. The database migration only
creates `stellar_anchor_proofs`; its down migration drops that new table.
Legacy direct-hash anchors continue to use the existing verification path and
do not implicitly have Merkle proofs.

Deploy/upgrade the confession-anchor contract with the new ABI before
enabling this API. A pre-upgrade contract does not implement
`verify_anchor_root`, so proof verification returns `503` and must not be
treated as a negative proof. Root producers must construct the tree using the
format above and register its root with the contract owner/admin. Root
registration authorization is enforced by Soroban, independently of any
backend authorization.

Persistent Soroban entries are subject to ledger TTL. A successful root lookup
renews the root entry; if it has expired before the next lookup, the API reports
`root_not_recorded`. Keep a public copy of the root registration transaction
and renew/re-register roots according to the deployment's Soroban TTL policy.
