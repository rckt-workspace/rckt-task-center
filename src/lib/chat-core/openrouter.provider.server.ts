import type { ILLMProvider, LLMRequest, LLMResponse } from "./llm-types";

export class OpenRouterProvider implements ILLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = "https://openrouter.ai/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(request: LLMRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Title": "RCKT Task Center Assistant",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[OpenRouter] HTTP error:", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as LLMResponse;
    const content = data.choices[0]?.message.content;
    if (!content) {
      console.error("[OpenRouter] no content in response");
      throw new Error("No response from OpenRouter");
    }
    return content;
  }
}

let llmProvider: ILLMProvider | null = null;

export async function initializeLLMProvider(): Promise<ILLMProvider> {
  if (llmProvider) return llmProvider;

  const apiKey = process.env["OPENROUTER_API_KEY"];
  const baseUrl = process.env["OPENROUTER_BASE_URL"] || "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable not configured");
  }

  llmProvider = new OpenRouterProvider(apiKey, baseUrl);
  return llmProvider;
}
