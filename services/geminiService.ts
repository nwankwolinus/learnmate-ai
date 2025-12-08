import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  QuizQuestion, QuizQuestionSchema, 
  StudyPlan, StudyPlanSchema,
  DifficultyLevel, ExplanationStyle,
  Message 
} from "../types";
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Error Handling ---
class AppError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AppError';
  }
}

// --- Helpers ---

const cleanJsonString = (str: string): string => {
  return str.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
};

const validateApiKey = () => {
  if (!process.env.API_KEY) {
    throw new AppError("API Key is missing. Please configure your environment.", "AUTH_ERROR");
  }
};

// --- Core Learning Features ---

export const chatWithLearnMate = async (
  currentMessage: string,
  history: Message[],
  difficulty: DifficultyLevel,
  style: ExplanationStyle,
  imagePart?: { inlineData: { data: string; mimeType: string } }
): Promise<string> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";
  
  const systemInstruction = `You are LearnMate, an adaptive AI tutor. 
  Current Settings:
  - Difficulty Level: ${difficulty}
  - Teaching Style: ${style}
  
  Instructions:
  1. Explain concepts clearly based on the difficulty level.
  2. If the style is ELI5, use simple language. If Analogy, use strong real-world comparisons.
  3. Be encouraging and concise unless asked for deep detail.
  4. If an image is provided, analyze it and explain it in the context of the user's question.
  `;

  // Construct history for Gemini
  // We filter out audio/image-only messages that don't have text representation if needed, 
  // but Gemini 2.5 supports multimodal history.
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.content }];
    if (msg.imageData) {
      parts.push({
        inlineData: {
          mimeType: msg.imageData.mimeType,
          data: msg.imageData.data
        }
      });
    }
    return {
      role: msg.role,
      parts
    };
  });

  // Add current message
  const currentParts: any[] = [{ text: currentMessage }];
  if (imagePart) {
    currentParts.unshift(imagePart);
  }
  
  // To avoid duplication if the caller hasn't added the current message to history yet,
  // we assume 'history' contains PREVIOUS messages.
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [...contents, { role: 'user', parts: currentParts }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    if (error.message?.includes('403') || error.message?.includes('401')) {
      throw new AppError("Authentication failed. Please check your API Key.", "AUTH_ERROR");
    }
    throw new AppError("Failed to communicate with AI service.", "NETWORK_ERROR");
  }
};

// --- Smart Quiz Generator ---

export const generateQuiz = async (topic: string, count: number = 5): Promise<QuizQuestion[]> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";
  
  const prompt = `Generate a quiz about "${topic}" with ${count} multiple-choice questions.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.INTEGER, description: "Zero-based index of the correct option" },
              explanation: { type: Type.STRING, description: "Why this answer is correct" }
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const jsonStr = cleanJsonString(response.text || "[]");
    const rawData = JSON.parse(jsonStr);
    
    // Runtime Validation with Zod
    const result = z.array(QuizQuestionSchema).safeParse(rawData);
    
    if (!result.success) {
      console.error("Quiz Validation Failed:", result.error);
      throw new AppError("AI generated invalid quiz format. Please try again.", "VALIDATION_ERROR");
    }
    
    return result.data;
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    throw error instanceof AppError ? error : new AppError("Failed to generate quiz.", "GEN_ERROR");
  }
};

// --- Study Plan Generator ---

export const generateStudyPlan = async (topic: string, duration: string): Promise<StudyPlan> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";

  const prompt = `Create a study plan for "${topic}" that fits into a "${duration}" timeframe.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            totalDuration: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  description: { type: Type.STRING },
                  resources: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });
    
    const jsonStr = cleanJsonString(response.text || "{}");
    const rawData = JSON.parse(jsonStr);

    // Runtime Validation
    const result = StudyPlanSchema.safeParse(rawData);
    if (!result.success) {
      console.error("Study Plan Validation Failed:", result.error);
      throw new AppError("AI generated invalid plan format.", "VALIDATION_ERROR");
    }

    return result.data;
  } catch (error) {
    console.error("Study Plan Error:", error);
    throw error instanceof AppError ? error : new AppError("Failed to generate study plan.", "GEN_ERROR");
  }
};

// --- Visual Aid Generation ---

export const generateVisualAid = async (prompt: string): Promise<string | null> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text: `Create a clear, educational diagram or illustration for: ${prompt}. White background, simple lines.` }]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return null;
  }
};

// --- Text to Speech ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash-preview-tts";
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

// --- Audio Decoding ---
export const decodeAudioData = async (base64Audio: string, audioContext: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const numChannels = 1;
    const sampleRate = 24000;
    const frameCount = dataInt16.length / numChannels;
    
    const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
};
