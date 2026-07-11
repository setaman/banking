const DEFAULT_OLLAMA_ROOT = "http://localhost:11434";

/**
 * Normalizes a user-supplied Ollama base URL into the bare server root:
 * protocol + host + port, no trailing slash, no `/api` suffix.
 *
 * This is the ONE canonical value every Ollama call in this app derives
 * from, so the exact same stored `AiProfile.baseUrl` produces consistent,
 * correct requests everywhere it's used:
 *  - model catalog (`src/lib/ai/model-catalog.ts`): `GET {root}/api/tags`
 *  - chat (`resolveModel` below): `ollama-ai-provider-v2`'s `createOllama`
 *    needs `baseURL: "{root}/api"`, because that package concatenates its
 *    endpoint paths (`/chat`, `/generate`, `/embed`) directly onto whatever
 *    `baseURL` it's given — `url: ({ path }) => \`${baseURL}${path}\`` (see
 *    `node_modules/ollama-ai-provider-v2/dist/index.mjs`) — rather than
 *    resolving against a versioned root the way OpenAI-compatible providers
 *    do. Passing the bare root (no `/api`) makes it request
 *    `{root}/chat`, which doesn't exist on a real Ollama server and 404s —
 *    a failure our error mapping used to misreport as "model not found"
 *    even though the model is pulled and working (the model-listing call
 *    happened to build its URL correctly, masking the mismatch).
 *
 * Accepts either form a user might paste into the settings form — a bare
 * host (`http://localhost:11434`) or one that already ends in `/api`
 * (`http://localhost:11434/api`) — and normalizes both to the same root, so
 * a pasted `/api` suffix doesn't silently double up.
 */
export function normalizeOllamaBaseUrl(rawBaseUrl?: string): string {
  const trimmed = (rawBaseUrl?.trim() || DEFAULT_OLLAMA_ROOT).replace(
    /\/+$/,
    ""
  );
  return trimmed.replace(/\/api$/i, "");
}

/** The `{root}/api` form `ollama-ai-provider-v2`'s `baseURL` option expects. */
export function ollamaApiBaseUrl(rawBaseUrl?: string): string {
  return `${normalizeOllamaBaseUrl(rawBaseUrl)}/api`;
}
