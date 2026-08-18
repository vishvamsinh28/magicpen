"use client";

/**
 * Workspace context — the single shared state tree behind the MagicPen app
 * shell. This file stays the only context/provider; state lives in
 * workspace/state.js and behavior in the workspace/* action factories, which
 * are recreated every render so their closures always see current state
 * (matching the previous inline definitions). The `value` shape is the
 * public API — dozens of components destructure it, so keys must not change.
 */
import { createContext, useContext } from "react";
import { apiFetch } from "@/lib/client-utils";
import { useWorkspaceState } from "./workspace/state";
import { createUiActions } from "./workspace/ui-actions";
import { createDocActions } from "./workspace/doc-actions";
import { createAutosave } from "./workspace/autosave";
import { createChangeActions } from "./workspace/change-actions";
import { createChatActions } from "./workspace/chat-actions";
import { createPendingActions } from "./workspace/pending-actions";
import { createVersionActions } from "./workspace/version-actions";
import { createExportActions } from "./workspace/export-actions";
import { useWorkspacePersistence } from "./workspace/use-persistence";

const WorkspaceContext = createContext(null);

/**
 * Accessor for the workspace context value. Only valid under
 * WorkspaceProvider; elsewhere it returns null.
 */
export const useWorkspace = () => useContext(WorkspaceContext);

/**
 * Provides workspace state and actions to the app shell. `user` is the
 * signed-in account, resolved by AppGate before the workspace mounts.
 * Hooks run in a fixed order (state bag, then persistence effects); the
 * factories between them contain no hooks.
 */
export function WorkspaceProvider({ user, children }) {
  const s = useWorkspaceState();

  // Best-effort logout — navigate home even if the API call fails.
  const signOut = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/");
  };

  // Composition order follows the dependency chain: ui → docs → changes →
  // chat → pending/versions/export (later factories receive earlier actions).
  const ui = createUiActions(s);
  const docs = createDocActions({ ...s, ...ui });
  const autosave = createAutosave({ ...s, ...ui, addTab: docs.addTab });
  const changes = createChangeActions({ ...s, ...ui, addTab: docs.addTab });
  const chat = createChatActions({
    ...s, ...ui,
    applyEdits: changes.applyEdits,
    renameDocument: docs.renameDocument,
    openDocument: docs.openDocument,
  });
  const pending = createPendingActions({
    ...s,
    applyEdits: changes.applyEdits,
    recordChange: changes.recordChange,
    markMessage: chat.markMessage,
  });
  const versions = createVersionActions({ ...s, ...ui });
  const exporter = createExportActions({ ...s, ...ui });

  useWorkspacePersistence({ ...s, user, openDocument: docs.openDocument });

  const value = {
    // account
    user, signOut,
    // documents
    openDocs: s.openDocs, activeDocId: s.activeDocId,
    activeDoc: s.openDocs.find((d) => d.id === s.activeDocId) || null,
    uploading: s.uploading, docsVersion: s.docsVersion,
    docHtmlRef: s.docHtmlRef, editorApiRef: s.editorApiRef,
    openDocument: docs.openDocument, createBlankDocument: docs.createBlankDocument,
    createDocumentFromTemplate: docs.createDocumentFromTemplate, uploadFiles: docs.uploadFiles,
    closeDocument: docs.closeDocument, renameDocument: docs.renameDocument,
    deleteDocument: docs.deleteDocument, onEditorUpdate: autosave.onEditorUpdate,
    // collaboration
    shareOpen: s.shareOpen, setShareOpen: s.setShareOpen,
    markDocumentShared: docs.markDocumentShared, peers: s.peers, setPeers: s.setPeers,
    editorInstance: s.editorInstance, setEditorInstance: s.setEditorInstance,
    // chat
    chatId: s.chatId, chatTitle: s.chatTitle, messages: s.messages, sending: s.sending,
    scope: s.scope, setScope: s.setScope, pendingChange: s.pendingChange,
    pendingDeselected: s.pendingDeselected,
    togglePendingEdit: pending.togglePendingEdit, setPendingSelectAll: pending.setPendingSelectAll,
    sendMessage: chat.sendMessage,
    approvePendingChange: pending.approvePendingChange,
    rejectPendingChange: pending.rejectPendingChange,
    newConversation: chat.newConversation, loadChat: chat.loadChat, deleteChat: chat.deleteChat,
    // changes
    changesVersion: s.changesVersion, restoreChange: changes.restoreChange,
    applyEdits: changes.applyEdits,
    // versions (manual commits)
    versionsVersion: s.versionsVersion, versionPreview: s.versionPreview,
    commitOpen: s.commitOpen, setCommitOpen: s.setCommitOpen,
    commitVersion: versions.commitVersion, openVersionPreview: versions.openVersionPreview,
    closeVersionPreview: versions.closeVersionPreview,
    toggleVersionCompare: versions.toggleVersionCompare,
    restoreVersion: versions.restoreVersion, renameVersion: versions.renameVersion,
    deleteVersion: versions.deleteVersion,
    // export & print
    downloadDocument: exporter.downloadDocument, printHtml: s.printHtml, setPrintHtml: s.setPrintHtml,
    // autosave indicator
    saveState: s.saveState,
    // find & replace
    findOpen: s.findOpen, findNonce: s.findNonce,
    openFind: ui.openFind, toggleFind: ui.toggleFind, closeFind: ui.closeFind,
    // settings & ui
    settings: s.settings, setSettings: s.setSettings,
    panel: s.panel, openPanel: ui.openPanel, closePanel: ui.closePanel, togglePanel: ui.togglePanel,
    mobilePane: s.mobilePane, setMobilePane: s.setMobilePane,
    filesOpen: s.filesOpen, setFilesOpen: s.setFilesOpen,
    templatesOpen: s.templatesOpen, setTemplatesOpen: s.setTemplatesOpen,
    infoModal: s.infoModal, setInfoModal: s.setInfoModal,
    toast: s.toast, showToast: ui.showToast,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
