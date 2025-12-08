import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion, StudyPlan, DifficultyLevel, ExplanationStyle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---

// Helper to clean JSON string if the model wraps it in markdown code blocks
const cleanJsonString = (str: string): string => {
  return str.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
};

// --- Core Learning Features ---

export const chatWithLearnMate = async (
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  difficulty: DifficultyLevel,
  style: ExplanationStyle,
  imagePart?: { inlineData: { data: string; mimeType: string } }
): Promise<string> => {
  const modelId = "gemini-2.5-flash"; // Efficient for text chat
  
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

  const contents = [];
  
  // Add history (simplified for this demo)
  // In a real app, map history correctly to Content objects
  // For this single-turn/limited-context demo, we'll focus on the current prompt with system instruction
  // But strictly, we should maintain context. Let's just append the current message.
  
  const parts: any[] = [{ text: message }];
  if (imagePart) {
    parts.unshift(imagePart);
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { role: 'user', parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

// --- Smart Quiz Generator ---

export const generateQuiz = async (topic: string, count: number = 5): Promise<QuizQuestion[]> => {
  const modelId = "gemini-2.5-flash"; // Flash is capable enough for this, maybe Pro for very complex topics
  
  const prompt = `Generate a quiz about "${topic}" with ${count} multiple-choice questions. 
  Return ONLY raw JSON. Do not use markdown blocks.`;

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
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    return [];
  }
};

// --- Study Plan Generator ---

export const generateStudyPlan = async (topic: string, duration: string): Promise<StudyPlan> => {
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
    return JSON.parse(jsonStr) as StudyPlan;
  } catch (error) {
    console.error("Study Plan Error:", error);
    throw error;
  }
};

// --- Visual Aid Generation ---

export const generateVisualAid = async (prompt: string): Promise<string | null> => {
  // Use gemini-2.5-flash-image for generating educational diagrams/images
  const modelId = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text: `Create a clear, educational diagram or illustration for: ${prompt}. White background, simple lines.` }]
      }
    });

    // Iterate parts to find the image
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
  const modelId = "gemini-2.5-flash-preview-tts";
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // Puck is usually clear/friendly
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

// --- Audio Decoding Helper for Browser ---
export const decodeAudioData = async (base64Audio: string, audioContext: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    // Note: The TTS model returns raw PCM. 
    // However, the standard `ai.models.generateContent` with TTS usually returns a container format or PCM depending on config.
    // The specific Gemini TTS preview usually returns raw PCM or WAV-like structure. 
    // If raw PCM, we need the `decodeAudioData` manual implementation from the prompt guidance.
    // However, `gemini-2.5-flash-preview-tts` usually sends PCM 24kHz Mono.
    
    // Let's implement the manual PCM decoder as per 'Live API' guidance but adapted for static TTS if needed.
    // Actually, for the `generateContent` TTS endpoint (not Live), it typically returns valid audio file bytes (like WAV/MP3) wrapped in the blob?
    // Wait, the prompt examples for TTS say: "The audio bytes returned by the API is raw PCM data."
    // So we MUST use the manual decoder.
    
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
