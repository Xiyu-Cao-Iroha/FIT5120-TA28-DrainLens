<!--
  The team committed to "100% of merges via pull request with written
  technical feedback" in its Week 4 KPI assessment, and that is assessed.
  The ruleset does not enforce it — `required_approving_review_count` is 0 —
  so this template is the only thing standing between the commitment and
  somebody merging their own work unread.

  Delete any heading that genuinely does not apply. An empty heading left in
  is worse than no heading: it reads as a question nobody answered.
-->

## What changed, and why

<!-- The diff says what. Say why. One paragraph is usually enough. -->

## Which acceptance criterion this serves

<!--
  A number from docs/ITERATION-1-ACCEPTANCE.md — 1.2.2.d, 2.1.2.e, and so on.

  If the change serves none, say so and say what it does serve instead
  (a defect, a measurement, a document). A change that serves nothing is
  worth a conversation before it is worth a review.
-->

## How it was checked

<!--
  Not "it works". What did you run, and what did it say?

    npm run check          typecheck + tests + coverage
    pytest                 if you touched pipeline/
    node tools/docs/check.mjs   if you touched any .md

  If you changed something a person sees, say what you looked at and on what
  screen size. If you changed a number in a document, say what you measured
  it with.
-->

## What this does not cover

<!--
  Optional, and the most useful heading here when it is not empty. Anything
  you noticed and deliberately left, so the reviewer does not spend their
  time finding it and so it does not get lost.
-->

---

### Before requesting a review

- [ ] Branched from **`develop`**, not from `main` — a branch cut from `main` drags its merge commits into the pull request
- [ ] `npm run check` passes, and `pytest` if `pipeline/` was touched
- [ ] No `Co-Authored-By` or tool footer in any commit message — `git log origin/develop..HEAD --format=%B | grep -iE 'co-authored-by|generated with'` prints nothing
- [ ] Nothing added to `wire.ts` that would send a photograph, an address or a coordinate
- [ ] Anything the interface now claims is something the data can support

### What the reviewer writes

Not "LGTM". The commitment is *written technical feedback*, and a marker can
read the thread. One specific observation is enough — a question about a
decision, a case the tests do not cover, a sentence on screen that claims more
than the artefact holds. If you genuinely found nothing, say what you checked.
