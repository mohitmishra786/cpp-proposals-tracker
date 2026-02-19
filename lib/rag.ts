import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { getSupabaseServiceClient } from "./supabase";
import { Email, EmailWithSimilarity, SearchFilters, SourceEmail } from "./types";
import { getExcerpt } from "./utils";
import { v4 as uuidv4 } from "uuid";

// ============================================================
// Types
// ============================================================

export interface RAGResult {
  answer: string;
  sources: SourceEmail[];
  thread_ids: string[];
  query_id: string;
}

interface RetrievedEmail extends EmailWithSimilarity {
  hybrid_score: number;
}

// ============================================================
// Groq client (primary) — OpenAI-compatible SDK pointed at Groq
// ============================================================

let _groq: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable");
    _groq = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groq;
}

// ============================================================
// Anthropic client (fallback)
// ============================================================

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// ============================================================
// Step 1: Vector similarity search
// ============================================================

async function vectorSearch(
  queryEmbedding: number[],
  filters: SearchFilters,
  limit = 15
): Promise<EmailWithSimilarity[]> {
  const supabase = getSupabaseServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("match_emails", {
    query_embedding: queryEmbedding,
    match_threshold: 0.25,
    match_count: limit,
    filter_date_from: filters.date_from ?? null,
    filter_date_to: filters.date_to ?? null,
    filter_author: filters.author ?? null,
  });

  if (error) {
    console.error("[RAG] Vector search error:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    in_reply_to: null,
    references_ids: [],
    body_clean: null,
    month_period: null,
    created_at: new Date().toISOString(),
    similarity: row.similarity,
  }));
}

// ============================================================
// Step 2: Full-text keyword search
// ============================================================

async function keywordSearch(
  query: string,
  filters: SearchFilters,
  limit = 15
): Promise<EmailWithSimilarity[]> {
  const supabase = getSupabaseServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("search_emails_fts", {
    search_query: query,
    match_count: limit,
    offset_val: 0,
    filter_date_from: filters.date_from ?? null,
    filter_date_to: filters.date_to ?? null,
    filter_author: filters.author ?? null,
  });

  if (error) {
    console.error("[RAG] Keyword search error:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    in_reply_to: null,
    references_ids: [],
    body_clean: null,
    month_period: null,
    created_at: new Date().toISOString(),
    rank: row.rank,
  }));
}

// ============================================================
// Step 3: Hybrid merge and re-rank
// ============================================================

function mergeAndRerank(
  vectorResults: EmailWithSimilarity[],
  keywordResults: EmailWithSimilarity[],
  topK = 10
): RetrievedEmail[] {
  const scores = new Map<string, RetrievedEmail>();

  // Normalize vector scores (already 0-1 cosine similarity)
  const vectorWeight = 0.6;
  const keywordWeight = 0.4;

  // Normalize keyword scores to 0-1 range
  const maxRank = Math.max(...keywordResults.map((r) => r.rank ?? 0), 1);

  for (const email of vectorResults) {
    const score = (email.similarity ?? 0) * vectorWeight;
    scores.set(email.message_id, {
      ...email,
      hybrid_score: score,
    });
  }

  for (const email of keywordResults) {
    const normalizedRank = ((email.rank ?? 0) / maxRank) * keywordWeight;
    if (scores.has(email.message_id)) {
      scores.get(email.message_id)!.hybrid_score += normalizedRank;
    } else {
      scores.set(email.message_id, {
        ...email,
        hybrid_score: normalizedRank,
      });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.hybrid_score - a.hybrid_score)
    .slice(0, topK);
}

// ============================================================
// Step 4: Thread expansion
// ============================================================

async function expandThreads(
  emails: RetrievedEmail[],
  queryEmbedding: number[]
): Promise<Email[]> {
  const supabase = getSupabaseServiceClient();
  const allEmails = new Map<string, Email>();
  const MAX_PER_THREAD = 30;
  const MAX_RELEVANT_WITHIN_THREAD = 10;

  for (const email of emails) {
    // Always include the matched email itself
    allEmails.set(email.message_id, email);

    const rootId = email.thread_root_id;
    if (!rootId) continue;

    // Fetch all emails in the thread
    const { data: threadEmails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("thread_root_id", rootId)
      .order("date", { ascending: true })
      .limit(MAX_PER_THREAD + 5); // fetch slightly more to check

    if (error || !threadEmails) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedThreadEmails = threadEmails as any as Email[];

    if (typedThreadEmails.length <= MAX_PER_THREAD) {
      // Include all
      for (const te of typedThreadEmails) {
        allEmails.set(te.message_id, te);
      }
    } else {
      // Too many — do vector similarity within thread to pick the best ones
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: relevantInThread } = await (supabase as any).rpc("match_emails", {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: MAX_RELEVANT_WITHIN_THREAD,
        filter_date_from: null,
        filter_date_to: null,
        filter_author: null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const threadIds = new Set(typedThreadEmails.map((te: any) => te.message_id as string));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relevant = ((relevantInThread ?? []) as any[]).filter((r: any) =>
        threadIds.has(r.message_id)
      );

      // Always include thread root
      const root = typedThreadEmails.find((te) => te.message_id === rootId);
      if (root) allEmails.set(root.message_id, root);

      // Include most relevant
      for (const r of relevant) {
        const full = typedThreadEmails.find((te) => te.message_id === r.message_id);
        if (full) allEmails.set(full.message_id, full);
      }

      // Include parent of the matched email
      const parent = typedThreadEmails.find(
        (te) => te.message_id === email.in_reply_to
      );
      if (parent) allEmails.set(parent.message_id, parent);
    }
  }

  return Array.from(allEmails.values());
}

// ============================================================
// Step 5: Context assembly
// ============================================================

function formatEmailForContext(email: Email, index: number): string {
  const body = email.body_new_content || email.body_clean || "(no body)";
  const truncatedBody = body.slice(0, 1500); // keep context manageable
  return `--- Email ${index + 1} ---
From: ${email.author_name ?? "Unknown"} <${email.author_email ?? ""}>
Date: ${email.date}
Subject: ${email.subject}
${email.source_url ? `URL: ${email.source_url}` : ""}

${truncatedBody}${body.length > 1500 ? "\n[... truncated ...]" : ""}
`;
}

function assembleContext(
  matchedEmails: RetrievedEmail[],
  allContextEmails: Email[]
): { context: string; contextEmails: Email[] } {
  // Sort by date
  const sorted = [...allContextEmails].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Limit total context to avoid huge prompts
  const MAX_EMAILS_IN_CONTEXT = 20;
  const limited = sorted.slice(0, MAX_EMAILS_IN_CONTEXT);

  const context = limited.map(formatEmailForContext).join("\n\n");
  return { context, contextEmails: limited };
}

// ============================================================
// Step 6: LLM invocation
// Primary: Groq (llama-3.3-70b-versatile for complex, llama-3.1-8b-instant for simple)
// Fallback: Anthropic Claude (if LLM_PROVIDER=anthropic)
// ============================================================

const SYSTEM_PROMPT = `You are an expert assistant helping developers explore the C++ standardization mailing list archive (std-proposals@lists.isocpp.org).

Answer the user's question based ONLY on the email discussions provided below.
Always cite specific emails by referencing the author name and date.
If the discussions do not contain enough information to answer, say so clearly.
Never make up information about C++ proposals or decisions.
Format your answer in clear paragraphs with good markdown formatting.
Use specific quotes when they strengthen the answer (use > markdown blockquote syntax).
At the end of your answer, list the 3 most relevant source emails in a "## Sources" section using this exact format:
- [Author Name, Date]: Brief description of their contribution`;

async function callGroq(
  question: string,
  context: string,
  isComplex: boolean
): Promise<string> {
  const groq = getGroqClient();

  // Use the larger model for complex multi-thread questions
  const model = isComplex
    ? "llama-3.3-70b-versatile"
    : "llama-3.1-8b-instant";

  const userMessage = `Question: ${question}

Relevant email discussions from the C++ std-proposals mailing list:

${context}`;

  const response = await groq.chat.completions.create({
    model,
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0]?.message?.content ?? "No answer generated.";
}

async function callClaude(
  question: string,
  context: string,
  isComplex: boolean
): Promise<string> {
  const anthropic = getAnthropic();

  // Use Haiku for simple queries, Sonnet for complex multi-thread analysis
  const model = isComplex
    ? "claude-sonnet-4-6"
    : "claude-haiku-4-5";

  const userMessage = `Question: ${question}

Relevant email discussions from the C++ std-proposals mailing list:

${context}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "No answer generated.";
}

/**
 * Call the appropriate LLM.
 * Defaults to Groq. Set LLM_PROVIDER=anthropic to use Claude instead.
 */
async function callLLM(
  question: string,
  context: string,
  isComplex: boolean
): Promise<string> {
  if (process.env.LLM_PROVIDER === "anthropic") {
    return callClaude(question, context, isComplex);
  }
  return callGroq(question, context, isComplex);
}

// ============================================================
// Step 7: Source extraction
// ============================================================

function extractSources(
  answer: string,
  contextEmails: Email[],
  matchedEmails: RetrievedEmail[]
): SourceEmail[] {
  // Build a set of matched message IDs for scoring
  const matchedScores = new Map(
    matchedEmails.map((e) => [e.message_id, e.hybrid_score])
  );

  // Extract emails mentioned in the answer (look for author names)
  const mentionedAuthors = new Set<string>();
  for (const email of contextEmails) {
    if (
      email.author_name &&
      answer.toLowerCase().includes(email.author_name.toLowerCase())
    ) {
      mentionedAuthors.add(email.author_name);
    }
  }

  // Score all context emails
  const scored = contextEmails
    .map((email) => {
      let score = matchedScores.get(email.message_id) ?? 0;
      if (
        email.author_name &&
        mentionedAuthors.has(email.author_name)
      ) {
        score += 0.2;
      }
      return { email, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ email, score }) => ({
    message_id: email.message_id,
    subject: email.subject,
    author_name: email.author_name,
    date: email.date,
    excerpt: getExcerpt(email, 200),
    source_url: email.source_url,
    relevance_score: Math.min(score, 1),
  }));
}

// ============================================================
// Main RAG function
// ============================================================

export async function askQuestion(
  question: string,
  filters: SearchFilters = {}
): Promise<RAGResult> {
  const queryId = uuidv4();

  // Step 1: Embed the question
  const queryEmbedding = await generateEmbedding(question);

  // Step 2: Hybrid retrieval (vector + keyword in parallel)
  const [vectorResults, kwResults] = await Promise.all([
    vectorSearch(queryEmbedding, filters),
    keywordSearch(question, filters),
  ]);

  // Step 3: Merge and re-rank
  const merged = mergeAndRerank(vectorResults, kwResults);

  if (merged.length === 0) {
    return {
      answer:
        "No relevant discussions found for your question. The archive may not contain information on this specific topic.",
      sources: [],
      thread_ids: [],
      query_id: queryId,
    };
  }

  // Step 4: Thread expansion
  const expandedEmails = await expandThreads(merged, queryEmbedding);

  // Step 5: Context assembly
  const { context, contextEmails } = assembleContext(merged, expandedEmails);

  // Detect complexity: multiple distinct threads = complex
  const uniqueThreads = new Set(merged.map((e) => e.thread_root_id));
  const isComplex = uniqueThreads.size >= 3;

  // Step 6: Call LLM (Groq by default, Anthropic if LLM_PROVIDER=anthropic)
  const answer = await callLLM(question, context, isComplex);

  // Step 7: Extract sources
  const sources = extractSources(answer, contextEmails, merged);

  const threadIds = Array.from(uniqueThreads).filter(Boolean) as string[];

  return {
    answer,
    sources,
    thread_ids: threadIds,
    query_id: queryId,
  };
}
