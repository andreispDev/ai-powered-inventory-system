// Local Ollama. Server and worker only: it has no login, so the browser must never reach it.

export type LlmClient = { generate: (prompt: string) => Promise<string> };

export function createOllama(
  url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.2:3b",
): LlmClient {
  return {
    async generate(prompt) {
      const response = await fetch(`${url}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.2, num_predict: 120 } }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`Ollama responded ${response.status}`);
      const { response: text } = (await response.json()) as { response: string };
      return text.trim();
    },
  };
}

export type ToolCall = { name: string; arguments: unknown };
export type ChatMessage = { role: string; content: string; tool_calls?: { function: ToolCall }[] };
export type ChatChunk = { content?: string; toolCalls?: ToolCall[]; promptTokens?: number; completionTokens?: number };
export type ChatModel = { chat: (messages: ChatMessage[], tools: readonly unknown[], signal?: AbortSignal) => AsyncIterable<ChatChunk> };

/** Ollama is off, unreachable or refused. Everything else about the app keeps working. */
export class OllamaError extends Error {}

const CHAT_TIMEOUT_MS = 120_000;

export function createOllamaChat(
  url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  model = process.env.OLLAMA_CHAT_MODEL ?? "llama3.2:3b",
): ChatModel {
  return {
    async *chat(messages, tools, signal) {
      const timeout = AbortSignal.timeout(CHAT_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${url}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, messages, tools, stream: true, options: { temperature: 0.1 } }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new OllamaError(String(error));
      }
      if (!response.ok || !response.body) throw new OllamaError(`Ollama responded ${response.status}`);

      let buffer = "";
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line) as {
            message?: { content?: string; tool_calls?: { function: ToolCall }[] };
            prompt_eval_count?: number;
            eval_count?: number;
          };
          yield {
            content: data.message?.content,
            toolCalls: data.message?.tool_calls?.map((call) => call.function),
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
          };
        }
      }
    },
  };
}
