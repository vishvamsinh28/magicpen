import { useEffect } from "react";
import { apiFetch } from "@/lib/client-utils";
import { DEFAULT_SETTINGS } from "./state";

// Reads a ?doc=<id> deep link (e.g. the Slack bot's "Open in MagicPen") and
// strips it from the URL so a reload doesn't re-trigger the open.
function consumeDeepLink() {
  const deepLinkId = new URLSearchParams(window.location.search).get("doc");
  if (deepLinkId) {
    const p = new URLSearchParams(window.location.search);
    p.delete("doc");
    const qs = p.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }
  return deepLinkId;
}

// Refetches the user's saved tabs (capped at 8), priming the html cache.
// Individual failures (deleted/inaccessible docs) skip that tab only.
// May throw on unreadable localStorage/JSON — the caller treats that as
// "nothing to restore".
async function fetchSavedTabs(userId, docHtmlRef) {
  const tabs = JSON.parse(localStorage.getItem(`magicpen-tabs:${userId}`) || "null");
  const restoreIds = tabs?.ids?.length ? tabs.ids.slice(0, 8) : [];
  const restored = [];
  for (const id of restoreIds) {
    try {
      const { document } = await apiFetch(`/api/documents/${id}`);
      docHtmlRef.current.set(document.id, document.contentHtml || "");
      restored.push({
        id: document.id,
        title: document.title,
        sourceFile: document.sourceFile,
        shared: !!document.shared,
      });
    } catch {
      /* tab no longer restorable — drop it silently */
    }
  }
  return { restored, activeId: tabs?.activeId };
}

/**
 * The workspace's localStorage persistence: restores settings and per-user
 * tabs on mount (honoring a ?doc deep link last, so it wins focus) and writes
 * both back as they change. Keys: "magicpen-settings", "magicpen-tabs:<userId>".
 * All storage access is best-effort — private-mode failures never break the app.
 */
export function useWorkspacePersistence({
  user, settings, setSettings,
  openDocs, activeDocId, setOpenDocs, setActiveDocId, setMobilePane,
  docHtmlRef, openDocument,
}) {
  // Mount-only restore; closures deliberately capture first-render values
  // (setters and refs are stable, openDocument only touches those).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("magicpen-settings") || "null");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch {
      /* unreadable settings — keep defaults */
    }
    // Restore this user's previously open tabs.
    (async () => {
      const deepLinkId = consumeDeepLink();
      try {
        const { restored, activeId } = await fetchSavedTabs(user.id, docHtmlRef);
        if (restored.length) {
          setOpenDocs(restored);
          const active = restored.some((d) => d.id === activeId) ? activeId : restored[0].id;
          setActiveDocId(active);
          setMobilePane("editor");
        }
      } catch {
        /* restore is best-effort — start with an empty workspace */
      }
      // Deep link wins: open (and focus) the requested document last.
      if (deepLinkId) await openDocument(deepLinkId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("magicpen-settings", JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  }, [settings]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(
        `magicpen-tabs:${user.id}`,
        JSON.stringify({ ids: openDocs.map((d) => d.id), activeId: activeDocId })
      );
    } catch {
      /* storage unavailable — tabs just won't persist */
    }
  }, [openDocs, activeDocId, user]);
}
