
"use strict";

/**
 * ZEYDAL AI – API CORE
 * Version: 2.0.0
 * Project: ZEYDRION FORGE ENTERTAINMENT
 * AI Provider: OpenAI
 */

const CONFIG = {
  name: "ZEYDAL AI",
  version: "2.0.0",
  environment: "production",
  defaultModel: "gpt-4.1-mini",
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

// Extract text from OpenAI Responses API output
function extractOutputText(data) {
  const results = [];

  for (const item of data.output || []) {
    if (item.type !== "message") continue;

    for (const content of item.content || []) {
      if (content.type === "output_text") {
        results.push(content.text);
      }
    }
  }

  return results.join("\n").trim();
}

// OpenAI connection
async function openAIChat(body, env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  let input = [];

  // Support conversation history
  if (Array.isArray(body.messages)) {
    input = body.messages
      .filter(item =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      )
      .slice(-CONFIG.maxHistory)
      .map(item => ({
        role: item.role,
        content: item.content.slice(0, 6000)
      }));
  }

  // Support simple message requests
  else if (
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    input = [{
      role: "user",
      content: body.message.trim()
    }];
  }

  if (input.length === 0) {
    return {
      error: "A valid message is required.",
      status: 400
    };
  }

  const lastMessage = input[input.length - 1];

  if (lastMessage.role !== "user") {
    return {
      error: "The last message must be from the user.",
      status: 400
    };
  }

  const totalLength = input.reduce(
    (total, item) => total + item.content.length,
    0
  );

  if (totalLength > CONFIG.maxMessageLength) {
    return {
      error: "Message is too long.",
      status: 413
    };
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || CONFIG.defaultModel,
        instructions:
          "You are ZEYDAL AI, an intelligent AI assistant. " +
          "Respond helpfully, accurately and naturally. " +
          "Use the user's language when possible.",
        input,
        max_output_tokens: 700
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenAI API error:", data.error?.code);

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
    model: data.model || CONFIG.defaultModel,
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
      provider: "OpenAI",
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
      provider: "OpenAI",
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
      const result = await openAIChat(body, env);

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
