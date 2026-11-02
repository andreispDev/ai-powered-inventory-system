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
