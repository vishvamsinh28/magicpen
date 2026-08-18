import { useRef, useState } from "react";

/** Default assistant settings; persisted saves are merged over this shape. */
export const DEFAULT_SETTINGS = { mode: "balanced", autoApply: true };

/**
 * Declares every piece of workspace state (useState/useRef) in one fixed,
 * unconditional order and returns the values, setters and refs as one bag.
 * Action factories close over this bag each render; keeping all hooks here
 * guarantees a stable hook order for the single WorkspaceProvider.
 */
export function useWorkspaceState() {
  /* ------------------------------ documents ------------------------------ */
  const [openDocs, setOpenDocs] = useState([]); // [{id, title, sourceFile, shared}]
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const docHtmlRef = useRef(new Map()); // id -> latest html (mutable cache, not render state)
  const editorApiRef = useRef(null); // registered by EditorPane
  const saveTimersRef = useRef(new Map()); // docId -> pending autosave timer
  const creatingFromTypingRef = useRef(false); // guards double-create while typing into the empty workspace
  const [docsVersion, setDocsVersion] = useState(0); // bump when html replaced programmatically

  /* -------------------------------- chat --------------------------------- */
  const [chatId, setChatId] = useState(null);
  const [chatTitle, setChatTitle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [scope, setScope] = useState("document"); // 'document' | 'cross'
  const [pendingChange, setPendingChange] = useState(null);
  // Indices into pendingChange.edits the user unchecked during review.
  // Shared state: drives both the chat card and the in-document preview.
  const [pendingDeselected, setPendingDeselected] = useState(() => new Set());

  /* --------------------------------- ui ---------------------------------- */
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // The collapsible side panel next to the document. null = closed (canvas
  // takes the full width); otherwise which view the panel is showing.
  const [panel, setPanel] = useState("chat"); // null | 'chat' | 'comments' | 'versions' | 'changes'
  const [mobilePane, setMobilePane] = useState("chat"); // 'chat' (panel) | 'editor'
  const [filesOpen, setFilesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // 'upgrade'|'getstarted'|'docs'|'bug'|'settings'|'profile'
  const [toast, setToast] = useState(null);
  const [changesVersion, setChangesVersion] = useState(0);
  const [printHtml, setPrintHtml] = useState(null); // non-null while printing
  // Autosave lifecycle for the header's save-state indicator.
  const [saveState, setSaveState] = useState("idle"); // 'idle'|'pending'|'saving'|'saved'|'error'
  // In-document find & replace, owned here so the Edit menu, the toolbar and
  // Ctrl+F all drive the same panel inside EditorPane.
  const [findOpen, setFindOpen] = useState(false);
  const [findNonce, setFindNonce] = useState(0); // bump to re-focus the find input
  const toastTimerRef = useRef(null); // pending auto-dismiss for the current toast

  /* ----------------------------- collaboration ----------------------------- */
  const [shareOpen, setShareOpen] = useState(false);
  const [peers, setPeers] = useState([]);
  // The live editor as state, not just a ref: panels that decorate the document
  // (comments) must re-render when the editor is swapped out on a tab switch,
  // otherwise they keep poking at a torn-down instance.
  const [editorInstance, setEditorInstance] = useState(null);

  /* ------------------------------- versions -------------------------------- */
  // Manual commits (git-style). Nothing is snapshotted automatically.
  const [versionsVersion, setVersionsVersion] = useState(0); // bump to refresh the panel
  const [versionPreview, setVersionPreview] = useState(null); // {id, label, createdAt, docId, html, compare}
  const [commitOpen, setCommitOpen] = useState(false); // the "Commit version" dialog

  return {
    // documents
    openDocs, setOpenDocs, activeDocId, setActiveDocId, uploading, setUploading,
    docHtmlRef, editorApiRef, saveTimersRef, creatingFromTypingRef,
    docsVersion, setDocsVersion,
    // chat
    chatId, setChatId, chatTitle, setChatTitle, messages, setMessages,
    sending, setSending, scope, setScope,
    pendingChange, setPendingChange, pendingDeselected, setPendingDeselected,
    // ui
    settings, setSettings, panel, setPanel, mobilePane, setMobilePane,
    filesOpen, setFilesOpen, templatesOpen, setTemplatesOpen,
    infoModal, setInfoModal, toast, setToast, toastTimerRef,
    changesVersion, setChangesVersion, printHtml, setPrintHtml,
    saveState, setSaveState, findOpen, setFindOpen, findNonce, setFindNonce,
    // collaboration
    shareOpen, setShareOpen, peers, setPeers, editorInstance, setEditorInstance,
    // versions
    versionsVersion, setVersionsVersion, versionPreview, setVersionPreview,
    commitOpen, setCommitOpen,
  };
}
