/**
 * The orange arrow from the step's words to the thing it is asking for.
 *
 * **It finds its own ends rather than being handed them.** One element at a
 * time carries `data-guide-target`, and the step panel's instruction carries
 * `data-guide-source`; this draws between whatever the two queries return.
 * The alternative was a ref threaded from the instruction, through the guide,
 * into the map, into a chip row, into a chip -- for a line that has to be
 * redrawn from measurements anyway. The attribute is also the rule the team
 * asked for, made structural: there is one target because there is one
 * attribute, and a second one would be a bug you can grep for.
 *
 * **It re-measures every frame.** The target moves for reasons no event
 * reports in one place: the map pans and zooms under its own animation, a
 * popup opens and pushes a card down, the chip row wraps, the window is
 * resized, a panel folds. Listening for each of those is a list that is
 * wrong the first time somebody adds a sixth. `getBoundingClientRect` on one
 * element costs a layout read; doing it on an idle frame and bailing when the
 * numbers have not changed costs nothing worth saving.
 *
 * **It is never in the way.** `pointer-events: none` on the overlay, the head
 * stops short of the target's edge, and the whole thing sits above the map
 * and below the navigation menu. It is also `aria-hidden`: the instruction it
 * duplicates is already read out, and an arrow is not information a screen
 * reader can use.
 */

import { useEffect, useState } from 'react';

import {
  type Arrow,
  type Box,
  GUIDE_ORANGE,
  arrowBetween,
  headPoints,
  onScreen,
  pathOf,
} from './arrowGeometry.js';

/** On the one control a step is waiting for. Exactly one at a time. */
export const GUIDE_TARGET = 'data-guide-target';
/** On the step's instruction, which is where the arrow sets off from. */
export const GUIDE_SOURCE = 'data-guide-source';

/** What `ringClass` users spread, so a ringed control is also the target. */
export const targetProps = (on: boolean): Record<string, string> => (on ? { [GUIDE_TARGET]: '' } : {});

/**
 * Above the map and its chrome, below the navigation menu at 40.
 *
 * A modal takes the whole window at 1000, so nothing here can land on one.
 */
const LAYER = 30;

const boxOf = (node: Element): Box => {
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

export function GuideArrow() {
  const [arrow, setArrow] = useState<Arrow | null>(null);

  useEffect(() => {
    let live = true;
    let frame = 0;
    let last = '';

    const measure = (): void => {
      const target = document.querySelector(`[${GUIDE_TARGET}]`);
      const source = document.querySelector(`[${GUIDE_SOURCE}]`);
      if (target === null || source === null) {
        if (last !== '') {
          last = '';
          setArrow(null);
        }
        return;
      }

      const to = boxOf(target);
      if (!onScreen(to, window.innerWidth, window.innerHeight)) {
        if (last !== '') {
          last = '';
          setArrow(null);
        }
        return;
      }

      const next = arrowBetween(boxOf(source), to);
      // Rounded in `pathOf`, so a sub-pixel wobble is not a re-render.
      const key = next === null ? '' : `${pathOf(next)}|${String(Math.round(next.angle * 100))}`;
      if (key === last) return;
      last = key;
      setArrow(next);
    };

    const loop = (): void => {
      if (!live) return;
      measure();
      frame = window.requestAnimationFrame(loop);
    };

    /*
      Measured once before the first frame is asked for, so the arrow is on
      screen with the step rather than a frame after it -- and so it is drawn
      at all where frames do not come. A background tab, a hidden pane and a
      window the compositor has nothing to draw all stop `requestAnimationFrame`;
      none of them stop the step changing underneath it.
    */
    /*
      And again whenever the page changes shape, which is what frames alone
      do not cover: a browser runs none at all while its tab or window is
      hidden, so a step that rings its target during that time had no arrow
      until something happened to repaint. The step changing, a panel
      opening and a chip row wrapping are all DOM changes, so an observer
      sees them whether or not anything is being drawn. Frames stay for what
      it cannot see: the map panning and zooming under its own animation,
      which moves a marker without touching the document.
    */
    const watch = new MutationObserver(measure);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true });

    measure();
    frame = window.requestAnimationFrame(loop);
    return () => {
      live = false;
      watch.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (arrow === null) return null;

  const d = pathOf(arrow);
  const head = headPoints(arrow.end, arrow.angle, 13);
  return (
    <svg
      aria-hidden
      focusable="false"
      width="100%"
      height="100%"
      style={{ position: 'fixed', inset: 0, zIndex: LAYER, pointerEvents: 'none' }}
    >
      {/*
        A white under-stroke, because the map below is a drawing in thin
        lines and an orange curve crossing a road at a shallow angle reads as
        part of it. Drawn under both the line and the head so the head keeps
        its shape over a pipe.
      */}
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
      <polygon points={head} fill="#ffffff" stroke="#ffffff" strokeWidth={5} strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke={GUIDE_ORANGE} strokeWidth={3} strokeLinecap="round" />
      <polygon points={head} fill={GUIDE_ORANGE} />
    </svg>
  );
}
