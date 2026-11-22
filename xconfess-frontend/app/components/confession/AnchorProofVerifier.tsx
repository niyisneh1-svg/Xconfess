"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  type AnchorInclusionProof,
  verifyAnchorInclusionProof,
} from "@/app/lib/stellar/anchor-proof";

interface StoredProof extends AnchorInclusionProof {
  network: string;
  contractId: string;
  verified: boolean;
  rootRecordedAtLedger: number | null;
  localVerified?: boolean;
}

interface ProofPath {
  root: string;
  leafIndex: number;
  siblings: string[];
}

interface AnchorProofVerifierProps {
  commitment: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isProofPackage(value: unknown): value is ProofPath {
  if (!value || typeof value !== "object") return false;
  const proof = value as Record<string, unknown>;
  return (
    typeof proof.root === "string" &&
    typeof proof.leafIndex === "number" &&
    Number.isInteger(proof.leafIndex) &&
    Array.isArray(proof.siblings) &&
    proof.siblings.every((sibling) => typeof sibling === "string")
  );
}

function isStoredProof(value: unknown): value is StoredProof {
  if (!isRecord(value) || !isProofPackage(value)) return false;
  return (
    typeof value.commitment === "string" &&
    typeof value.network === "string" &&
    typeof value.contractId === "string" &&
    typeof value.verified === "boolean" &&
    (value.rootRecordedAtLedger === null ||
      typeof value.rootRecordedAtLedger === "number")
  );
}

export function AnchorProofVerifier({
  commitment,
}: AnchorProofVerifierProps) {
  const [proofInput, setProofInput] = useState("");
  const [storedProofs, setStoredProofs] = useState<StoredProof[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/stellar/anchor/proofs/${commitment}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Saved proofs are unavailable.");
        }
        const payload: unknown = await response.json();
        return Array.isArray(payload) ? payload : [];
      })
      .then(async (proofs: unknown[]) => {
        const verifiedProofs = await Promise.all(
          proofs.map(async (candidate) => {
            if (!isStoredProof(candidate)) return null;
            const stored = candidate;
            const localVerified = await verifyAnchorInclusionProof({
              commitment,
              root: stored.root,
              leafIndex: Number(stored.leafIndex),
              siblings: stored.siblings,
            });
            return { ...stored, localVerified };
          }),
        );
        if (active) {
          setStoredProofs(
            verifiedProofs.filter(
              (proof): proof is StoredProof => proof !== null,
            ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setError("Saved proofs could not be loaded. You can still verify one below.");
        }
      });

    return () => {
      active = false;
    };
  }, [commitment]);

  const submitProof = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const parsed: unknown = JSON.parse(proofInput);
      if (!isProofPackage(parsed)) {
        throw new Error(
          'Use JSON with "root", "leafIndex", and a "siblings" array.',
        );
      }

      const proof: AnchorInclusionProof = {
        commitment,
        root: parsed.root,
        leafIndex: parsed.leafIndex,
        siblings: parsed.siblings,
      };
      if (!(await verifyAnchorInclusionProof(proof))) {
        throw new Error("The Merkle path does not match this commitment and root.");
      }

      const response = await fetch("/api/stellar/anchor/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          isRecord(result) && typeof result.message === "string"
            ? result.message
            : "Proof verification failed.";
        throw new Error(
          response.status === 503
            ? "Stellar is temporarily unavailable. Retry the verification."
            : errorMessage,
        );
      }
      if (!isRecord(result) || result.verified !== true) {
        const reason = isRecord(result) ? result.reason : undefined;
        throw new Error(
          reason === "root_not_recorded"
            ? "This root is not recorded on the configured Stellar contract."
            : "The proof does not match the recorded anchor root.",
        );
      }

      if (
        typeof result.network !== "string" ||
        typeof result.contractId !== "string" ||
        typeof result.rootRecordedAtLedger !== "number"
      ) {
        throw new Error("The verification service returned incomplete proof identity.");
      }

      const verifiedProof: StoredProof = {
        ...proof,
        network: result.network,
        contractId: result.contractId,
        verified: true,
        rootRecordedAtLedger: result.rootRecordedAtLedger,
        localVerified: true,
      };
      setStoredProofs((current) => [
        verifiedProof,
        ...current.filter(
          (existing) =>
            existing.root !== verifiedProof.root ||
            existing.leafIndex !== verifiedProof.leafIndex,
        ),
      ]);
      setMessage(
        `Verified on ${verifiedProof.network} at ledger ${verifiedProof.rootRecordedAtLedger}.`,
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Proof verification failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      aria-labelledby="anchor-proof-heading"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <h3 id="anchor-proof-heading" className="text-sm font-semibold">
          Independent inclusion proof
        </h3>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Verify a commitment path in your browser, then check its root against
        the configured Stellar network and anchor contract. Proofs contain
        hashes only, not confession text.
      </p>

      {storedProofs.map((proof) => (
        <div
          key={`${proof.root}:${proof.leafIndex}`}
          className="mt-3 text-xs"
          role="status"
        >
          {proof.verified && proof.localVerified ? (
            <p className="text-emerald-600 dark:text-emerald-400">
              Verified on {proof.network} · contract {proof.contractId}
              {proof.rootRecordedAtLedger !== null
                ? ` · root ledger ${proof.rootRecordedAtLedger}`
                : ""}
            </p>
          ) : (
            <p className="text-amber-600 dark:text-amber-400">
              Saved proof is not currently verifiable on the configured chain.
            </p>
          )}
        </div>
      ))}

      <label
        htmlFor="anchor-proof-input"
        className="mt-4 block text-xs font-medium"
      >
        Merkle proof package (JSON)
      </label>
      <textarea
        id="anchor-proof-input"
        value={proofInput}
        onChange={(event) => setProofInput(event.target.value)}
        placeholder='{"root":"…64 hex characters…","leafIndex":0,"siblings":["…64 hex characters…"]}'
        rows={3}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
        aria-describedby="anchor-proof-help"
      />
      <p id="anchor-proof-help" className="mt-1 text-[11px] text-zinc-500">
        Sibling hashes are ordered leaf-first. The commitment is taken from this
        confession.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={submitProof}
          disabled={busy || !proofInput.trim()}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
              Verifying…
            </>
          ) : (
            "Verify proof"
          )}
        </Button>
        {message && (
          <span className="text-xs text-emerald-600" role="status">
            {message}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-500" role="alert">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
