/**
 * The DrainLens mark: a street drain with water running into it, under a
 * Melbourne skyline inside an arc.
 *
 * **The team's own artwork**, supplied on 11 October as `Logo.zip` with two
 * files. This is `Logo.svg`, the one without the wordmark, because the
 * masthead already sets *DrainLens* in type beside it and a logo that
 * repeats the word would say it twice.
 *
 * **Drawn here rather than shipped as a file**, which is the rule the rest
 * of the product's artwork follows (`docs/IMAGE-CREDITS.md`, *Illustrations
 * drawn in the code*): no request, no cache, nothing to go stale, and it
 * takes the page's own colours of nothing because it has its own.
 *
 * The clip path needs an id, and an id in a component is a bug waiting for
 * the day somebody renders two of these: `useId` gives each instance its
 * own.
 */

import { useId } from 'react';

/** What the mark is, for a reader who cannot see it. */
export const LOGO_TITLE = 'DrainLens';

export function Logo({ height }: { readonly height: number }) {
  const clip = useId();
  // 536 x 402 in the file it came from; the width follows the height so the
  // caller never has to know the ratio.
  const width = Math.round((height * 536) / 402);

  return (
    <svg
      width={width}
      height={height}
      viewBox="120 98 536 402"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="388" cy="322" r="190" />
        </clipPath>
      </defs>
      {/* The arc the skyline sits in. */}
      <path
        d="M184 374 A208 208 0 1 1 592 374"
        fill="none"
        stroke="#123957"
        strokeWidth="27"
        strokeLinecap="butt"
      />
      {/* The skyline, clipped to the arc. */}
      <path
        d="M199 311 V288 H217 V273 H238 V255 H262 V231 H290 V260 H304 V248 H316 V224 H323 V218 H337 V223 H345 V262 H369 V252 H389 V228 H415 V261 H425 V185 H431 V166 H438 V183 H452 V261 H463 V248 H482 V228 H507 V260 H522 V244 H543 V273 H560 V288 H577 V312 Z"
        fill="#ced9e2"
        clipPath={`url(#${clip})`}
      />
      {/* The grate, and its white outline. */}
      <path
        d="M191 383 254 304 Q266 290 283 290 H492 Q509 290 522 304 L585 383 Q596 398 579 408 Q572 412 553 411 H540 Q516 410 500 391 L481 368 H296 L278 391 Q262 410 233 411 H211 Q188 411 191 393 Z"
        fill="#103755"
      />
      <path
        d="M184 383 251 301 Q265 284 283 284 H492 Q511 284 525 301 L592 383"
        fill="none"
        stroke="#fff"
        strokeWidth="13"
        strokeLinejoin="round"
      />
      <g fill="#fff">
        <path d="M291 317 H307 L275 354 H252 Z" />
        <path d="M325 317 H339 L322 354 H300 Z" />
        <path d="M359 317 H373 L368 354 H347 Z" />
        <path d="M398 317 H412 L423 354 H401 Z" />
        <path d="M440 317 H454 L474 354 H452 Z" />
        <path d="M476 317 H491 L520 354 H498 Z" />
      </g>
      {/* The water. */}
      <path
        d="M276 359 Q302 351 327 356 Q352 362 381 355 Q423 348 448 362 Q468 372 477 394 Q484 411 507 418 Q533 425 572 431 Q609 438 616 453 Q623 468 599 477 Q577 485 540 486 H488 Q457 485 432 477 Q415 472 393 474 Q359 475 331 471 Q301 470 276 475 Q233 481 191 473 Q149 468 143 456 Q140 447 161 440 Q180 434 220 427 Q264 420 289 403 Q308 389 301 373 Q294 363 276 359 Z"
        fill="#49add9"
      />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M302 359 Q335 372 325 391 Q315 412 277 425 Q244 437 245 453 Q245 463 258 469" />
        <path d="M357 357 Q389 369 388 387 Q387 405 357 420 Q326 434 294 441 Q274 447 278 462" />
        <path d="M421 357 Q454 368 464 390 Q472 411 447 429 Q424 442 409 449 Q396 457 411 474" />
      </g>
    </svg>
  );
}
