import { RequestHandler } from "express";
import { OpenAI } from "openai";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

interface ChatResponse {
  message?: string;
  image?: string; // base64 encoded image
  caption?: string; // image description
  error?: string;
}

const createOpenRouterClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.io/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:8080",
      "X-Title": "PinIA Chat",
    },
  });
};

// Detect if user is asking for image generation
const isImageGenerationRequest = (text: string): boolean => {
  const imageKeywords = [
    "generate image",
    "create image",
    "draw",
    "design",
    "make a picture",
    "image of",
    "picture of",
    "show me",
    "visual of",
    "artwork",
    "illustration",
    "generate a picture",
  ];

  const lowerText = text.toLowerCase();
  return imageKeywords.some((keyword) => lowerText.includes(keyword));
};

export const handleChat: RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as { messages: Message[] };

    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid messages format:", messages);
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const client = createOpenRouterClient();

    console.log(
      "Sending request to OpenRouter with messages:",
      messages.length,
    );

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    const isImageRequest =
      lastMessage && lastMessage.role === "user"
        ? isImageGenerationRequest(lastMessage.content)
        : false;

    const response: ChatResponse = {};

    if (isImageRequest) {
      // Generate image using FLUX model
      console.log("Detected image generation request, calling FLUX model");

      try {
        const imageResponse = await client.chat.completions.create({
          model: "black-forest-labs/flux.2-klein-4b",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: lastMessage.content,
            },
          ],
        } as any);

        // Extract image data from response
        const firstChoice = imageResponse.choices[0];
        if (firstChoice.message.content) {
          // For image models, the content might be base64 encoded image data
          response.image = firstChoice.message.content;
          response.caption = lastMessage.content; // Use the prompt as caption
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
        // Fallback to text response if image generation fails
        const textResponse = await client.chat.completions.create({
          model: "openai/gpt-3.5-turbo",
          max_tokens: 1024,
          messages,
        });

        const firstChoice = textResponse.choices[0];
        if (firstChoice.message.content) {
          response.message = firstChoice.message.content;
        } else {
          response.message =
            "I encountered an error generating the image. Please try again.";
        }
      }
    } else {
      // Standard text response
      console.log("Generating text response using GPT-3.5");

      const textResponse = await client.chat.completions.create({
        model: "openai/gpt-3.5-turbo",
        max_tokens: 1024,
        messages,
      });

      const firstChoice = textResponse.choices[0];
      if (firstChoice.message.content) {
        response.message = firstChoice.message.content;
      } else {
        response.message = "I couldn't generate a response.";
      }
    }

    console.log("Response prepared:", {
      hasMessage: !!response.message,
      hasImage: !!response.image,
    });

    res.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
