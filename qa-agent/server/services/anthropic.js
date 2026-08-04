import Anthropic from "@anthropic-ai/sdk";
import { createOpenRouterClient } from "./openrouter.js";

// Claude is the default and recommended provider (ADR-002). If only an
// OpenRouter key is configured, run in free mode on OpenRouter's ":free"
// models — zero cost, good for demos/testing, weaker on nuance/compliance.
export function createModelClient(config) {
  if (config.apiKey) return new Anthropic({ apiKey: config.apiKey });
  if (config.openrouterKey) return createOpenRouterClient(config);
  // Fall back to the SDK's standard environment resolution
  // (ANTHROPIC_AUTH_TOKEN / auth profile).
  return new Anthropic();
}

// Back-compat alias
export const createAnthropicClient = createModelClient;
