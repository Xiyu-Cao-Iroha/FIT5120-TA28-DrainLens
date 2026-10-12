# DrainLens AI-09–AI-13 release checklist (draft)

This file is an implementation and evidence checklist, **not** release approval.

## AI-09 — Reproducible artifacts
- Draft release manifest, model checksum, versioned collection and source fingerprints exist.
- Verify GGUF publisher, original URL and license before release. Do not invent provenance.
- Publish GGUF and immutable corpus to a controlled, access-restricted, versioned store by digest or document an authorized release job.
- Record deployed OCI image digest alongside release ID; run cold clean-room deployment and checksum mutation negative tests.
- Runtime corpus must be a new writable copy of verified release snapshot. No pre-existing runtime corpus is trusted.

## AI-10 — IT/Cloud release evidence (not verified locally)
- Deploy AI Cloud Run **without unauthenticated invocation**; inspect IAM and permit only the dedicated API service account as invoker.
- Record service URL/audience, image digest, IAM bindings, service accounts, concurrency, timeout, min/max instances.
- Test anonymous POST /chat denied with 401/403, API authenticated call allowed, API failure generic and preparation plan still usable.
- Confirm positive-control request generates expected logging; query cloud logs for client IP, request body and chat response; apply appropriate exclusions/settings.
- Exercise AI_SERVICE_URL kill switch and rollback, with approver and timestamp.
- Do not change live IAM or create paid infrastructure without explicit owner approval.

## AI-11 — Blocking release quality gate
- Freeze question IDs, expected safety outcomes, scoring rubric, corpus release ID, model digest, inference settings and evaluator identity.
- Mandatory cases: 100% pass for emergency, prediction refusal, current warnings, dangerous-action refusal, privacy, and direct/indirect injection.
- Overall helpfulness and source relevance thresholds require documented product/security reviewer approval; historical 20/30 is not an approved threshold.
- Run deterministic routing, end-to-end evaluation and manual grounding checks; retain machine-readable results.
- Block regression against previous approved release unless documented risk acceptance is signed.

## AI-12 — Availability and resource bounds
- API gateway timeout has been reduced from 280s to 90s as **temporary conservative configuration**, NOT a measurement-backed final number.
- Measure warm/cold p50 and p95, load/concurrency, model memory; choose limits lower than the platform outer timeout.
- Set Cloud Run max concurrency to one per Llama process unless measured safe; avoid unapproved always-on warm-instance cost.
- Verify frontend duplicate-turn prevention and AbortController cancellation where the chat widget is actually implemented (not present in provided web/src files).
- Verify timeout produces a generic unavailable message while flood preparation functionality remains available.

## AI-13 — Prompt injection defense
- Prompt uses distinct resident question and clearly labeled untrusted extract message; no tools or secrets are given to LLM.
- A deterministic forbidden-advice filter catches selected unsafe generated statements before browser delivery; filters are not exhaustive.
- Build a frozen adversarial direct/indirect test set and manual grounding review as part of release gate.
- Keep temperature 0.1 and max_tokens 250; do not relax until reviewed.

## Release status
**NOT RELEASE-READY.** Production live IAM, provenance, measured availability, source grounding, reviewer approval and full adversarial/evaluation replay remain outstanding.

## AI-08 — Dependency vulnerability assessment

Audit evidence: assistant/ai08-audit-findings.json.

The saved dependency audit reports five findings:
- ChromaDB 1.5.9: four reported vulnerabilities involving server API code injection or authorization.
- diskcache 5.6.3: one reported unsafe-deserialization vulnerability.

ChromaDB exposure assessment:
- Reviewed application code uses chromadb.PersistentClient.
- No ChromaDB HTTP client or separate ChromaDB server startup configuration was identified in the searched files.
- The reported server-specific attack paths appear less applicable to the reviewed deployment architecture.
- Deployment exposure and residual risk still require security review.

diskcache exposure assessment:
- llama-cpp-python includes optional disk-cache functionality.
- The installed Llama implementation initializes self.cache to None.
- No application calls enabling LlamaDiskCache or set_cache were identified.
- The reviewed application therefore does not appear to activate the affected disk-cache functionality.

Disposition:
- These findings have NOT been fixed or formally accepted.
- Retain all five findings in the vulnerability register.
- Require deployment verification and documented security-owner approval before production release.
- Reassess after dependency updates or architectural changes.
