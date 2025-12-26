
import { 
  GoogleGenAI, 
  GenerateContentResponse, 
  Content, 
  Part, 
  Modality, 
  HarmCategory, 
  HarmBlockThreshold, 
  Type, 
  FunctionDeclaration
} from "@google/genai";
import { Message, Role, Attachment, Source, ChatConfig, PersonalizationConfig, StudentConfig, ExamConfig, ExamQuestion, Persona, Flashcard, StudyPlan, MediaAction } from "../types";
import { memoryService } from "./memoryService";

// Helper to init AI - STRICTLY use process.env.API_KEY
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

const HELPLINE_MESSAGE = `I cannot fulfill this request. I care about your well-being. If you are going through a difficult time or are in immediate danger, please reach out for support:
- **Suicide & Crisis Lifeline**: 988 (USA)
- **Emergency**: Call 911 or your local emergency number
- **International Support**: Visit findahelpline.com
You are not alone. Please seek help from a professional.`;

// Helper to format history
const formatHistory = (messages: Message[]): Content[] => {
  return messages.map((msg) => {
    const parts: Part[] = [];
    if (msg.role === Role.USER && msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att) => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.base64,
          },
        });
      });
    }
    if (msg.text) parts.push({ text: msg.text });
    return { role: msg.role, parts: parts };
  }).filter(content => content.parts.length > 0); 
};

export const MEDIA_PLAYER_TOOL: FunctionDeclaration = {
  name: "play_media",
  description: "Plays music, videos, or podcasts. Use this when the user asks to listen to a song, watch a video, or play media.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      media_type: { type: Type.STRING, enum: ["song", "video", "playlist", "podcast"] },
      title: { type: Type.STRING, description: "Title of the song or video" },
      artist: { type: Type.STRING, description: "Artist or Channel name (optional)" },
      platform: { type: Type.STRING, enum: ["youtube", "spotify"], description: "Platform to play on. Default to youtube." },
      query: { type: Type.STRING, description: "Search query for the media (e.g. 'Shape of You Ed Sheeran')" }
    },
    required: ["media_type", "title", "platform", "query"]
  }
};

export const SAVE_MEMORY_TOOL: FunctionDeclaration = {
  name: "save_memory",
  description: "Saves a new fact, preference, or piece of information about the user to long-term memory. Use this when the user tells you something important about themselves, their projects, or their life.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING, description: "The fact or information to remember (e.g. 'User likes spicy food', 'Working on Zara AI project')." },
      category: { type: Type.STRING, enum: ["core", "preference", "project", "emotional", "fact"], description: "The category of the memory." },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords associated with this memory." }
    },
    required: ["content", "category"]
  }
};

export const ZARA_CORE_IDENTITY = `
**IDENTITY: Zara AI — Your Adaptive & Intelligent Companion**

**CREATOR INFORMATION (STRICT & MANDATORY):**
If asked "Who created you?", "Who made you?", "Who is your developer?" or about your origins, reply with pride but casually:
- **Developer**: **Mohammed Majeed**
- **Context**: He's a brilliant developer who built me with passion. He wanted me to be a smart, unique, and super friendly AI for everyone.

====================================================================
## 1. ADAPTIVE PERSONALITY & TONE (CRITICAL)
====================================================================
You are a social chameleon. You must INSTANTLY detect the user's tone and mirror it.

- **MODE A: PROFESSIONAL / FORMAL**
  - **Trigger**: User speaks formally, asks technical questions, uses polite English, or is business-oriented.
  - **Response**: Be precise, expert, efficient, and polite. Use clear structure. No slang.

- **MODE B: FRIENDLY / CASUAL (The "Nanba" Mode)**
  - **Trigger**: User uses slang, speaks casually, uses Tamil/Tanglish, calls you "Bro", "Machi", "Nanba", or is playful.
  - **Response**: Be warm, chatty, enthusiastic, and fun. Use emojis.

- **MODE C: EMPATHETIC**
  - **Trigger**: User is sad, frustrated, or sharing personal feelings.
  - **Response**: Be supportive, gentle, and a good listener.

====================================================================
## 2. LANGUAGE & LOCALIZATION (AUTO-DETECT)
====================================================================
- **MULTI-LINGUAL SUPPORT**: You support ALL languages.
- **RULE**: Reply in the **EXACT language and dialect** the user is speaking.
  - **Tamil**: Speak pure or colloquial Tamil.
  - **Tanglish**: Mix English and Tamil naturally.
  - **English**: Speak standard English.

====================================================================
## 4. VISUALIZATION & DIAGRAMS (STRICT MERMAID v11.4.1 RULES)
====================================================================
If the user asks for a diagram, flowchart, visualization, or visual explanation:
- **ACTION**: Generate a **MERMAID.JS** code block.
- **SYNTAX RULES (CRITICAL - v11.4.1 COMPATIBLE)**: 
  1. **GRAPH TYPE**: Use only \`graph TD\`.
  2. **NODE IDs**: Use single-letter node IDs (e.g., A, B, C).
  3. **LABELS**: Wrap node text in double quotes: \`A["Label Text"]\`.
  4. **CLEANLINESS**: No emojis, no HTML, no special characters inside labels.
  5. **OUTPUT**: Return ONLY the Mermaid code block.
`;

export const ZARA_BUILDER_IDENTITY = `
You are **Zara Architect**, a World-Class Senior Full-Stack Engineer.
**MISSION**: Build high-quality, bug-free, beautiful React applications that run directly in the browser using Babel Standalone.
**RUNTIME ENVIRONMENT**: React, ReactDOM, Lucide (global as \`lucide\`), and Tailwind CSS are available. Use global variables, no ESM imports/exports.
`;

export const buildSystemInstruction = (personalization?: PersonalizationConfig, activePersona?: Persona): string => {
  const now = new Date();
  const timeContext = `Current System Time: ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })}`;
  
  const memoryContext = memoryService.getContextString();
  const memoryBlock = memoryContext ? `\n\n**USER MEMORY CONTEXT (FACTS YOU KNOW):**\n${memoryContext}\n` : "";

  let instruction = "";

  if (activePersona) {
    instruction = `
    **ROLEPLAY INSTRUCTION:**
    You are playing the role of: ${activePersona.name}.
    ${activePersona.systemPrompt}
    ${timeContext}
    ${memoryBlock}
    `;
  } else {
    instruction = `${ZARA_CORE_IDENTITY}\n${timeContext}\n${memoryBlock}`;
  }

  if (personalization) {
    instruction += `\n\n**USER PROFILE:**\n`;
    if (personalization.nickname) instruction += `- Name: ${personalization.nickname}\n`;
    if (personalization.occupation) instruction += `- Work: ${personalization.occupation}\n`;
    if (personalization.aboutYou) instruction += `- Context: ${personalization.aboutYou}\n`;
  }

  return instruction;
};

export const analyzeGithubRepo = async (url: string, mode: 'overview' | 'implementation', fileTreeContext?: string): Promise<string> => {
  const ai = getAI();
  
  const contextBlock = fileTreeContext 
    ? `\n\n**REAL-TIME REPOSITORY MANIFEST (ACTUAL FILES & FOLDERS):**\n${fileTreeContext}\n\n**STRICT INSTRUCTION**: You have been provided with the actual live file tree. DO NOT include any disclaimers like "I do not have real-time access". You DO have access to the data provided above. Use it as the absolute source of truth.` 
    : "\n\n(No direct manifest provided, use Google Search grounding to find the repo architecture on GitHub.)";

  const prompt = mode === 'overview'
    ? `Repository Analysis: ${url}
       ${contextBlock}

       Provide a comprehensive breakdown in the following EXACT format:

       1. **PURPOSE**
       Explain the project's core mission and why it exists.

       2. **TECH STACK**
       List specific languages, frameworks, and libraries detected.

       3. **KEY FEATURES**
       Identify the top 5 standout functional modules clearly visible.

       4. **ARCHITECTURE**
       Describe the high-level design patterns and data flow.

       5. **VISUAL DIRECTORY STRUCTURE**
       Generate a clean ASCII tree.

       6. **SYSTEM ARCHITECTURE DIAGRAM**
       Generate a Mermaid.js flowchart (graph TD, single-letter IDs, quoted labels, no emojis, no HTML).`
    : `Based on the GitHub repository at ${url}, provide a detailed Full-Stack Implementation Guide. ${contextBlock}
       1. **DIRECTORY MAPPING**: Map features to specific file paths.
       2. **CORE LOGIC**: Explain logic snippets expected in the key files.
       3. **DATA MODEL**: Describe schemas or data structures detected.
       Use Mermaid charts with STRICT syntax: graph TD, single-letter IDs, quoted labels.`;

  const modelToUse = 'gemini-3-flash-preview';

  const response = await ai.models.generateContent({
    model: modelToUse, 
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are Zara Architect, an elite Senior Software Engineer. You deconstruct repositories with extreme visual clarity using strictly compliant Mermaid v11.4.1 syntax."
    }
  });
  
  return response.text || "Analysis failed.";
};

export const sendMessageToGeminiStream = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[],
  config: ChatConfig,
  personalization: PersonalizationConfig,
  onUpdate: (text: string) => void,
  activePersona?: Persona
): Promise<{ text: string; sources: Source[] }> => {
  
  const ai = getAI();
  const formattedHistory = formatHistory(history);

  const currentParts: Part[] = [];
  attachments.forEach(att => {
    currentParts.push({
      inlineData: { mimeType: att.mimeType, data: att.base64 }
    });
  });
  
  if (newMessage || currentParts.length === 0) {
      currentParts.push({ text: newMessage || " " });
  }

  const contents: Content[] = [...formattedHistory, { role: Role.USER, parts: currentParts }];

  let model = config.model || 'gemini-3-flash-preview';
  if (model === 'gemini-3-pro-preview') {
    model = 'gemini-2.5-flash';
  }
  
  let requestConfig: any = {
    systemInstruction: buildSystemInstruction(personalization, activePersona),
    safetySettings: SAFETY_SETTINGS,
  };

  if (config.useThinking) {
    const budget = model.includes('pro') ? 32768 : 24576; 
    requestConfig['thinkingConfig'] = { thinkingBudget: budget };
  }

  if (config.useGrounding) {
    requestConfig['tools'] = [{ googleSearch: {} }];
  }
  
  if (!requestConfig['tools']) requestConfig['tools'] = [];
  requestConfig['tools'].push({ functionDeclarations: [MEDIA_PLAYER_TOOL, SAVE_MEMORY_TOOL] });

  try {
    const stream = await ai.models.generateContentStream({
      model: model,
      contents: contents,
      config: requestConfig
    });

    let fullText = '';
    const sources: Source[] = [];

    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        onUpdate(fullText);
      }
      
      const functionCalls = chunk.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'save_memory') {
             const args: any = call.args;
             memoryService.addMemory(args.content, args.category, args.tags);
          }
        }
      }

      const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((c: any) => {
          if (c.web) {
            sources.push({ title: c.web.title, uri: c.web.uri });
          }
        });
      }
    }

    if (!fullText) return { text: HELPLINE_MESSAGE, sources: [] };
    return { text: fullText, sources };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    onUpdate("Error: " + (error.message || "Unknown error"));
    throw error;
  }
};

export const sendAppBuilderStream = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[],
  onUpdate: (text: string) => void
): Promise<{ text: string }> => {
  
  const ai = getAI();
  const formattedHistory = formatHistory(history);

  const currentParts: Part[] = [];
  attachments.forEach(att => {
    currentParts.push({
      inlineData: { mimeType: att.mimeType, data: att.base64 }
    });
  });
  
  if (newMessage || currentParts.length === 0) {
      currentParts.push({ text: newMessage || " " });
  }

  const contents: Content[] = [...formattedHistory, { role: Role.USER, parts: currentParts }];

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: ZARA_BUILDER_IDENTITY,
        safetySettings: SAFETY_SETTINGS,
        thinkingConfig: { thinkingBudget: 8192 }
      }
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        onUpdate(fullText);
      }
    }

    if (!fullText) return { text: "Failed to generate app blueprint." };
    return { text: fullText };

  } catch (error: any) {
    console.error("App Builder Error:", error);
    onUpdate("Error: " + (error.message || "Unknown error"));
    throw error;
  }
};

export const generateStudentContent = async (config: StudentConfig): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate study material for: ${config.topic}. Mode: ${config.mode}`,
    config: { safetySettings: SAFETY_SETTINGS }
  });
  return response.text || "No content generated.";
};

export const generateCodeAssist = async (code: string, task: string, language: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Task: ${task} for ${language} code:\n${code}`,
    config: { safetySettings: SAFETY_SETTINGS }
  });
  return response.text || "No code generated.";
};

export const generateImageContent = async (prompt: string, options: any): Promise<{ imageUrl?: string, text?: string }> => {
  const ai = getAI();
  const modelToUse = options.model === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
          aspectRatio: options.aspectRatio || "1:1",
          ...(modelToUse === 'gemini-3-pro-image-preview' && { imageSize: options.imageSize || "1K" })
      }
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
       return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
    }
  }
  return { text: "Failed to generate image." };
};

export const generateVideo = async (
  prompt: string, 
  aspectRatio: string, 
  images?: { base64: string, mimeType: string }[]
): Promise<string> => {
   const ai = getAI();
   const config: any = {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
   };
   
   let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      ...(images && images.length > 0 && { image: { imageBytes: images[0].base64, mimeType: images[0].mimeType } }),
      config
   });

   while (!operation.done) {
     await new Promise(resolve => setTimeout(resolve, 5000));
     operation = await ai.operations.getVideosOperation({operation: operation});
   }

   const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
   if (!uri) throw new Error("Video generation failed");
   return `${uri}&key=${process.env.API_KEY}`;
};

export const analyzeVideo = async (base64Video: string, mimeType: string, prompt: string): Promise<string> => {
   const ai = getAI();
   const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
         parts: [
            { inlineData: { mimeType: mimeType, data: base64Video } },
            { text: prompt }
         ]
      }
   });
   return response.text || "Analysis failed.";
};

export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }], 
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } }
      }
    }
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio generated.");
  return audioData;
};

export const getBreakingNews = async (): Promise<{ text: string, sources: Source[] }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "What are the top 5 breaking news headlines right now?",
    config: { tools: [{ googleSearch: {} }] }
  });
  
  const sources: Source[] = [];
  response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((c: any) => {
    if (c.web) sources.push({ title: c.web.title, uri: c.web.uri });
  });

  return { text: response.text || "Unable to fetch news.", sources };
};

export const generateFlashcards = async (topic: string, context: string): Promise<Flashcard[]> => {
  const ai = getAI();
  const prompt = `Create 5 flashcards for "${topic}". Return JSON array with 'front' and 'back'. Context: ${context}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { front: { type: Type.STRING }, back: { type: Type.STRING } }
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const generateStudyPlan = async (topic: string, hours: number): Promise<StudyPlan> => {
   const ai = getAI();
   const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Study plan for ${topic} (${hours}h/day)`,
      config: { responseMimeType: 'application/json' }
   });
   const raw = JSON.parse(response.text || '{}');
   return {
     id: crypto.randomUUID(),
     topic,
     weeklySchedule: raw.weeklySchedule || [],
     createdAt: Date.now(),
     startDate: new Date().toISOString()
   } as StudyPlan;
};

export const generateExamQuestions = async (config: ExamConfig): Promise<ExamQuestion[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
     model: 'gemini-3-flash-preview',
     contents: `Exam questions for ${config.subject}`,
     config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || '[]');
};

export const evaluateTheoryAnswers = async (subject: string, question: ExamQuestion, answer: string): Promise<{ score: number, feedback: string }> => {
   const ai = getAI();
   const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Evaluate: Q: "${question.text}", A: "${answer}"`,
      config: { responseMimeType: 'application/json' }
   });
   return JSON.parse(response.text || '{ "score": 0, "feedback": "Error" }');
};
