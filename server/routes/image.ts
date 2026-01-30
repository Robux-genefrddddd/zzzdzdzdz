import { RequestHandler } from "express";
import OpenAI from "openai";

export const handleGenerateImage: RequestHandler = async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid prompt" });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      console.error("OpenRouter API key not configured");
      return res
        .status(500)
        .json({ error: "OpenRouter API key not configured" });
    }

    console.log("Generating image with prompt:", prompt.substring(0, 100));

    // Initialize OpenAI client with OpenRouter configuration
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://pinia.example.com",
        "X-Title": "PinIA Chat",
      },
    });

    // Use streaming for image generation
    const stream = await client.chat.completions.create({
      model: "bytedance-seed/seedream-4.5",
      messages: [
        {
          role: "user",
          content: `Generate an image: ${prompt}`,
        },
      ],
      max_tokens: 1024,
      stream: true,
    });

    console.log("Image generation stream started");

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    // Stream the response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    console.log("Image generation completed, response length:", fullResponse.length);

    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Image generation API error:", error);
    res.status(500).json({
      error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
