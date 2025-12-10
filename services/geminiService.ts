
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  QuizQuestion, QuizQuestionSchema, 
  StudyPlan, StudyPlanSchema,
  DifficultyLevel, ExplanationStyle, AIPersona,
  Message,
  LearningPath, PathNode,
  AIProgressInsights
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
  // Remove markdown code blocks (```json ... ``` or just ``` ... ```)
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
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
  persona: AIPersona,
  mediaPart?: { inlineData: { data: string; mimeType: string } }
): Promise<string> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";
  
  const personaInstructions = {
    [AIPersona.Professional]: "Tone: Formal, precise, objective, standard academic tone. No emojis. Goal: Deliver accurate, high-quality information efficiently.",
    [AIPersona.Friend]: "Tone: High energy, casual, uses emojis (🚀✨), super encouraging. Goal: Make learning fun and accessible, like a study buddy.",
    [AIPersona.Socratic]: "Tone: Thoughtful, inquisitive. Answer questions with questions to guide the user to the answer. Deep philosophical vibe.",
    [AIPersona.Sergeant]: "Tone: Strict, demanding, concise, military style. Use capitalization for emphasis. 'NO EXCUSES!'. Goal: Push the user to master the material through discipline.",
    [AIPersona.Mentor]: "Tone: Warm, patient, empathetic, soft. 'It's okay to make mistakes'. Goal: Nurture the user's growth and confidence."
  };

  const systemInstruction = `You are LearnMate.
  
  CURRENT MODE:
  - Persona: ${persona}
  - Difficulty Level: ${difficulty}
  - Teaching Style: ${style} (Note: Persona dictates the tone/voice, Style dictates the content structure/method).
  
  PERSONA GUIDELINES:
  ${personaInstructions[persona]}

  MOOD & ADAPTATION:
  Analyze the user's input for emotional cues (frustration, confusion, confidence).
  - If Frustrated: De-escalate, simplify, and encourage (unless Drill Sergeant, then push harder).
  - If Confused: Break it down further, check for understanding.
  - If Confident: Challenge them with a deeper question.

  MULTIMEDIA HANDLING:
  - If an image/PDF/audio is provided, analyze it thoroughly.
  - If Audio: Transcribe relevant parts if needed, answer questions spoken in the audio.
  - If PDF: Summarize key points or answer questions based on the text.
  - If Image: Explain the diagram or text visible.

  VIDEO RECOMMENDATIONS:
  - If the user asks for videos or if a topic is complex and better explained visually, provide a valid YouTube search link or specific famous educational video titles (e.g., CrashCourse, Khan Academy).
  - Format video suggestions as: "I found a great video for you: https://www.youtube.com/watch?v=..."

  GENERAL INSTRUCTIONS:
  1. Explain concepts clearly based on the difficulty level.
  2. If the style is ELI5, use simple language. If Analogy, use strong real-world comparisons.
  3. Be encouraging (in your persona's voice).
  `;

  // Construct history for Gemini
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.content }];
    if (msg.attachmentData) {
      parts.push({
        inlineData: {
          mimeType: msg.attachmentData.mimeType,
          data: msg.attachmentData.data
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
  if (mediaPart) {
    currentParts.unshift(mediaPart);
  }
  
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

export const generateChatTitle = async (message: string): Promise<string> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Generate a short, descriptive title (max 5 words) for a conversation starting with this message: "${message}". Do not use quotes.`,
    });
    return response.text?.trim() || "New Chat";
  } catch (error) {
    console.error("Title Gen Error:", error);
    return "New Chat";
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
                },
                required: ["step", "title", "duration", "description"]
              }
            }
          },
          required: ["topic", "totalDuration", "items"]
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

// --- Learning Path Generator ---

export const generateLearningPath = async (goal: string): Promise<LearningPath> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";

  const prompt = `Create a structured learning path (Curriculum) to achieve the goal: "${goal}". 
  Break it down into 5-10 dependent topics (nodes). 
  Ensure the graph is connected and flows logically from basic to advanced.
  Return a list of nodes where each node has a unique ID, a label, description, and a list of prerequisite IDs (parents).`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  prerequisites: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "IDs of nodes that must be completed before this one"
                  }
                },
                required: ["id", "label", "description", "prerequisites"]
              }
            }
          },
          required: ["title", "description", "nodes"]
        }
      }
    });

    const jsonStr = cleanJsonString(response.text || "{}");
    const rawData = JSON.parse(jsonStr);
    
    // --- Robust BFS Graph Layout Algorithm ---

    // 1. Sanitize Data: Map IDs to Nodes & Validate Prereqs
    const nodeMap = new Map();
    // Normalize IDs to string to prevent type mismatches
    const nodes = rawData.nodes.map((n: any) => ({ ...n, id: String(n.id).trim() }));
    
    // Create quick lookup
    nodes.forEach((n: any) => nodeMap.set(n.id, n));

    // Remove "ghost" prerequisites (IDs that don't exist in the node list)
    const validNodes = nodes.map((n: any) => ({
      ...n,
      prerequisites: (n.prerequisites || [])
        .map((pid: any) => String(pid).trim())
        .filter((pid: string) => nodeMap.has(pid))
    }));

    // 2. Build Adjacency Lists & In-Degree Map
    const adj: Map<string, string[]> = new Map(); // Parent -> Children
    const inDegree: Map<string, number> = new Map(); // Node -> Number of parents

    // Initialize
    validNodes.forEach((n: any) => {
      if (!adj.has(n.id)) adj.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    // Populate graph
    validNodes.forEach((n: any) => {
      n.prerequisites.forEach((parentId: string) => {
        if (!adj.has(parentId)) adj.set(parentId, []);
        adj.get(parentId)!.push(n.id);
        inDegree.set(n.id, (inDegree.get(n.id) || 0) + 1);
      });
    });

    // 3. Layer Assignment using Kahn's Algorithm (BFS)
    const layers: Map<string, number> = new Map();
    const queue: string[] = [];

    // Find roots (nodes with 0 incoming edges)
    inDegree.forEach((count, id) => {
      if (count === 0) {
        layers.set(id, 0);
        queue.push(id);
      }
    });

    // Process queue
    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLayer = layers.get(u)!;
      
      const children = adj.get(u) || [];
      for (const v of children) {
        inDegree.set(v, (inDegree.get(v)!) - 1);
        if (inDegree.get(v) === 0) {
           layers.set(v, currentLayer + 1);
           queue.push(v);
        }
      }
    }

    // 4. Handle Disconnected/Cyclic Nodes
    // If nodes were not reached (due to cycles), force assign them to a later layer
    const maxLayer = Math.max(0, ...Array.from(layers.values()));
    validNodes.forEach((n: any) => {
       if (!layers.has(n.id)) {
          // Fallback: Just put them at the end so they don't stack at 0
          layers.set(n.id, maxLayer + 1);
       }
    });

    // 5. Final Coordinate Assignment
    // Group nodes by layer
    const layerGroups: Record<number, any[]> = {};
    layers.forEach((layer, id) => {
       if (!layerGroups[layer]) layerGroups[layer] = [];
       layerGroups[layer].push(nodeMap.get(id));
    });

    const placedNodes: PathNode[] = [];
    const LEVEL_WIDTH = 300; // X spacing
    const NODE_HEIGHT = 160; // Y spacing
    
    Object.entries(layerGroups).forEach(([layerStr, groupNodes]) => {
       const layer = parseInt(layerStr);
       const count = groupNodes.length;
       // Center vertically around Y=400
       const startY = 400 - ((count - 1) * NODE_HEIGHT) / 2;
       
       groupNodes.forEach((node, idx) => {
          placedNodes.push({
             id: node.id,
             label: node.label,
             description: node.description,
             prerequisites: validNodes.find((vn: any) => vn.id === node.id).prerequisites,
             status: layer === 0 ? 'unlocked' : 'locked',
             x: 100 + (layer * LEVEL_WIDTH),
             y: startY + (idx * NODE_HEIGHT)
          });
       });
    });

    return {
      id: Date.now().toString(),
      userId: '',
      title: rawData.title,
      description: rawData.description,
      nodes: placedNodes,
      progress: 0,
      createdAt: Date.now(),
      isPublic: false
    };

  } catch (error) {
    console.error("Learning Path Error:", error);
    throw error instanceof AppError ? error : new AppError("Failed to generate learning path.", "GEN_ERROR");
  }
};

// --- Analytics Insight Generator ---

export const generateProgressInsights = async (
  stats: any
): Promise<AIProgressInsights> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash";

  const prompt = `Analyze this student's learning data and provide insights.
  Data: ${JSON.stringify(stats)}
  
  Provide:
  1. A short summary of their progress.
  2. Identify 2-3 weak areas based on quiz scores/topics.
  3. 3 actionable study tips.
  4. A prediction for their mastery timeframe.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            weakAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            prediction: { type: Type.STRING }
          },
          required: ["summary", "weakAreas", "tips", "prediction"]
        }
      }
    });

    const jsonStr = cleanJsonString(response.text || "{}");
    return JSON.parse(jsonStr) as AIProgressInsights;
  } catch (error) {
    console.error("Insight Gen Error:", error);
    // Fallback if AI fails
    return {
      summary: "Keep studying to generate insights!",
      weakAreas: [],
      tips: ["Review your recent quizzes", "Study consistently"],
      prediction: "Data unavailable"
    };
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

export const generateSpeech = async (text: string, persona: AIPersona = AIPersona.Professional): Promise<string | null> => {
  validateApiKey();
  const modelId = "gemini-2.5-flash-preview-tts";
  
  // Map personas to voice names
  const voiceMap: { [key in AIPersona]: string } = {
    [AIPersona.Professional]: 'Kore',
    [AIPersona.Friend]: 'Puck',
    [AIPersona.Socratic]: 'Fenrir',
    [AIPersona.Sergeant]: 'Charon',
    [AIPersona.Mentor]: 'Aoede'
  };

  const voiceName = voiceMap[persona] || 'Kore';

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
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
