import { RequestHandler } from "express";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// Ensure message alternation (user/assistant/user/assistant...)
function ensureProperAlternation(messages: Message[]): Message[] {
  const result: Message[] = [];
  let lastRole: "user" | "assistant" | null = null;

  for (const msg of messages) {
    // Skip if same role as last message (to maintain alternation)
    if (msg.role === lastRole) {
      console.warn(
        `Skipping consecutive ${msg.role} message to maintain alternation`
      );
      continue;
    }
    result.push(msg);
    lastRole = msg.role;
  }

  return result;
}

export const handleChat: RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as { messages: Message[] };

    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return res.status(400).json({ error: "Invalid messages format" });
    }

    // Ensure proper role alternation
    const validMessages = ensureProperAlternation(messages);

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      console.error("OpenRouter API key not configured");
      return res
        .status(500)
        .json({ error: "OpenRouter API key not configured" });
    }

    console.log("OpenRouter API Key loaded:", OPENROUTER_API_KEY.substring(0, 20) + "...");
    console.log(
      "Sending request to OpenRouter with messages:",
      messages.length,
    );

    // Debug: log messages structure
    console.log("Messages structure:", JSON.stringify(messages.map((m) => ({
      role: m.role,
      contentType: typeof m.content,
      contentLength: typeof m.content === 'string' ? m.content.length : Array.isArray(m.content) ? m.content.length : 'unknown'
    })), null, 2));

    // Initialize OpenAI client with OpenRouter configuration
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://pinia.example.com",
        "X-Title": "PinIA Chat",
      },
    });

    console.log("Request to OpenRouter:", {
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "arcee-ai/trinity-large-preview:free",
      messageCount: messages.length,
    });

    // Use streaming for real-time text display
    // Ensure proper message alternation for API compatibility
    const validatedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const stream = await client.chat.completions.create({
      model: "allenai/molmo-2-8b:free",
      messages: validatedMessages as any,
      max_tokens: 1024,
      stream: true,
    });

    console.log("OpenRouter stream started successfully");

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullMessage = "";

    // Stream the response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullMessage += content;
        // Send each chunk as SSE
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    console.log(
      "Stream completed, total length:",
      fullMessage.length,
    );

    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat API error:", error);
    res
      .status(500)
      .json({
        error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
  }
};
