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

    let seeded = false;
    provider
      .start()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        // An empty CRDT after the first round trip means nobody has planted
        // the document yet and this client should.
        seeded = ydoc.getXmlFragment("default").length > 0;
        setState({ ydoc, ready: true, needsSeed: !seeded, docId: documentId });
      });

    return () => {
      cancelled = true;
      provider.stop();
      providerRef.current = null;
      ydoc.destroy();
    };
  }, [documentId, shareToken, enabled]);

  return { ...state, peers, online, flush: () => providerRef.current?.flush() };
}
