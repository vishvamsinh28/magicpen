import { Chats, Messages } from "@/lib/store";
import { runAssistant, summarizeEdits } from "@/lib/gemini";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

// The main AI flow: takes the user's message + the document as numbered HTML
// blocks, asks Gemini for a reply and edit operations, persists the exchange.

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const {
    chatId = null,
    documentId = null,
    scope = "document",
    message,
    mode = "balanced",
    blocks = [],
    docTitle = "",
    attachments = [],
  } = body;

  if (!message || !message.trim()) {
    return Response.json({ error: { message: "Message is required" } }, { status: 400 });
  }

  let chat = chatId ? await Chats.get(chatId, user.id) : null;
  const history = chat ? await Messages.list(chat.id) : [];

  let result;
  try {
    result = await runAssistant({
      message: message.trim(),
      blocks: Array.isArray(blocks) ? blocks.map(String) : [],
      docTitle,
      history,
      attachments,
      mode,
    });
  } catch (err) {
    console.error("[magicpen] AI request failed:", err);
    const status =
      err.code === "ai_not_configured" ? 400 : err.code === "ai_quota" ? 429 : 502;
    return Response.json(
      { error: { message: err.message || "The AI request failed. Please try again.", code: err.code || "ai_error" } },
      { status }
    );
  }

  if (!chat) {
    chat = await Chats.create({
      userId: user.id,
      title: message.trim().replace(/\s+/g, " ").slice(0, 64),
      scope: scope === "cross" ? "cross" : "document",
      documentId,
    });
  } else {
    await Chats.update(chat.id, user.id, {});
  }

  const userMessage = await Messages.add({
    chatId: chat.id,
    userId: user.id,
    role: "user",
    content: message.trim(),
    attachments: attachments.map((a) => ({ name: a.name })),
  });

  const assistantMessage = await Messages.add({
    chatId: chat.id,
    userId: user.id,
    role: "assistant",
    content: result.reply,
    edits: result.edits.length ? result.edits : null,
    editSummary: summarizeEdits(result.edits),
  });

  return Response.json({
    chat,
    userMessage,
    assistantMessage,
    docTitle: result.title,
  });
}
