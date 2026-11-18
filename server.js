
"use strict";

/**
 * ZEYDAL AI – API CORE
 * Version: 1.0.0
 * Project: ZEYDRION FORGE ENTERTAINMENT
 */

const CONFIG = {
  name: "ZEYDAL AI",
  version: "1.0.0",
  environment: "production"
};

// JSON response helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// Main API router
async function handleRequest(request) {
  const url = new URL(request.url);

  // Health check
  if (url.pathname === "/api/status" && request.method === "GET") {
    return jsonResponse({
      success: true,
      system: CONFIG.name,
      version: CONFIG.version,
      status: "online",
      timestamp: new Date().toISOString()
    });
  }

  // API information
  if (url.pathname === "/api" && request.method === "GET") {
    return jsonResponse({
      name: CONFIG.name,
      version: CONFIG.version,
      message: "ZEYDAL AI API is running.",
      endpoints: [
        "GET /api",
        "GET /api/status",
        "POST /api/chat"
      ]
    });
  }

  // Chat endpoint placeholder
  if (url.pathname === "/api/chat" && request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse({
        success: false,
        error: "Invalid JSON request."
      }, 400);
    }

    if (!body.message || typeof body.message !== "string") {
      return jsonResponse({
        success: false,
        error: "A valid message is required."
      }, 400);
    }

    return jsonResponse({
      success: true,
      system: CONFIG.name,
      message: "Chat request received.",
      received: body.message,
      ai_connected: false
    });
  }

  return jsonResponse({
    success: false,
    error: "Endpoint not found."
  }, 404);
}

// Cloudflare Workers entry point
export default {
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Internal server error."
      }, 500);
    }
  }
};
