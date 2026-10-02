/**
 * Printing the plan: the one part of it that touches the browser.
 *
 * A hidden frame rather than a new tab or a download. A tab needs a popup the
 * browser may block and leaves the reader somewhere they did not ask to be; a
 * download gives them a file whose name they then have to find. Printing from
 * a frame keeps them on the map, and the browser's own dialog is where *save
 * as PDF* lives on every platform this is used on.
 *
 * `planHtml` builds the document, so there is nothing here to get wrong about
 * what the page says — only about how it reaches the printer.
 */

/** How long the frame is kept after the dialog opens. */
const KEEP_FRAME_MS = 1000;

/** Print a self-contained document, leaving the page it was called from. */
export function printDocument(html: string, root: Document = document): void {
  const frame = root.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Printed plan');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    const inside = frame.contentWindow;
    if (inside === null) return;
    inside.focus();
    inside.print();
    // Taken away after the dialog has had the document; removing it in the
    // same tick cancels the print in Safari.
    root.defaultView?.setTimeout(() => {
      frame.remove();
    }, KEEP_FRAME_MS);
  });
  root.body.append(frame);
}
