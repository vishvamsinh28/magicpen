"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { createCollabProvider } from "@/lib/collab";

/**
 * Owns the Yjs document + transport for one document and returns
 * { ydoc, ready, needsSeed, docId, peers, online }. The editor is only
 * mounted once `ready` is true, so the CRDT is either populated from the
 * server or knowingly empty (`needsSeed` tells the caller to plant the
 * current HTML into it) before anyone can type — otherwise the first client
 * would see a blank page and race the server state in.
 */
export function useCollab({ documentId, shareToken = null, enabled = true }) {
  const [state, setState] = useState({ ydoc: null, ready: false, needsSeed: false, docId: null });
  const [peers, setPeers] = useState([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!enabled || !documentId) {
      setState({ ydoc: null, ready: false, needsSeed: false, docId: null });
      setPeers([]);
      return;
    }

    let cancelled = false;
    const ydoc = new Y.Doc();
    const provider = createCollabProvider({
      documentId,
      ydoc,
      shareToken,
      onPeers: (list) => !cancelled && setPeers(list),
      onStatus: (s) => !cancelled && setOnline(s?.ok !== false),
    });

    (async () => {
      try {
        await provider.start();
        if (cancelled) return;
        // If the CRDT is empty after the first round trip, ask the server for
        // the exclusive right to seed. Only the single winner plants content,
        // so two clients opening a fresh shared doc at once can't duplicate
        // it. A client whose start() already pulled someone else's content
        // skips the claim.
        let needsSeed = false;
        if (ydoc.getXmlFragment("default").length === 0) {
          needsSeed = await provider.claimSeed();
          if (cancelled) return;
        }
        setState({ ydoc, ready: true, needsSeed, docId: documentId });
      } catch (err) {
        if (cancelled) return;
        // The provider retries transport failures on its own poll loop, so
        // mount the editor anyway (unseeded) instead of spinning forever;
        // content still arrives once a round trip succeeds.
        console.warn(`collab: initial sync for document ${documentId} failed: ${err.message}`);
        setState({ ydoc, ready: true, needsSeed: false, docId: documentId });
      }
    })();

    return () => {
      cancelled = true;
      provider.stop();
      ydoc.destroy();
    };
  }, [documentId, shareToken, enabled]);

  return { ...state, peers, online };
}
