# Preparation rules register

DrainLens · TA28 · Iteration 3 · task W4.1 · written **3 October 2026**

Which spots become a *place to check before heavy rain*, how far from an address one counts, how many are offered and in what order. Serves AC 5.1.1 and the Epic 5 definition of done, which asks for these to be approved rather than merely implemented.

> **Approval status: not yet approved.** The rules below are what the code does today. The team signs this off; until then the product is shipping a rule that was measured but not agreed.

---

## 1 · What qualifies as a place

**A place is a published pooling-warning marker and nothing else.** No new calculation happens for Epic 5: `prepare/places.ts` reads the markers the terrain pipeline already publishes and chooses among them.

A marker exists where all four hold (`pipeline/src/drainlens_pipeline/low_area_warnings.py`):

| Rule | Value | Why that value |
|---|---|---|
| Depth below the spill level | **at least 1.0 m** | Four times the point cloud's quoted 25 cm accuracy, so a spot at the threshold is still half a metre deep if both rim and floor are wrong in the direction that flatters it. 0.75 m would take the council from 91 markers to 125. |
| Hollow area | **at least 100 m²** | The sentence shown is about parking, so the hollow has to be somewhere a car could be. Ten metres square is a handful of spaces; below it sit shafts rather than hollows. |
| Position | **the lowest cell of the hollow that is in a street corridor** | The action is about a car or bins, which are in the street. Freeways, rail and tram reserves, river corridors and park land are excluded; named private lanes are included. |
| Spacing | **no two within 150 m**, the deeper one keeps its marker | Measured either side: 100 m leaves seven markers in one street-level view, 150 m leaves four, and past 150 m the view gains at most one while whole blocks lose the marker that pointed at them. |

**Four things that must not identify, number or order a place**, each forbidden by AC 5.2.2 by name: the nearest pit, a mapped pipe, a blockage-scenario result, and the area's flood history. `places.test.ts` holds each of them.

## 2 · How far "near this address" reaches

**200 m.** Not chosen for Epic 5: it is what *near this address* already means everywhere else in the product, and a second distance would mean two answers to the same question on two screens.

**Measured before it was agreed:** there are **91 markers council-wide**, so at 200 m **41.4% of the 62,397 addresses have at least one place and 58.6% have none**. The address with nothing to number is the common case, which is why AC 5.1.3 exists and why the code returns an empty list rather than widening its search when it finds nothing.

## 3 · How many are offered

**At most three.** A plan a person will act on before rain is a short one, and the fourth-nearest marker in a 200 m circle is rarely a different street from the third.

## 4 · The order they are numbered in

**Nearest first**, with ties broken on easting and then northing so one address always numbers the same markers the same way.

**The number is distance, and the product says so.** AC 5.1.1 forbids implying it is risk, severity or priority. Distance is the one ordering a reader can check against the map with their own eyes, which is the reason to use it: a reader who cannot check an ordering has to trust it, and this product has nothing to offer them if they do.

## 5 · What the reader is asked to do about a place

**One conditional action, the same at every place:** *If you park or leave bins here, move them when heavy rain is forecast.*

The marker is in a public street near the address, not inside anybody's property. A resident who never parks there has nothing to do, and the wording has to let them say so — which is what *Doesn't apply to me* is for, and why both answers count as reviewing a place.

---

## 6 · What the team is being asked to approve

1. That 200 m, three places and nearest-first are the right numbers, knowing that **58.6% of addresses have no place at all** at 200 m.
2. That a place is only ever a published pooling marker, and that none of the four forbidden sources may be used to add, number or order one.
3. That the conditional wording is right for a marker in a public street.
4. That the number beside a place is understood as distance by a reader who has not read this file.

Re-measure before changing any of them: every figure above was measured on the council artefact, and the counts move together — depth, area and spacing each change how many markers exist, and the 41.4% follows from the count.
