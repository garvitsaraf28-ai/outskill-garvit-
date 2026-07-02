import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(config) {
  // Explicit key if configured; otherwise the SDK's standard environment
  // resolution (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / auth profile).
  return config.apiKey ? new Anthropic({ apiKey: config.apiKey }) : new Anthropic();
}
