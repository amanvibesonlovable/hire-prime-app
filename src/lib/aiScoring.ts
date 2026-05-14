import { supabase } from "@/integrations/supabase/client";

export type AIScoreResult = {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: "Strong Yes" | "Yes" | "Maybe" | "No";
};

export async function getApiKey(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("settings")
    .select("anthropic_api_key")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.anthropic_api_key ?? null;
}

export async function fetchPdfAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to download resume");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function scoreApplication(params: {
  apiKey: string;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string;
  jobNiceToHaves: string | null;
  resumePdfBase64: string;
}): Promise<AIScoreResult> {
  const { data, error } = await supabase.functions.invoke("score-resume", {
    body: {
      resume_pdf_base64: params.resumePdfBase64,
      job_title: params.jobTitle,
      job_description: params.jobDescription,
      job_requirements: params.jobRequirements,
      job_nice_to_haves: params.jobNiceToHaves,
      api_key: params.apiKey,
    },
  });

  if (error || (data && data.error)) {
    const code = (data && data.error) || "scoring_failed";
    if (code === "invalid_api_key") throw new Error("INVALID_KEY");
    if (code === "rate_limited") throw new Error("RATE_LIMITED");
    if (code === "model_not_found") throw new Error("MODEL_NOT_FOUND");
    throw new Error(code);
  }

  const text: string = data?.content?.[0]?.text ?? "";
  let parsed: AIScoreResult;
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("UNPARSEABLE");
  }
  return parsed;
}

export async function runScoringForApplication(applicationId: string, apiKey: string) {
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, candidate:candidates(resume_url), job:jobs(title, description, requirements, nice_to_haves)")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) throw new Error("Application not found");
  const candidate = app.candidate as any;
  const job = app.job as any;
  if (!candidate?.resume_url) throw new Error("NO_RESUME");

  const resumePdfBase64 = await fetchPdfAsBase64(candidate.resume_url);
  if (!resumePdfBase64) throw new Error("EMPTY_TEXT");

  const result = await scoreApplication({
    apiKey,
    jobTitle: job.title,
    jobDescription: job.description,
    jobRequirements: job.requirements,
    jobNiceToHaves: job.nice_to_haves,
    resumePdfBase64,
  });

  const { error: upErr } = await supabase
    .from("applications")
    .update({
      ai_score: result.score,
      ai_summary: result.summary,
      ai_strengths: result.strengths,
      ai_concerns: result.concerns,
      ai_recommendation: result.recommendation,
      ai_scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (upErr) throw upErr;
  return result;
}

export function aiErrorToToast(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "INVALID_KEY") return "Invalid API key. Please check your key in Settings.";
  if (msg === "RATE_LIMITED") return "Rate limited. Please wait a moment and try again.";
  if (msg === "MODEL_NOT_FOUND") return "AI model not available. Please try again later.";
  if (msg === "NO_RESUME" || msg === "EMPTY_TEXT")
    return "Could not read this resume PDF. The file may be missing or corrupted.";
  if (msg === "UNPARSEABLE") return "AI scoring failed — unexpected response. Please try again.";
  if (/network|fetch|Failed to download/i.test(msg))
    return "Failed to connect to AI service. Please check your internet connection and try again.";
  return msg || "AI scoring failed.";
}
