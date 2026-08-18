// MOCK_AI=1 lets the whole app run without a Gemini key (dev/testing). The
// canned responses below intentionally exercise every edit op and the review
// card's multi-edit UI; keep them in sync with the real response contract.

const MOCK_DOC = `<h1>Understanding REST APIs: A Guide</h1><p>A <strong>REST API</strong> (Representational State Transfer Application Programming Interface) is an architectural style for providing standards between computer systems on the web, making it easier for systems to communicate with each other.</p><h2>What is an API?</h2><p>API stands for <em>Application Programming Interface</em>. Think of it as a waiter in a restaurant: you (the client) give your order to the waiter (the API), who takes it to the kitchen (the server), and then brings the finished meal (the response) back to you.</p><h2>Key Principles of REST</h2><ul><li><strong>Statelessness</strong> — each request contains all the information needed.</li><li><strong>Cacheability</strong> — responses define themselves as cacheable or not.</li><li><strong>Uniform interface</strong> — resources are identified by URLs and manipulated with HTTP verbs.</li></ul>`;

// Strips a block's outer tag so the content can be re-wrapped (e.g. in <mark>).
const inner = (html) => html.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");

/**
 * Keyword-driven stand-in for the real assistant. Returns the same raw shape
 * the model would ({ reply, title, edits }) so it flows through sanitizeResult
 * like a genuine response.
 */
export function mockAssistant({ message, blocks }) {
  const m = message.toLowerCase();
  if (!blocks.length && /(create|write|draft|generate|template|load)/.test(m)) {
    return {
      reply: "I've drafted that document for you — take a look on the right and tell me what to tweak.",
      title: "Understanding REST APIs: A Guide",
      edits: [{ op: "setDocument", html: MOCK_DOC }],
    };
  }
  if (blocks.length && /highlight/.test(m)) {
    return {
      reply: "I've highlighted the opening for you.",
      title: null,
      edits: [{ op: "replace", index: 0, html: `<p><mark style="background-color:#fef08a">${inner(blocks[0])}</mark></p>` }],
    };
  }
  if (blocks.length && /bold/.test(m)) {
    return {
      reply: "Made the first block bold.",
      title: null,
      edits: [{ op: "replace", index: 0, html: `<p><strong>${inner(blocks[0])}</strong></p>` }],
    };
  }
  if (blocks.length && /(conclusion|summary)/.test(m)) {
    return {
      reply: "Added a conclusion at the end of the document.",
      title: null,
      edits: [{
        op: "insertAfter",
        index: blocks.length - 1,
        html: "<h2>Conclusion</h2><p>In short, REST APIs give disparate systems a simple, uniform way to exchange data over the web — and that simplicity is exactly why they became the default.</p>",
      }],
    };
  }
  if (blocks.length && /delete (the )?last/.test(m)) {
    return { reply: "Removed the last block.", title: null, edits: [{ op: "delete", index: blocks.length - 1 }] };
  }
  // Multi-op response — exercises the review card's per-edit diffs + selective apply.
  if (blocks.length && /(improve|polish|rewrite)/.test(m)) {
    const idx = Math.min(1, blocks.length - 1);
    return {
      reply: "I've polished the document — reworded a paragraph, added a pro tip, and trimmed the ending.",
      title: null,
      edits: [
        { op: "replace", index: idx, html: `<p>Put simply, ${inner(blocks[idx]).replace(/\bthe\b/i, "this")} That's the core idea.</p>` },
        { op: "insertAfter", index: idx, html: "<p><em>Pro tip:</em> keep every section focused on a single idea.</p>" },
        { op: "delete", index: blocks.length - 1 },
      ],
    };
  }
  return {
    reply: `Mock AI here — I received "${message}". Set GEMINI_API_KEY in .env.local (and remove MOCK_AI) to talk to the real model.`,
    title: null,
    edits: [],
  };
}
