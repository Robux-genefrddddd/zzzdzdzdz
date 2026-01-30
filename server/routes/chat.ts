import { RequestHandler } from "express";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

    console.log("OpenRouter API Key loaded:", OPENROUTER_API_KEY.substring(0, 20) + "...");
    console.log(
      "Sending request to OpenRouter with messages:",
      messages.length,
    );

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

    const apiResponse = await client.chat.completions.create({
      model: "arcee-ai/trinity-large-preview:free",
      messages: messages,
      max_tokens: 1024,
    });

    console.log("OpenRouter response received successfully");

    const assistantMessage =
      apiResponse.choices?.[0]?.message?.content || "I couldn't generate a response.";

    console.log(
      "Response content:",
      assistantMessage.substring(0, 100),
    );
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error("Chat API error:", error);
    res
      .status(500)
      .json({
        error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
  }
};
