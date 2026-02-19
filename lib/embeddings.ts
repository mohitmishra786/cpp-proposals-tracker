import OpenAI from "openai";

// ============================================================
// OpenAI client (fallback)
// ============================================================

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ============================================================
// Groq client (primary) — uses OpenAI-compatible SDK
// Groq does NOT provide an embeddings endpoint, so we use the
// HuggingFace Inference API (free tier) for embeddings instead.
// Model: BAAI/bge-small-en-v1.5  →  384 dimensions
// ============================================================

const HF_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
// HuggingFace Inference Router (2025+). Requires HUGGINGFACE_API_KEY (free tier available).
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`;

async function hfEmbed(texts: string[]): Promise<number[][]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY; // optional — free tier works without it

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: true },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace embedding error (${response.status}): ${err}`);
  }

  // Response is either number[][] directly or wrapped — handle both
  const json = await response.json();

  // HF returns number[][] when inputs is an array of strings
  if (Array.isArray(json) && Array.isArray(json[0])) {
    return json as number[][];
  }

  // Single string input returned as number[]
  if (Array.isArray(json) && typeof json[0] === "number") {
    return [json as number[]];
  }

  throw new Error("Unexpected HuggingFace response shape");
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate a single embedding vector for a text string.
 *
 * Primary: HuggingFace BAAI/bge-small-en-v1.5 (384 dims, free, no key needed)
 * Fallback: OpenAI text-embedding-3-small (1536 dims) if OPENAI_API_KEY is set
 *           and EMBEDDING_PROVIDER=openai
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 32000);

  if (process.env.EMBEDDING_PROVIDER === "openai") {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncated,
      dimensions: 1536,
    });
    return response.data[0].embedding;
  }

  // Default: HuggingFace (384 dims)
  const results = await hfEmbed([truncated]);
  return results[0];
}

/**
 * Generate embeddings for multiple texts.
 *
 * Primary: HuggingFace BAAI/bge-small-en-v1.5 (384 dims, free, no key needed)
 * Fallback: OpenAI text-embedding-3-small (1536 dims) if EMBEDDING_PROVIDER=openai
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const truncated = texts.map((t) => t.slice(0, 32000));

  if (process.env.EMBEDDING_PROVIDER === "openai") {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncated,
      dimensions: 1536,
    });
    return response.data.map((item) => item.embedding);
  }

  // Default: HuggingFace (384 dims)
  return hfEmbed(truncated);
}
