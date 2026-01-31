import { RequestHandler } from "express";

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

    console.log(
      "Sending request to OpenRouter with messages:",
      messages.length,
    );

    const requestBody = {
      model: "openai/gpt-3.5-turbo",
      messages: messages,
      max_tokens: 1024,
    };

    console.log("Request to OpenRouter:", {
      url: "https://openrouter.io/api/v1/chat/completions",
      model: requestBody.model,
      messageCount: messages.length,
    });

    const response = await fetch(
      "https://openrouter.io/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : "https://default-app.com",
          "X-Title": "PinIA Chat",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log("OpenRouter response status:", response.status);

    // Read response as text first to debug
    const responseText = await response.text();
    console.log("OpenRouter raw response length:", responseText.length);
    console.log("OpenRouter raw response:", responseText.substring(0, 500));

    if (!response.ok) {
      console.error("OpenRouter HTTP error:", response.status);
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          console.error("OpenRouter error data:", errorData);
          return res.status(response.status).json(errorData);
        } catch (e) {
          console.error("Failed to parse error response:", responseText);
          return res.status(response.status).json({ error: responseText });
        }
      }
      return res
        .status(response.status)
        .json({ error: "Empty error response from OpenRouter" });
    }

    if (!responseText) {
      console.error("OpenRouter returned empty response");
      return res.status(500).json({ error: "Empty response from OpenRouter" });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse OpenRouter response:", e);
      return res
        .status(500)
        .json({ error: "Invalid response format from OpenRouter" });
    }

    const assistantMessage =
      data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    console.log(
      "OpenRouter response received:",
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
