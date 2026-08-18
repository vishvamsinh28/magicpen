// Gemini-backed document assistant. The model receives the document as
// numbered HTML blocks and returns JSON edit operations that the client
// applies in place — untouched blocks are never regenerated.
//
// This file is the module's public entry — implementation lives in
// src/lib/gemini/ (config, prompt, response parsing/validation, mock, PDF
// import, assistant orchestration) and is re-exported here so importers never
// need deep paths.

export { runAssistant } from "./gemini/assistant";
export { summarizeEdits } from "./gemini/response";
export { pdfToStructuredHtml } from "./gemini/pdf";
