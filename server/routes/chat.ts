import { RequestHandler } from "express";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

interface ChatResponse {
  message?: string;
  image?: string; // base64 encoded image data URL
  caption?: string; // image description
  error?: string;
}

const createOpenRouterClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
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
      // Generate image using Google Gemini 2.0 Flash Exp (Free)
      console.log("Detected image generation request, calling Gemini 2.0 Flash");

      try {
        const imageResponse = await client.chat.completions.create({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            {
              role: "user",
              content: lastMessage.content,
            },
          ],
          modalities: ["image", "text"] as any,
        });

        console.log("Image generation response received");

        const message = imageResponse.choices[0]?.message;
        if (message) {
          // Check for generated images
          const images = (message as any).images;
          if (images && images.length > 0) {
            const image = images[0];
            if (image.image_url?.url) {
              response.image = image.image_url.url; // Base64 data URL
              response.caption = lastMessage.content;
            }
          }
          // Also capture any text content
          if (message.content) {
            response.message = message.content;
          }
        }

        // If no image was generated, log it
        if (!response.image) {
          console.log("No image in response");
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
        response.message =
          "I encountered an error generating the image. Please try again.";
      }
    } else {
      // Standard text response using Google Gemini 2.0 Flash Exp (Free)
      console.log("Generating text response using Gemini 2.0 Flash");

      try {
        const textResponse = await client.chat.completions.create({
          model: "google/gemini-2.0-flash-exp:free",
          messages,
        });

        const message = textResponse.choices[0]?.message;
        if (message?.content) {
          response.message = message.content;
        } else {
          response.message = "I couldn't generate a response.";
        }
      } catch (textError) {
        console.error("Text generation error:", textError);
        response.message = "Error generating response. Please try again.";
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
