export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature: number;
  max_tokens?: number;
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ILLMProvider {
  chat(request: LLMRequest): Promise<string>;
}
