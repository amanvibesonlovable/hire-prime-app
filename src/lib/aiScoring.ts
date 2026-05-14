import { supabase } from "@/integrations/supabase/client";
import { loadPdfJs } from "@/lib/pdfWorker";

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

export async function extractPdfText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to download resume");
  const buf = await res.arrayBuffer();
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text.trim();
}

export async function scoreApplication(params: {
  apiKey: string;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string;
  jobNiceToHaves: string | null;
  resumeText: string;
}): Promise<AIScoreResult> {
  const userPrompt = `Evaluate the following resume against the job requirements.

JOB TITLE: ${params.jobTitle}

JOB DESCRIPTION:
${params.jobDescription}

REQUIREMENTS:
${params.jobRequirements}

NICE TO HAVES:
${params.jobNiceToHaves || "None specified"}

RESUME TEXT:
${params.resumeText}

Respond with a JSON object in this exact format:
{
  "score": <integer 1-10>,
  "summary": "<2-3 sentence explanation of the overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendation": "<one of: Strong Yes, Yes, Maybe, No>"
}

Scoring guide:
9-10: Exceptional match, exceeds all requirements
7-8: Strong match, meets most or all requirements
5-6: Moderate match, meets some requirements but has gaps
3-4: Weak match, significant gaps in requirements
1-2: Poor match, does not meet core requirements

Be objective and specific. Reference actual skills and experience from the resume when explaining strengths and concerns.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are Meridian AI, an expert recruitment analyst. You evaluate resumes against job requirements with precision, objectivity, and fairness. You NEVER discriminate based on name, gender, ethnicity, age, or any protected characteristic. You focus purely on skills, experience, qualifications, and role fit.\n\nYou must respond ONLY with valid JSON, no additional text, no markdown formatting, no code fences. Just the raw JSON object.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (res.status === 401) throw new Error("INVALID_KEY");
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);

  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? "";
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

  const resumeText = await extractPdfText(candidate.resume_url);
  if (!resumeText || resumeText.length < 20) throw new Error("EMPTY_TEXT");

  const result = await scoreApplication({
    apiKey,
    jobTitle: job.title,
    jobDescription: job.description,
    jobRequirements: job.requirements,
    jobNiceToHaves: job.nice_to_haves,
    resumeText,
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
  if (msg === "NO_RESUME" || msg === "EMPTY_TEXT")
    return "Could not extract text from this resume. The PDF may be image-based or corrupted.";
  if (msg === "UNPARSEABLE") return "AI scoring failed — unexpected response. Please try again.";
  if (/network|fetch|Failed to download/i.test(msg))
    return "Failed to connect to AI service. Please check your internet connection and try again.";
  return msg || "AI scoring failed.";
}
