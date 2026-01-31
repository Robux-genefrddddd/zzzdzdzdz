import { RequestHandler } from "express";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

type ORChatMessage = {
  role: string;
  content: string | null;
  reasoning_details?: unknown;
};

export const handleChat: RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as { messages: Message[] };

    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      console.error("OpenRouter API key not configured");
      return res
        .status(500)
        .json({ error: "OpenRouter API key not configured" });
    }

    console.log(
      "Sending request to OpenRouter with messages:",
      messages.length,
    );

    // Initialize OpenAI client with OpenRouter base URL
    const client = new OpenAI({
      baseURL: "https://openrouter.io/api/v1",
      apiKey: OPENROUTER_API_KEY,
    });

    // Get the origin from the request or use a fallback
    const origin = req.get('origin') || req.get('referer') || 'http://localhost:8080';

    console.log("Request to OpenRouter:", {
      model: "arcee-ai/trinity-large-preview:free",
      messageCount: messages.length,
      referer: origin,
    });

    // Create chat completion with reasoning enabled
    const apiResponse = await client.chat.completions.create({
      model: "arcee-ai/trinity-large-preview:free",
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.reasoning_details && { reasoning_details: msg.reasoning_details }),
      })),
      max_tokens: 1024,
      // @ts-ignore - reasoning is a valid parameter for some OpenRouter models
      reasoning: { enabled: true },
      // @ts-ignore - headers are passed through
      headers: {
        "HTTP-Referer": origin,
        "X-Title": "PinIA Chat",
      },
    });

    console.log("OpenRouter response received");

    // Extract the assistant message with reasoning details
    const response = apiResponse.choices[0].message as ORChatMessage;
    const assistantMessage = response.content || "I couldn't generate a response.";

    console.log(
      "OpenRouter assistant message:",
      assistantMessage.substring(0, 100),
    );

    res.json({
      message: assistantMessage,
      reasoning_details: response.reasoning_details,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    res
      .status(500)
      .json({
        error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
  }
};
