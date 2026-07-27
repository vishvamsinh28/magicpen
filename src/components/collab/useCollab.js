"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { createCollabProvider } from "@/lib/collab";

// Owns the Yjs document + transport for one document. The editor is only
// mounted once `ready` is true, so the CRDT is either populated from the server
// or knowingly empty (and `needsSeed` tells the caller to plant the current
// HTML into it) before anyone can type — otherwise the first client would see
// a blank page and race the server state in.

export function useCollab({ documentId, shareToken = null, enabled = true }) {
  const [state, setState] = useState({ ydoc: null, ready: false, needsSeed: false, docId: null });
  const [peers, setPeers] = useState([]);
  const [online, setOnline] = useState(true);
  const providerRef = useRef(null);

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
      onStatus: (s) => !cancelled && setOnline(s.ok !== false),
    });
    providerRef.current = provider;

    (async () => {
      await provider.start().catch(() => {});
      if (cancelled) return;
      // If the CRDT is empty after the first round trip, ask the server for the
      // exclusive right to seed. Only the single winner plants content, so two
      // clients opening a fresh shared doc at once can't duplicate it. A client
      // whose start() already pulled someone else's content skips the claim.
      let needsSeed = false;
      if (ydoc.getXmlFragment("default").length === 0) {
        needsSeed = await provider.claimSeed();
        if (cancelled) return;
      }
      setState({ ydoc, ready: true, needsSeed, docId: documentId });
    })();

    return () => {
      cancelled = true;
      provider.stop();
      providerRef.current = null;
      ydoc.destroy();
    };
  }, [documentId, shareToken, enabled]);

  return { ...state, peers, online, flush: () => providerRef.current?.flush() };
}
