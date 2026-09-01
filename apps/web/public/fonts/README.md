# The typeface this site ships

`kensington-sans.woff2` — 17.6 KB, one file, weights 200–900 on a variable axis.

## What it is

A **subset of Source Sans 3 3.052**, by Paul D. Hunt for Adobe, under the
[SIL Open Font License 1.1](./OFL.txt) — the full licence text ships beside it,
as the licence requires.

Cut down to the 120 characters this interface actually uses: basic Latin, the
punctuation and symbols that appear in the copy, and nothing else. The original
variable font is 631 KB; this is 17.6 KB, which is **1.3% of a first visit**.

## Why it is not called Source Sans

The OFL reserves the font name "Source". Clause 3 says a Modified Version may
not use a Reserved Font Name, and **subsetting is a modification** — so the
family is renamed rather than shipped under a name the licence does not permit.
The origin is recorded inside the font's own name table and stated here.

## Why it is self-hosted rather than loaded from a CDN

A webfont from Google Fonts or any CDN makes the reader's browser send its IP
address and user agent to a third party on every page load. This product's
interface contract says a resident can use all of it "without a single request
that says anything about them", and AD1 says no IP is retained — a promise the
landing page makes to residents in those words. A CDN font would quietly break
both. It is served from this origin, or not at all.

## Rebuilding it

Requires `fonttools` and `brotli`, neither of which is a project dependency —
this is a one-off build artefact, not part of the pipeline.

```bash
python -m fonttools subset SourceSans3VF-Upright.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00A7,U+00A9,U+00B0,U+00B1,U+00B3,U+00B7,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2039,U+203A,U+2190,U+2192,U+2248,U+2264,U+2265,U+25B8,U+25BE,U+2713" \
  --layout-features='kern,liga,calt,tnum,onum,frac' \
  --flavor=woff2 --with-zopfli --output-file=subset.woff2
```

Then rename the family away from the Reserved Font Name before shipping.

## Four glyphs it deliberately does not carry

`ⓘ ◇ ◎ ⚠` are not in Source Sans 3. Rather than let four characters fall back
to whatever the reader's system supplies — which is how a careful interface
ends up with one icon in a different voice from everything around it — the
interface draws those as inline SVG instead of setting them as text.
