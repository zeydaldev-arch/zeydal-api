
"use strict";

/**
 * ZEYDAL AI – API CORE
 * Version: 3.0.0
 * Project: ZEYDRION FORGE ENTERTAINMENT
 * AI Provider: Google Gemini
 */

const CONFIG = {
  name: "ZEYDAL AI",
  version: "3.0.0",
  environment: "production",
  defaultModel: "gemini-3.5-flash-lite",
  maxMessageLength: 12000,
  maxHistory: 12
};

// CORS configuration
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

// JSON response helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// Gemini response text extraction
function extractOutputText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];

  return parts
    .filter(part => typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();
}

// Gemini connection
async function geminiChat(body, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  let messages = [];

  if (Array.isArray(body.messages)) {
    messages = body.messages
      .filter(item =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.trim()
      )
      .slice(-CONFIG.maxHistory);
  } else if (
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    messages = [{
      role: "user",
      content: body.message.trim()
    }];
  }

  if (messages.length === 0) {
    return {
      error: "A valid message is required.",
      status: 400
    };
  }

  if (messages[messages.length - 1].role !== "user") {
    return {
      error: "The last message must be from the user.",
      status: 400
    };
  }

  const totalLength = messages.reduce(
    (total, item) => total + item.content.length,
    0
  );

  if (totalLength > CONFIG.maxMessageLength) {
    return {
      error: "Message is too long.",
      status: 413
    };
  }

  // Convert assistant role to Gemini model role
  const contents = messages.map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{
      text: item.content.slice(0, 6000)
    }]
  }));

  const model = env.GEMINI_MODEL || CONFIG.defaultModel;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are ZEYDAL AI, an intelligent AI assistant. " +
              "Respond helpfully, accurately and naturally. " +
              "Use the user's language when possible."
          }]
        },
        contents,
        generationConfig: {
          maxOutputTokens: 700,
          temperature: 0.7
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "Gemini API error:",
      response.status,
      data.error?.status || "UNKNOWN"
    );

    return {
      error: "AI service request failed.",
      status: response.status === 429 ? 429 : 502
    };
  }

  const answer = extractOutputText(data);

  if (!answer) {
    return {
      error: "AI returned an empty response.",
      status: 502
    };
  }

  return {
    success: true,
    system: CONFIG.name,
    version: CONFIG.version,
    model,
    response: answer,
    ai_connected: true
  };
}

// Main API router
async function handleRequest(request, env) {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  // Health check
  if (
    url.pathname === "/api/status" &&
    request.method === "GET"
  ) {
    return jsonResponse({
      success: true,
      system: CONFIG.name,
      version: CONFIG.version,
      status: "online",
      provider: "Google Gemini",
      timestamp: new Date().toISOString()
    });
  }

  // API information
  if (
    url.pathname === "/api" &&
    request.method === "GET"
  ) {
    return jsonResponse({
      name: CONFIG.name,
      version: CONFIG.version,
      provider: "Google Gemini",
      endpoints: [
        "GET /api",
        "GET /api/status",
        "POST /api/chat"
      ]
    });
  }

  // AI chat endpoint
  if (
    url.pathname === "/api/chat" &&
    request.method === "POST"
  ) {
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse({
        success: false,
        error: "Invalid JSON request."
      }, 400);
    }

    try {
      const result = await geminiChat(body, env);

      if (result.error) {
        return jsonResponse({
          success: false,
          error: result.error
        }, result.status);
      }

      return jsonResponse(result);

    } catch (error) {
      console.error("ZEYDAL AI error:", error.message);

      return jsonResponse({
        success: false,
        error: "AI service is temporarily unavailable."
      }, 502);
    }
  }

  return jsonResponse({
    success: false,
    error: "Endpoint not found."
  }, 404);
}

// Cloudflare Workers entry point
export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("API error:", error.message);

      return jsonResponse({
        success: false,
        error: "Internal server error."
      }, 500);
    }
  }
};
