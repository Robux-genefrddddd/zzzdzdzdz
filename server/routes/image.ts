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

    // Generate image using Flux model
    const apiResponse = await client.chat.completions.create({
      model: "black-forest-labs/flux.2-klein-4b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"] as any,
      max_tokens: 1024,
    });

    console.log("Image generation response received");

    const response = apiResponse.choices[0]?.message;
    if (!response) {
      console.error("No response from image generation");
      return res
        .status(500)
        .json({ error: "No response from image generation" });
    }

    let imageUrl: string | null = null;

    // Check for images in the response
    if ((response as any).images && Array.isArray((response as any).images)) {
      const images = (response as any).images;
      if (images.length > 0) {
        imageUrl = images[0]?.image_url?.url;
        console.log("Image generated successfully");
      }
    } else if (
      typeof response.content === "string" &&
      response.content.startsWith("data:image")
    ) {
      // Sometimes the image comes as base64 in content
      imageUrl = response.content;
      console.log("Image received as base64");
    }

    if (!imageUrl) {
      console.error("No image URL in response:", response);
      return res
        .status(500)
        .json({ error: "No image generated from the model" });
    }

    res.json({ imageUrl, prompt });
  } catch (error) {
    console.error("Image generation API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Full error:", error);
    res.status(500).json({
      error: `Server error: ${errorMessage}`,
    });
  }
};
