import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      resume_text,
      resume_pdf_base64,
      job_title,
      job_description,
      job_requirements,
      job_nice_to_haves,
      api_key,
    } = await req.json();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "no_api_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = `Evaluate the ${resume_pdf_base64 ? "attached resume PDF" : "following resume"} against the job requirements.

JOB TITLE: ${job_title}

JOB DESCRIPTION:
${job_description}

REQUIREMENTS:
${job_requirements}

NICE TO HAVES:
${job_nice_to_haves || "None specified"}
${resume_text ? `\nRESUME TEXT:\n${resume_text}\n` : ""}
Respond with a JSON object in this exact format:
{
  "score": <integer 1-10>,
  "summary": "<2-3 sentence explanation>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendation": "<one of: Strong Yes, Yes, Maybe, No>"
}

Scoring guide:
9-10: Exceptional match, exceeds all requirements
7-8: Strong match, meets most or all requirements
5-6: Moderate match, meets some requirements but has gaps
3-4: Weak match, significant gaps
1-2: Poor match, does not meet core requirements

Be objective and specific. Reference actual skills from the resume.`;

    const content: unknown[] = [];
    if (resume_pdf_base64) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: resume_pdf_base64 },
      });
    }
    content.push({ type: "text", text: userText });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system:
          "You are Meridian AI, an expert recruitment analyst. You evaluate resumes against job requirements with precision, objectivity, and fairness. You NEVER discriminate based on name, gender, ethnicity, age, or any protected characteristic. You focus purely on skills, experience, qualifications, and role fit.\n\nYou must respond ONLY with valid JSON, no additional text, no markdown formatting, no code fences. Just the raw JSON object.",
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      let mapped = "scoring_failed";
      if (response.status === 401) mapped = "invalid_api_key";
      else if (response.status === 404) mapped = "model_not_found";
      else if (response.status === 429) mapped = "rate_limited";
      return new Response(
        JSON.stringify({ error: mapped, details: data?.error?.message, type: data?.error?.type }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "scoring_failed", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
