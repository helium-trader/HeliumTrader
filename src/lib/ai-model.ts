import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Use Google Gemini directly with your own API key instead of the Vercel AI
// Gateway (which requires a credit card on file). Get a free key — no card
// required — from https://aistudio.google.com/app/apikey and set it as the
// GOOGLE_GENERATIVE_AI_API_KEY environment variable.
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  // Fail loudly at request time with actionable guidance rather than letting the
  // provider emit an opaque authentication error.
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add a free Google AI Studio key " +
      "(https://aistudio.google.com/app/apikey) to your project environment variables."
  );
}

const google = createGoogleGenerativeAI({ apiKey });

// Gemini 2.5 Flash: fast, generous free tier, ideal for short report generation.
export const reportModel = google("gemini-2.5-flash");
