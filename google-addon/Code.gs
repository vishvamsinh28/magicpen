/**
 * SuperDocs — Google Docs add-on (client side).
 *
 * This Apps Script project is a THIN CLIENT. All AI lives in the SuperDocs
 * backend (this Next.js app): we send the current selection (or the whole doc)
 * as HTML plus an instruction to POST {APP_BASE_URL}/api/gdocs/assist, then
 * write the edited HTML it returns back into the doc.
 *
 * Selection-first: edits replace just the selected top-level paragraphs, or the
 * whole body when nothing is selected. v1 is text-level — run formatting (bold,
 * italic, colour) is not round-tripped.
 *
 * Config lives in Script Properties (Project Settings -> Script Properties):
 *   APP_BASE_URL        e.g. https://your-superdocs.example.com  (no trailing slash)
 *   GDOCS_ADDON_SECRET  the SAME value as the backend's GDOCS_ADDON_SECRET
 */

/* ------------------------------ add-on lifecycle -------------------------- */

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open SuperDocs', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('SuperDocs');
  DocumentApp.getUi().showSidebar(ui);
}

/* --------------------------------- config --------------------------------- */

function props_() {
  return PropertiesService.getScriptProperties();
}

function config_() {
  var p = props_();
  return {
    baseUrl: (p.getProperty('APP_BASE_URL') || '').replace(/\/+$/, ''),
    secret: p.getProperty('GDOCS_ADDON_SECRET') || '',
  };
}

/**
 * One-time setup helper: run this once from the Apps Script editor with your
 * values, or set the same two keys under Project Settings -> Script Properties.
 */
function setConfig(baseUrl, secret) {
  props_().setProperties({
    APP_BASE_URL: String(baseUrl || '').replace(/\/+$/, ''),
    GDOCS_ADDON_SECRET: String(secret || ''),
  });
}

// Resolve the running user's email. Session.getActiveUser().getEmail() returns
// a blank string for consumer (gmail.com) accounts other than the owner, which
// would break account-linking for teammates — so we read it from the signed
// OpenID identity token first (reliable cross-account with the openid +
// userinfo.email scopes granted) and only fall back to Session.
function userEmail_() {
  try {
    var token = ScriptApp.getIdentityToken();
    if (token) {
      var parts = token.split('.');
      if (parts.length >= 2) {
        var json = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
        var claims = JSON.parse(json);
        if (claims && claims.email) return String(claims.email).toLowerCase();
      }
    }
  } catch (err) {
    // fall through to Session
  }
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}

/* -------------------------------- backend --------------------------------- */

function backend_(path, payload) {
  var cfg = config_();
  if (!cfg.baseUrl || !cfg.secret) {
    throw new Error('SuperDocs is not configured yet. Set APP_BASE_URL and GDOCS_ADDON_SECRET in Script Properties.');
  }
  var res = UrlFetchApp.fetch(cfg.baseUrl + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-SuperDocs-Addon': cfg.secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var data = null;
  try { data = JSON.parse(res.getContentText()); } catch (err) { data = null; }
  if (!data) throw new Error('Unexpected response from SuperDocs (HTTP ' + res.getResponseCode() + ').');
  return data;
}

/* ------------------------- selection <-> HTML I/O ------------------------- */

// Climb from any element to the top-level body child that contains it
// (paragraphs, list items and tables all sit directly under the body).
function topLevelChild_(element) {
  var el = element;
  while (el && el.getParent && el.getParent() &&
         el.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION) {
    el = el.getParent();
  }
  return el;
}

// Returns { lines: [text,...], range: {startIndex, count} | null }. With a
// selection we target the covered top-level elements; otherwise the whole body.
function readTarget_() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var sel = doc.getSelection();

  if (sel) {
    var seen = {};
    var indices = [];
    var elements = sel.getRangeElements();
    for (var i = 0; i < elements.length; i++) {
      var top = topLevelChild_(elements[i].getElement());
      if (!top) continue;
      var idx = body.getChildIndex(top);
      if (!seen[idx]) { seen[idx] = true; indices.push(idx); }
    }
    indices.sort(function (a, b) { return a - b; });
    if (indices.length) {
      var lines = indices.map(function (idx) {
        var c = body.getChild(idx);
        return c.getText ? c.getText() : '';
      });
      return { lines: lines, range: { startIndex: indices[0], count: indices.length } };
    }
  }

  // No usable selection -> whole body.
  var all = [];
  var n = body.getNumChildren();
  for (var j = 0; j < n; j++) {
    var child = body.getChild(j);
    all.push(child.getText ? child.getText() : '');
  }
  return { lines: all, range: null };
}

// Wrap plain-text lines as HTML paragraphs for the backend.
function linesToHtml_(lines) {
  return lines.map(function (t) {
    var safe = String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe.trim() ? '<p>' + safe + '</p>' : '<p></p>';
  }).join('\n');
}

// Turn the backend's returned HTML back into plain-text block lines. We only
// need block boundaries, so block close-tags / <br> become line breaks and the
// remaining tags are stripped.
function htmlToLines_(html) {
  var s = String(html || '');
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  var lines = s.split('\n').map(function (t) { return t.replace(/ /g, ' ').replace(/\s+$/, ''); });
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.length ? lines : [''];
}

// Replace the target range (or whole body) with new text lines.
function applyLines_(range, lines) {
  var body = DocumentApp.getActiveDocument().getBody();

  if (range) {
    // Insert the new paragraphs just before the range, then remove the old ones
    // (which have shifted down by lines.length). Top-down removal keeps indices
    // valid; there is always at least the new content left, so Body never empties.
    var at = range.startIndex;
    for (var i = 0; i < lines.length; i++) {
      body.insertParagraph(at + i, lines[i]);
    }
    var removeStart = at + lines.length;
    for (var r = range.count - 1; r >= 0; r--) {
      body.removeChild(body.getChild(removeStart + r));
    }
    return;
  }

  // Whole-body replace. clear() leaves a single empty paragraph to seed from.
  body.clear();
  body.getChild(0).asParagraph().setText(lines[0]);
  for (var k = 1; k < lines.length; k++) {
    body.appendParagraph(lines[k]);
  }
}

/* ----------------------------- server functions --------------------------- */
// Called from Sidebar.html via google.script.run.

function getContext() {
  var doc = DocumentApp.getActiveDocument();
  return { title: doc.getName(), hasSelection: !!doc.getSelection(), email: userEmail_() };
}

function runAssist(message) {
  // Stage-tracked so a failure surfaces WHERE it broke: [identity] / [config] /
  // [read-doc] / [backend] / [apply]. Every Google/Apps-Script exception is
  // caught and returned as a clean message instead of a raw server error.
  var stage = 'start';
  try {
    message = String(message || '').trim();
    if (!message) return { ok: false, error: 'Type an instruction first.' };

    stage = 'identity';
    var email = userEmail_();
    if (!email) {
      return { ok: false, error: "Couldn't read your Google account email — open this doc under the same account that installed the add-on." };
    }

    stage = 'config';
    var cfg = config_();
    if (!cfg.baseUrl || !cfg.secret) {
      return { ok: false, error: 'Not configured: set APP_BASE_URL and GDOCS_ADDON_SECRET in Project Settings → Script Properties, then Save.' };
    }

    stage = 'read-doc';
    var target = readTarget_();
    var title = DocumentApp.getActiveDocument().getName();

    stage = 'backend';
    var data = backend_('/api/gdocs/assist', {
      googleUserId: email,
      title: title,
      html: linesToHtml_(target.lines),
      message: message,
    });

    if (data.ok === false && data.code === 'not_linked') {
      return { ok: false, notLinked: true, connectUrl: data.connectUrl, error: 'Connect your SuperDocs account to continue.' };
    }
    if (data.ok === false) {
      return { ok: false, error: data.message || 'SuperDocs could not complete that request.' };
    }

    stage = 'apply';
    if (data.changed && typeof data.html === 'string') {
      applyLines_(target.range, htmlToLines_(data.html));
    }

    return {
      ok: true,
      changed: !!data.changed,
      reply: data.reply || '',
      summary: data.summary || '',
      scope: target.range ? 'selection' : 'document',
    };
  } catch (err) {
    return { ok: false, error: '[' + stage + '] ' + String((err && err.message) || err) };
  }
}

function getConnectUrl() {
  var email = userEmail_();
  if (!email) return { ok: false, error: "Couldn't read your Google account email." };
  try {
    var data = backend_('/api/gdocs/connect-init', { googleUserId: email });
    if (data.ok) return { ok: true, connectUrl: data.connectUrl };
    return { ok: false, error: data.code || 'error' };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
