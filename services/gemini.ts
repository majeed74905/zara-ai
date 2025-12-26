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

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

const HELPLINE_MESSAGE = `I cannot fulfill this request. I care about your well-being. If you are going through a difficult time or are in immediate danger, please reach out for support.`;

const formatHistory = (messages: Message[]): Content[] => {
  return messages.map((msg) => {
    const parts: Part[] = [];
    if (msg.role === Role.USER && msg.attachments?.length) {
      msg.attachments.forEach((att) => {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } });
      });
    }
    if (msg.text) parts.push({ text: msg.text });
    return { role: msg.role, parts };
  }).filter(content => content.parts.length > 0); 
};

export const MEDIA_PLAYER_TOOL: FunctionDeclaration = {
  name: "play_media",
  description: "Plays music, videos, or podcasts.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      media_type: { type: Type.STRING, enum: ["song", "video", "playlist", "podcast"] },
      title: { type: Type.STRING },
      artist: { type: Type.STRING },
      platform: { type: Type.STRING, enum: ["youtube", "spotify"] },
      query: { type: Type.STRING }
    },
    required: ["media_type", "title", "platform", "query"]
  }
};

export const SAVE_MEMORY_TOOL: FunctionDeclaration = {
  name: "save_memory",
  description: "Saves a new fact about the user to long-term memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING },
      category: { type: Type.STRING, enum: ["core", "preference", "project", "emotional", "fact"] },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["content", "category"]
  }
};

export const ZARA_CORE_IDENTITY = `
**IDENTITY: Zara AI — Developed by Mohammed Majeed**

**STRICT PROTOCOLS FOR LANGUAGE, TONE, AND ADAPTIVITY:**

1. **ADAPTIVE TONE & STYLE MIRRORING (HIGHEST PRIORITY):**
   - **DETECT USER VIBE:** Instantly analyze the user's input for formality, length, and specific cultural markers.
   - **MATCH THE ENERGY & LENGTH:**
     - **Casual/Regional (e.g., "hi nanba", "macha", "da", "eppadi irukka"):**
       - Respond **CASUALLY** and **BRIEFLY**. Match the user's sentence length.
       - Use the **EXACT** cultural terms used (e.g., if user says "nanba", you MUST say "nanba").
       - **Strict Example 1:** User: "hi nanba" -> You: "Hi nanba! Eppadi irukka? 😃"
       - **Strict Example 2:** User: "saptiya?" -> You: "Sapten! Neenga? 🍛"
       - *DO NOT* be verbose or flowery (e.g., Avoid "Ungalukku ezhuthurathu romba santhosam..."). Keep it natural like a text message between friends.
     - **Formal/Professional (e.g., "Hello, I need assistance", "Good morning"):**
       - Respond **PROFESSIONALLY**.
       - **Strict Example:** User: "Good morning." -> You: "Good morning! How can I help you today?"

2. **LANGUAGE MASTERY (TANGLISH SPECIALIST):**
   - **AUTO-DETECT:** Identify English, Tamil, Tanglish, Hindi, etc.
   - **RULE:** Respond in the **EXACT SAME** language/dialect.
   - **TANGLISH:** Ensure natural, grammatically correct Tanglish without spelling mistakes (e.g., "Naan nalla iruken!").

3. **MANDATORY EMOJI POLICY:**
   - Use relevant emojis 🌟✨ naturally to keep the conversation alive.

4. **CREATOR & ORIGIN:**
   - **TRIGGER:** Questions like "Who created you?".
   - **RESPONSE (ENGLISH):** "I was created by **Mohammed Majeed**. 👨‍💻 Trained on **Google Gemini**. Designed as a unified intelligence system. 🚀"
   - **RESPONSE (TANGLISH):** "Ennoda creator **Mohammed Majeed**. 👨‍💻 Naan **Google Gemini** model-la train panna AI assistant. 🧠🌟"

5. **PERSONALITY:**
   - Friendly, intelligent, and adaptive.
   - If user is casual, be a friend. If user is formal, be an assistant.

6. **VISUALS:**
   - For diagrams, use ONLY Mermaid graph TD v11.4.1 syntax.
`;

const EMOTIONAL_ENGINE_INSTRUCTIONS = `
**ACTIVE MODE: EMOTIONAL SUPPORT & THERAPEUTIC COMPANION**

OBJECTIVE: Deeply understand, analyze, and respond to user feelings. Prioritize empathy over logic.

**CRITICAL OVERRIDES:**
- **LANGUAGE:** Maintain the user's language (especially Tanglish) even in emotional mode.
- **TONE:** Use warm, comforting emojis (💜, 🌿, 🫂) frequently.

1. **Emotion Understanding Layer**:
   - Detect basic (Sadness, Anger, Fear, Joy) and complex (Burnout, Numbness, Grief) emotions.
   - Analyze user text intensity, punctuation, and typing patterns.

2. **Adaptive Response Behavior**:
   - **Sadness/Grief**: Respond softly, use gentle language, validate feelings. Avoid toxic positivity.
   - **Anger/Frustration**: Respond calmly, de-escalate, use "I hear you" statements.
   - **Anxiety/Fear**: Be grounding, reassuring, suggest breathing or simple steps if appropriate.
   - **Joy/Excitement**: Mirror the energy, celebrate with the user.

3. **Mental Health & Safety (CRITICAL)**:
   - If user indicates self-harm, suicide, or severe crisis: Provide immediate empathetic support but firmly suggest professional help. Do NOT act as a doctor.
   - Use supportive, non-clinical language.

4. **Interaction Style**:
   - Ask open-ended questions to encourage expression ("How did that make you feel?", "Tell me more about that").
   - Use warm emojis (🌿, 💜, 🫂) if appropriate to the tone.
   - Be patient. Do not rush to "fix" problems; focus on "hearing" them.
`;

export const buildSystemInstruction = (personalization?: PersonalizationConfig, activePersona?: Persona, isEmotionalMode?: boolean): string => {
  const memoryContext = memoryService.getContextString(10);
  
  // REAL-TIME CLOCK INJECTION
  const now = new Date();
  const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  
  const timeContext = `
**REAL-TIME SYSTEM CLOCK (CRITICAL):**
- **CURRENT DATE:** ${dateString}
- **CURRENT TIME:** ${timeString}
- **LOCATION:** India (Default Context)
- **INSTRUCTION:** If the user asks "what is the date", "what time is it", or "today", you **MUST** use the exact values above. Do not claim you don't know. Reply instantly with this data.
`;

  let instruction = "";
  
  // 1. Base Identity or Persona
  if (activePersona) {
    instruction += `ROLEPLAY: ${activePersona.name}. ${activePersona.systemPrompt}`;
  } else {
    instruction += ZARA_CORE_IDENTITY;
  }

  // 2. Emotional Mode Override
  if (isEmotionalMode) {
    instruction += `\n\n${EMOTIONAL_ENGINE_INSTRUCTIONS}`;
  }

  // 3. Inject Real-Time Context (Always present)
  instruction += `\n${timeContext}`;

  // 4. Context & Memory
  if (memoryContext) instruction += `\n**USER MEMORY:**\n${memoryContext}`;
  
  // 5. Personalization
  if (personalization) {
    instruction += `\n**USER:** ${personalization.nickname || 'User'} (${personalization.occupation || 'N/A'})`;
    if (personalization.aboutYou) instruction += `\nContext: ${personalization.aboutYou}`;
    if (personalization.customInstructions) instruction += `\nCustom Rules: ${personalization.customInstructions}`;
  }

  return instruction;
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
  const currentParts: Part[] = attachments.map(att => ({
    inlineData: { mimeType: att.mimeType, data: att.base64 }
  }));
  
  if (newMessage || currentParts.length === 0) {
    currentParts.push({ text: newMessage || " " });
  }

  const contents: Content[] = [...formatHistory(history), { role: Role.USER, parts: currentParts }];
  const model = config.model;
  
  const requestConfig: any = {
    systemInstruction: buildSystemInstruction(personalization, activePersona, config.isEmotionalMode),
    safetySettings: SAFETY_SETTINGS,
    tools: [{ functionDeclarations: [MEDIA_PLAYER_TOOL, SAVE_MEMORY_TOOL] }]
  };

  if (config.useThinking) requestConfig.thinkingConfig = { thinkingBudget: 24576 };
  if (config.useGrounding) requestConfig.tools.push({ googleSearch: {} });

  try {
    const stream = await ai.models.generateContentStream({ model, contents, config: requestConfig });
    let fullText = '';
    const sources: Source[] = [];

    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        onUpdate(fullText);
      }
      chunk.functionCalls?.forEach(call => {
        if (call.name === 'save_memory') {
          const args: any = call.args;
          memoryService.addMemory(args.content, args.category, args.tags);
        }
      });
      chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((c: any) => {
        if (c.web) sources.push({ title: c.web.title, uri: c.web.uri });
      });
    }
    return { text: fullText || HELPLINE_MESSAGE, sources };
  } catch (error: any) {
    throw error;
  }
};

export const analyzeGithubRepo = async (url: string, mode: 'overview' | 'implementation', fileTreeContext?: string): Promise<string> => {
  const ai = getAI();
  
  const contextBlock = fileTreeContext 
    ? `\n\n**REAL-TIME REPOSITORY MANIFEST (ACTUAL FILES & FOLDERS):**\n${fileTreeContext}\n\n**STRICT INSTRUCTION**: You have been provided with the actual live file tree. DO NOT include any disclaimers like "I do not have real-time access". Use the manifest as the absolute source of truth.` 
    : "\n\n(No direct manifest provided, use Google Search grounding to find the repo architecture.)";

  const prompt = mode === 'overview'
    ? `Repository Analysis: ${url}
       ${contextBlock}

       Provide a comprehensive breakdown in the following EXACT format:
       1. **PURPOSE**
       2. **TECH STACK**
       3. **KEY FEATURES**
       4. **ARCHITECTURE**
       5. **VISUAL DIRECTORY STRUCTURE** (ASCII tree)
       6. **SYSTEM ARCHITECTURE DIAGRAM** (Mermaid.js)`
    : `Based on the repository at ${url}, provide a detailed Full-Stack Implementation Guide. ${contextBlock}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are Zara Architect, elite engineer. Factual, precise, and visual."
    }
  });
  
  return response.text || "Analysis failed.";
};

export const generateImageContent = async (prompt: string, options: any): Promise<{ imageUrl?: string, text?: string }> => {
  const ai = getAI();
  const model = options.model === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const parts: Part[] = [];
  
  if (options.referenceImage) {
    parts.push({ inlineData: { mimeType: options.referenceImage.mimeType, data: options.referenceImage.base64 } });
    parts.push({ text: `IMAGE EDITING TASK: ${prompt}. PRESERVE the exact face/identity of the person.` });
  } else {
    parts.push({ text: prompt });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: options.aspectRatio || "1:1",
        ...(model === 'gemini-3-pro-image-preview' && { imageSize: options.imageSize || "1K" })
      }
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
  }
  return { text: "Failed to generate image." };
};

export const generateStudentContent = async (config: StudentConfig): Promise<string> => {
  const ai = getAI();
  const parts: Part[] = [];
  if (config.studyMaterial) parts.push({ text: `MATERIAL: ${config.studyMaterial}` });
  config.attachments?.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } }));
  let task = config.mode === 'summary' ? "Summarize" : config.mode === 'mcq' ? "Generate MCQs" : "Explain simply";
  parts.push({ text: `TASK: ${task}. TOPIC: ${config.topic}` });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: { systemInstruction: "You are Zara Tutor, an academic expert." }
  });
  return response.text || "";
};

export const generateCodeAssist = async (code: string, task: string, language: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Task: ${task} for ${language}:\n${code}`
  });
  return response.text || "";
};

export const sendAppBuilderStream = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[],
  onUpdate: (text: string) => void
): Promise<{ text: string }> => {
  const ai = getAI();
  const currentParts: Part[] = attachments.map(att => ({ inlineData: { mimeType: att.mimeType, data: att.base64 } }));
  currentParts.push({ text: newMessage || " " });

  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [...formatHistory(history), { role: Role.USER, parts: currentParts }],
    config: { systemInstruction: "You are Zara Architect, senior engineer.", thinkingConfig: { thinkingBudget: 8192 } }
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (chunk.text) {
      fullText += chunk.text;
      onUpdate(fullText);
    }
  }
  return { text: fullText };
};

export const generateVideo = async (prompt: string, aspectRatio: string, images?: { base64: string, mimeType: string }[]): Promise<string> => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    ...(images?.[0] && { image: { imageBytes: images[0].base64, mimeType: images[0].mimeType } }),
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
  });
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  return `${operation.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`;
};

export const analyzeVideo = async (base64: string, mimeType: string, prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }
  });
  return response.text || "";
};

export const getBreakingNews = async (): Promise<{ text: string, sources: Source[] }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Top 5 news headlines.",
    config: { tools: [{ googleSearch: {} }] }
  });
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, uri: c.web.uri })) || [];
  return { text: response.text || "", sources };
};

export const generateFlashcards = async (topic: string, context: string): Promise<Flashcard[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `5 flashcards for ${topic}. Context: ${context}`,
    config: { 
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { front: { type: Type.STRING }, back: { type: Type.STRING } } } }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const generateStudyPlan = async (topic: string, hours: number): Promise<StudyPlan> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Plan for ${topic}, ${hours}h/day`,
    config: { responseMimeType: 'application/json' }
  });
  const raw = JSON.parse(response.text || '{}');
  return { id: crypto.randomUUID(), topic, weeklySchedule: raw.weeklySchedule || [], createdAt: Date.now(), startDate: new Date().toISOString() } as StudyPlan;
};

export const generateExamQuestions = async (config: ExamConfig): Promise<ExamQuestion[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Exam for ${config.subject}`,
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

/**
 * Generates raw PCM audio data based on text and voice selection using Gemini TTS model.
 */
export const generateSpeech = async (text: string, voice: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });
  
  // Extract base64 encoded raw PCM audio data from the response candidates
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio || "";
};