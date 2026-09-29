import { GoogleGenAI } from "@google/genai";

export interface AiContext {
  name?: string;
  role?: string;
  className?: string;
  subjectName?: string;
  lesson?: string;
}

const tutorPrompt = `You are ICSQC AI Tutor, an educational assistant for International Christian School of Quezon City.

Help learners understand lessons through clear, step-by-step explanations. You can generate reviewers, summaries, practice quizzes, study plans, and explanations. Encourage the learner to reason and learn instead of merely giving an answer.

Language rule: detect the language of the user's latest message and answer entirely in that same language. If the message is in Filipino, answer in Filipino; if it is in English, answer in English. For a mixed-language message, use the dominant language. Do not switch languages based on the user's role, conversation history, or LMS context unless the user explicitly asks for a translation or another language.

Academic integrity is required: do not answer active exam or assessment questions directly, do not provide answer keys to active exams, and do not help a learner bypass assessment rules. If a request appears to be about an active exam, refuse the direct answer and offer a concept explanation or a similar practice problem instead.

Use concise markdown when useful. Be accurate, age-appropriate, supportive, and transparent when information is uncertain.`;

let aiClient: GoogleGenAI | undefined;

const getAiClient = () => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

const isTransientModelError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(message);
};

const contextPrompt = (context: AiContext = {}) => {
  const details = [
    context.name && `Learner name: ${context.name}`,
    context.role && `LMS role: ${context.role}`,
    context.className && `Class: ${context.className}`,
    context.subjectName && `Subject: ${context.subjectName}`,
    context.lesson && `Current lesson: ${context.lesson}`,
  ].filter(Boolean);

  return details.length > 0
    ? `${tutorPrompt}\n\nAvailable LMS context:\n${details.join("\n")}`
    : tutorPrompt;
};

export const generateTutorReply = async (
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  context?: AiContext,
) => {
  const contents = [
    ...conversationHistory.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const client = getAiClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const request = {
    contents,
    config: {
      systemInstruction: contextPrompt(context),
    },
  };

  let response;
  try {
    response = await client.models.generateContent({ model, ...request });
  } catch (error) {
    const fallbackModel = "gemini-2.5-flash-lite";
    if (!isTransientModelError(error) || model === fallbackModel) {
      throw error;
    }

    console.warn(`Gemini model ${model} is temporarily unavailable; retrying with ${fallbackModel}.`);
    response = await client.models.generateContent({ model: fallbackModel, ...request });
  }

  return response.text || "I could not generate a response. Please try again.";
};