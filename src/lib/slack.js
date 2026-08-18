// Low-level Slack plumbing: request-signature verification, a tiny hand-rolled
// Web API client (no SDK dependency), the OAuth code exchange for
// public/multi-workspace installs, and signed "connect" state used by the
// browser account-linking flow. Nothing here touches the store; token lookup
// and business logic live in slack-actions.js.
//
// This file is the module's public entry — implementation lives in
// src/lib/slack/ and is re-exported here so importers never need deep paths.

export { appBaseUrl, connectUrl, docUrl } from "./slack/urls";
export { verifySlackSignature, readVerified } from "./slack/verify";
export {
  postMessage,
  authTest,
  deleteMessage,
  deleteFile,
  conversationsHistory,
  conversationsReplies,
  downloadSlackFile,
  uploadFileToSlack,
} from "./slack/api";
export { exchangeInstallCode, signConnectState, verifyConnectState } from "./slack/oauth";
