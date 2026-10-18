/**
 * The notepad and pencil, from Figma's `Report icon` (node `268:4271`).
 *
 * **Drawn here rather than shipped as a file**, which is the rule the rest of
 * the product's illustrations follow: inline SVG carries no licence and
 * nothing to credit, and `docs/IMAGE-CREDITS.md` says so under *Illustrations
 * drawn in the code*. The paths are the design's own, read from the file and
 * not traced by eye.
 *
 * It marks reporting in two places and has to be the same mark in both: the
 * *Spot a problem?* chip on the map (16 px) and the chooser's card for the
 * guide behind it (26 px). The design draws one icon; so does this.
 *
 * `aria-hidden`, always. Both callers put the word beside it.
 */
export function ReportGlyph({
  size,
  x = 0,
  y = 0,
}: {
  readonly size: number;
  /** Where to place it, for the caller that draws it inside a larger scene. */
  readonly x?: number;
  readonly y?: number;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* The pad. */}
      <path
        d="M16.0333 3.03333H5.63333C4.43672 3.03333 3.46667 4.00338 3.46667 5.2V20.8C3.46667 21.9966 4.43672 22.9667 5.63333 22.9667H16.0333C17.23 22.9667 18.2 21.9966 18.2 20.8V5.2C18.2 4.00338 17.23 3.03333 16.0333 3.03333Z"
        fill="#ffffff"
        stroke="#1f6f5c"
        strokeWidth="1.73333"
      />
      {/* Three lines of what somebody has written down. */}
      <path
        d="M6.93333 8.23333H14.7333M6.93333 11.9167H13M6.93333 15.6H11.2667"
        stroke="#7fa79a"
        strokeWidth="1.73333"
        strokeLinecap="round"
      />
      {/* The pencil: body, tip, ferrule. */}
      <path
        d="M12.1333 16.6833L20.5833 8.23333L23.1833 10.8333L14.7333 19.2833L12.1333 16.6833Z"
        fill="#f2b33d"
        stroke="#6b4a0e"
        strokeWidth="1.19167"
        strokeLinejoin="round"
      />
      <path
        d="M12.1333 16.6833L14.7333 19.2833L10.8333 20.5833L12.1333 16.6833Z"
        fill="#f7ddb0"
        stroke="#6b4a0e"
        strokeWidth="1.19167"
        strokeLinejoin="round"
      />
      <path
        d="M20.5833 8.23333L21.8833 6.93333L24.4833 9.53333L23.1833 10.8333L20.5833 8.23333Z"
        fill="#e0796a"
        stroke="#6b4a0e"
        strokeWidth="1.19167"
        strokeLinejoin="round"
      />
    </svg>
  );
}
