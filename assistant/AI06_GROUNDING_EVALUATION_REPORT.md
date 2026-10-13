# AI-06 â€” RAG Grounding and Relevance Validation

**Project:** DrainLens

**Remediation item:** AI-06

**Status:** Locally implemented and tested; final end-to-end validation pending

**Release approval:** Not approved

## 1. Objective

The purpose of AI-06 is to reduce the risk of the DrainLens AI assistant providing information that is unsupported by its official flood-guidance documents.

The remediation focuses on checking generated responses against retrieved evidence and rejecting answers that cannot be adequately verified.

## 2. Implementation Completed

The following improvements were implemented:

- Introduced claim-level grounding validation in `assistant/grounding.py`.
- Implemented verification against individual retrieved document chunks instead of relying only on combined evidence.
- Improved sentence splitting to preserve complete recommendations when text contains wrapped lines.
- Integrated chunk-level validation into the `/chat` endpoint in `assistant/api.py`.
- Retained the existing safe fallback response when grounding validation fails.
- Preserved the existing emergency, prediction and current-warning routing.

The updated approach requires each identified factual claim to be supported by at least one retrieved document chunk.

## 3. Automated Testing

The following automated test suite was executed:

`python -m pytest assistant/test_api.py assistant/test_ai_safety.py assistant/test_grounding.py -q --tb=short`

**Result: 96 passed, 0 failed.**

Python syntax checks also passed for:

- `assistant/api.py`
- `assistant/grounding.py`
- `assistant/ai_service.py`

These results establish that the tested local code paths function as expected. Some tests use mocked model components and therefore do not measure real-model grounding accuracy.

## 4. Grounding Evaluation

An earlier 30-question evaluation recorded:

- 14 answers accepted by the original grounding validator.
- 16 answers rejected.
- No missing-evidence cases in that evaluation.

These figures represent validator decisions, not independently verified answer accuracy.

Subsequent targeted testing of the chunk-level approach produced the following results:

| Question | Result | Observation |
|---|---|---|
| Q5 â€” Valuable possessions | Accepted | Previously rejected by combined-evidence validation |
| Q8 â€” Sandbags | Accepted | Wording still requires human review |
| Q10 â€” Evacuation preparation | Cleaned answer accepted | Original answer contained a potentially misleading final note |
| Q12 â€” Car preparation | Rejected | Unsupported recommendation correctly blocked |
| Q15 â€” Pets and babies | Rejected | Unsupported details remained |
| Q18 â€” Returning home after flooding | Accepted | Official-clearance guidance correctly verified |

A separate deliberately unsafe recommendation about returning home without official clearance was also rejected.

These are targeted results. A complete, independent 30-question replay using the final integrated validator has not been completed.

## 5. Identified Limitations

**Retrieval relevance:** In a newly rebuilt 469-record knowledge base, the official-clearance instruction required for Q18 ranked seventh, while the current retrieval implementation requests only three results. This may prevent the assistant from receiving the most relevant evidence.

**Grounding reliability:** The local Llama verifier can produce false rejections, particularly with lengthy combined evidence or meaning-preserving paraphrases.

**Answer generation:** Some generated responses include unsupported details or misleading statements about missing information.

**Verification coverage:** Chunk-level verification may reject claims that require information from multiple chunks. It may also fail to identify certain unsupported claims.

**Performance:** Chunk-level verification introduces additional model calls. End-to-end latency under the updated implementation has not yet been measured.

**Release integrity:** The live API startup test was blocked because three files in the existing ChromaDB release snapshot failed checksum verification. A separate knowledge base was rebuilt successfully, but it has not been approved as a replacement release.

## 6. Conclusion

AI-06 grounding remediation has been implemented and integrated into the local DrainLens application.

All 96 automated tests passed, and targeted real-model tests demonstrated improvements in verifying supported guidance and rejecting selected unsupported recommendations.

However, the remediation is not yet fully validated for production. Final release acceptance requires end-to-end testing using verified artifacts, broader grounding and retrieval evaluation, performance measurements and security/product review.

**Final status: Locally implemented and tested â€” pending release validation and approval.**
