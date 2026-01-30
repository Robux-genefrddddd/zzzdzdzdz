import { RequestHandler } from "express";

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

    const requestBody = {
      model: "black-forest-labs/flux.2-klein-4b",
      prompt: prompt,
      max_tokens: 1024,
    };

    const response = await fetch(
      "https://openrouter.io/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Referer": "https://pinia.example.com",
          "X-Title": "PinIA Chat",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log("OpenRouter image generation status:", response.status);

    const responseText = await response.text();
    console.log("OpenRouter image response length:", responseText.length);

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

    const imageUrl =
      data.choices?.[0]?.message?.image_url?.url ||
      data.choices?.[0]?.message?.content;

    console.log(
      "Image generated successfully, URL length:",
      imageUrl?.length || 0,
    );

    if (!imageUrl) {
      console.error("No image URL in response:", data);
      return res
        .status(500)
        .json({ error: "No image generated from the model" });
    }

    res.json({ imageUrl, prompt });
  } catch (error) {
    console.error("Image generation API error:", error);
    res.status(500).json({
      error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};
