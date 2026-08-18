/**
 * The five feature showcases in page order: use cases, Slack, Google Docs,
 * sharing, and commits/review. Section ids double as the scroll anchors the
 * nav and footer link to, so they must not change.
 */

import { Showcase } from "./Primitives";
import { GalleryVisual } from "./ProductVisuals";
import { DocsVisual, SlackVisual } from "./IntegrationVisuals";
import { ControlVisual, ShareVisual } from "./CollabVisuals";

/** Renders the showcase sections back to back, in their approved page order. */
export function ShowcaseSections() {
  return (
    <>
      <Showcase
        id="usecases"
        eyebrow="Every kind of document"
        title="One editor for all the paperwork of a working week."
        lede="Start from a template or a blank page — or just describe the document you need. MagicPen writes the first draft, then edits it with you, section by section, without disturbing the rest."
        items={[
          "Business: proposals, statements of work, invoices and status updates that keep their tables intact.",
          "Careers: resumes and offer letters whose layout survives every rewrite.",
          "Comms: press releases and newsletters drafted, tightened and translated in place.",
        ]}
        visual={<GalleryVisual />}
      />

      <Showcase
        id="slack"
        eyebrow="New · Slack"
        title="Write, edit and send documents without leaving the thread."
        lede="Install the bot, connect your account once, and every document gets its own Slack thread. Reply to the thread to edit it; the updated file is posted straight back into the conversation."
        tone="paper"
        flip
        items={[
          <>
            <span className="font-semibold text-ink">/magicpen new</span> to create,{" "}
            <span className="font-semibold text-ink">list</span> and{" "}
            <span className="font-semibold text-ink">open</span> to pick up an existing document.
          </>,
          "Drag a document into the chat and the bot imports it for you.",
          <>
            Thread actions: <span className="font-semibold text-ink">:commit:</span> to snapshot,{" "}
            <span className="font-semibold text-ink">:undo:</span> to revert,{" "}
            <span className="font-semibold text-ink">:send:</span> for the file as docx, md, html or txt.
          </>,
          "Ask questions about the document too — “what’s in this doc?”, “summarise the key points”.",
        ]}
        visual={<SlackVisual />}
      />

      <Showcase
        id="gdocs"
        eyebrow="New · Google Docs"
        title="A MagicPen sidebar inside the doc you’re already in."
        lede="Add the MagicPen add-on, open Extensions → MagicPen, and ask for the edit. It reads the open document, runs the same assistant, and writes the result straight back into the page."
        items={[
          "Selection-first: highlight a paragraph and only that paragraph changes. Highlight nothing and it works on the whole document.",
          "One-time account link, so it’s the same MagicPen account as the web app and Slack.",
          "Nothing to copy out and nothing to paste back in.",
        ]}
        visual={<DocsVisual />}
      />

      <Showcase
        id="sharing"
        eyebrow="New · Sharing & collaboration"
        title="One link. View, comment, or edit together — live."
        lede="Create a share link per document and decide exactly what it grants. Guests don’t need an account, and everyone edits the same document at once with live cursors and presence."
        tone="paper"
        flip
        items={[
          "Three roles: can view, can comment, can edit — changeable after the fact.",
          "Comments anchor to the exact words they’re about, and resolve when they’re done.",
          "Turn downloads off for a link, or revoke it entirely. Sharing never confers ownership.",
        ]}
        visual={<ShareVisual />}
      />

      <Showcase
        id="control"
        eyebrow="New · Commits & review"
        title="Nothing lands in your document unless you say so."
        lede="Flip on Review Mode and every proposed change waits inside the page as a word-level diff — apply it or dismiss it. Commit a version whenever the document is somewhere worth returning to."
        items={[
          "Named commits with one-click restore, from the app or from Slack.",
          "Word-level insert / delete marks shown inline, not in a side-by-side wall.",
          "A full change history per document, each entry with a before and after snapshot.",
        ]}
        visual={<ControlVisual />}
      />
    </>
  );
}
