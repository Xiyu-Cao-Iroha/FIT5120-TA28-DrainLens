# Image credits

DrainLens · TA28 · every photograph and illustration the site ships, and where it came from.

This file exists because the rest of the project is strict about provenance and the images were the one thing it had no register for. The map artefacts carry CC BY credits in the footer; the guidance quotations carry a publisher and the date the page was read; the Stage 2 evaluation's PDFs were **not** used because `assistant/sources.csv` recorded them as *no open licence identified*. A photograph on the plan is a thing this project publishes, and it needs the same answer.

---

## The team's own photographs

Taken by the team, so there is no external licence to honour and no attribution owed to anybody outside it. They are used under the team's own permission and may be changed or removed at any time.

| File | Where it is shown | What it shows |
|---|---|---|
| `apps/web/public/actions/gutter.webp` | *Clean gutters, downpipes and drains when it is safe to do so.* | leaves collected in a roof gutter |
| `apps/web/public/actions/raise-items.webp` | *Lift valuables up high.* | boxes and books on a shelf above floor level |
| `apps/web/public/actions/emergency-kit.webp` | *Pack an emergency kit with enough essentials for three days.* | an opened kit bag with its contents laid out |
| `apps/web/public/actions/warnings.webp` | *Monitor weather warnings and official forecasts.* | a phone showing a weather forecast |

**Confirmed by Xiyu Cao on 8 October 2026** as the team's own, in answer to a direct question about where they came from. They came into the repository from the Figma file (`Photo / Gutter`, `Photo / Raise items`, `Photo / Emergency kit`, `Photo / Warnings`), re-encoded to WebP at 600 px wide.

**None of them is evidence.** A photograph of somebody's gutter does not show anything about the reader's gutter, and none of them is of Kensington or of anything this product has measured. They are there to say which part of a house the sentence beside them is about. The sentence is the thing with a source, and it carries its own publisher and date.

---

## Generated images

Made with an image generator and supplied by the team. There is no
photographer and no stock licence, and nothing in them is a record of a real
place: the street is invented.

| File | Where it is shown | What it shows |
|---|---|---|
| `apps/web/public/street.webp` | behind the lower part of the address screen | a wet residential street with plane trees and iron fences, in the manner of inner Melbourne |

**Confirmed by Xiyu Cao on 11 October 2026** as AI generated and supplied by
the team, in answer to a direct question about where it came from. Re-encoded
to WebP at 1600 px wide, 134 KB, from a 1774 px JPEG.

**It is decoration and the page treats it as decoration.** It is a CSS
background with no `alt` text, because there is nothing in it a reader needs
described: it is not Kensington, not the reader's street, and not anything
this product has measured. A caption would invite it to be read as evidence.

**No text is drawn over it**, which is a measurement rather than a taste.
This page's muted grey reaches 4.9:1 on the page colour, just past the 4.5:1
AA asks for; over the photograph, under any veil light enough to leave a
street visible, it lands between 3.0 and 3.9:1. There is no veil that keeps
both, so the picture sits below the text instead of behind it. See
`.landing__street` in `apps/web/src/ui/base.css`.

---

## Illustrations drawn in the code

Not files: inline SVG, written in the components that draw them, so they carry no licence at all.

| Where | What |
|---|---|
| `screens/BlockagePictures.tsx` | the three grate drawings in the blockage comparison |
| `screens/Home.tsx` (`PathThumb`), `screens/BlockedDrain.tsx` (`CompareThumb`) | the guide cards' thumbnails |
| `map/MapLayers.tsx` | the legend's swatches |

---

## The rest of `public/`

| File | Where | Note |
|---|---|---|
| `hero-street.webp` | the homepage banner | **Not recorded.** Predates this file. |
| `choose-landscape.webp` | the guide chooser's backdrop | **Not recorded.** Predates this file. |
| `flood-areas-thumb.webp` | the flood-history card | **Not recorded.** Predates this file. |

Three images were already in the repository when this file was written and nobody recorded where they came from. They are listed rather than quietly left out: an unrecorded image is a thing to settle before the showcase, not a thing to forget.
