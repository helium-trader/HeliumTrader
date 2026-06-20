import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Use Google Gemini directly with your own API key instead of the Vercel AI
// Gateway (which requires a credit card on file). Get a free key — no card
// required — from https://aistudio.google.com/app/apikey and set it as the
// GOOGLE_GENERATIVE_AI_API_KEY environment variable.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Gemini 2.5 Flash: fast, generous free tier, ideal for short report generation.
export const reportModel = google("gemini-2.5-flash");
