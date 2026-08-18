/**
 * Toast, side-panel and find/replace actions for the workspace UI.
 * Plain factory (no hooks): the provider calls it on every render so each
 * closure sees that render's state, exactly like inline definitions would.
 */
export function createUiActions({
  panel, setPanel, setMobilePane,
  setFindOpen, setFindNonce,
  toastTimerRef, setToast,
}) {
  // One toast at a time; a new message resets the auto-dismiss clock.
  const showToast = (message, type = "error") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  };

  const openFind = () => {
    setFindOpen(true);
    setFindNonce((n) => n + 1);
  };
  const toggleFind = () => {
    setFindOpen((o) => !o);
    setFindNonce((n) => n + 1);
  };
  const closeFind = () => setFindOpen(false);

  // Opening a view also surfaces the panel pane on mobile; closing hands the
  // screen back to the document.
  const openPanel = (view) => {
    setPanel(view);
    setMobilePane("chat");
  };
  const closePanel = () => {
    setPanel(null);
    setMobilePane("editor");
  };
  const togglePanel = (view) => (panel === view ? closePanel() : openPanel(view));

  return { showToast, openFind, toggleFind, closeFind, openPanel, closePanel, togglePanel };
}
