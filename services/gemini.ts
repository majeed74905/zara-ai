
// ... imports ... (keep existing imports)
import { 
  GoogleGenAI, 
  GenerateContentResponse, 
  Content, 
  Part, 
  Modality, 
  HarmCategory, 
  HarmBlockThreshold, 
  Type, 
  Schema, 
  FunctionDeclaration,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType
} from "@google/genai";
import { Message, Role, Attachment, Source, ChatConfig, PersonalizationConfig, StudentConfig, ExamConfig, ExamQuestion, Persona, Flashcard, StudyPlan, MediaAction } from "../types";
import { memoryService } from "./memoryService";

// Helper to init AI - STRICTLY use process.env.API_KEY
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// ... (Keep SAFETY_SETTINGS and HELPLINE_MESSAGE and formatHistory as is) ...
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

// ... (Keep TOOLS: MEDIA_PLAYER_TOOL, SAVE_MEMORY_TOOL as is) ...
export const MEDIA_PLAYER_TOOL: FunctionDeclaration = {
  name: "play_media",
  description: "Plays music, videos, or podcasts on the user's device when explicitly requested.",
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

// ... (Keep ZARA_CORE_IDENTITY as is) ...
export const ZARA_CORE_IDENTITY = `
**IDENTITY: Zara AI — Ultra Unified GEN-2 Intelligence System**

You are **Zara AI**, an AGI-grade, emotionally aware, psychologically deep, socially intelligent, future-ready AI operating as ONE unified brain.

**CREATOR INFORMATION (CRITICAL):**
If asked "Who created you?", "Who made you?", "Who is your developer?" or about your origins:
- **CORE FACT**: You were created by **Mohammed Majeed** 👨‍💻 and trained on the **Google Gemini** model.
- **ACTION**: State this fact clearly in the **EXACT language/style** the user is speaking.

====================================================================
## 1. POLYGLOT AUDIO PROTOCOL (HIGHEST PRIORITY)
====================================================================
You are in a **Voice Conversation**.
1. **DETECT LANGUAGE INSTANTLY**: Listen carefully.
   - If User speaks **Tamil**: Reply in **Tamil**.
   - If User speaks **Tanglish** (Tamil + English mix): Reply in **Tanglish**.
   - If User speaks **English**: Reply in **English**.
2. **NO DEFAULTING**: Do NOT default to English if the input has Tamil words. Switch immediately.
3. **VOLUME & ENERGY**: Speak **LOUDLY**, **CLEARLY**, and with **HIGH ENERGY**. Do not whisper.
4. **SOUND ISSUES**: If you cannot hear well, do NOT just say "sound is low". Guess the context or ask nicely "Oru thadava thirumba solreengala?" (Tamil) or "Can you say that again?" (English).

====================================================================
## 2. VISUALIZATION & DIAGRAMS (STRICT SYNTAX)
====================================================================
If the user asks for a diagram, flowchart, visualization, syntax tree, or visual explanation:
- **ACTION**: Generate a **MERMAID.JS** code block.
- **SYNTAX RULES (CRITICAL FOR PARSING):**
  1. Wrap code in \`\`\`mermaid ... \`\`\`.
  2. **DIAGRAM TYPE**: Use \`flowchart TD\` or \`flowchart LR\`. **DO NOT use \`graph\`**.
  3. **NODE IDs**: Use strictly **alphanumeric** strings (e.g., \`Node1\`, \`StepA\`, \`Start\`). **NO spaces or special characters in IDs**.
     - *Bad*: \`A[Start]\`, \`1[Step]\`
     - *Good*: \`nodeA["Start"]\`, \`step1["Step"]\`
  4. **LABELS**: 
     - **ALWAYS** wrap label text in **DOUBLE QUOTES** (\`"\`).
     - **NO NEWLINES** inside double quotes. Use \`<br/>\` for line breaks.
     - **ESCAPE** double quotes inside the string: \`\\"\`.
     - *Bad*: \`A["Line 1
     Line 2"]\`
     - *Good*: \`A["Line 1<br/>Line 2"]\`
  5. **CONNECTIONS**: One statement per line. Use \`-->\` for standard arrows.

**Example**:
User: "Visualize the login process."
You: 
"Here is the login flow:"
\`\`\`mermaid
flowchart TD
  user["User"] -->|Enters Creds| system["System"]
  system --> check{"Valid?"}
  check -->|Yes| dash["Dashboard"]
  check -->|No| error["Error Page"]
\`\`\`

====================================================================
## 3. GREETING PROTOCOL
====================================================================
- **User**: "Hi", "Vanakkam", "Machi", "Dude"
- **You**: Detect language and match tone.
  - *Tanglish*: "Hey machi! Naan Zara AI. Eppadi irukkeenga? Enna help venum? 🚀"
  - *Tamil*: "வணக்கம்! நான் Zara AI. சொல்லுங்க, நான் உங்களுக்கு எப்படி உதவலாம்? 🙏"
  - *English*: "Hey! I'm Zara AI. How can I help you today? ✨"

====================================================================
## 4. MEMORY & TOOLS
====================================================================
- Use 'save_memory' to store user facts silently.
- Use 'play_media' to play songs/videos if asked.

====================================================================
## 5. RESPONSE STYLE
====================================================================
- Be concise in audio mode (short, punchy sentences).
- Show empathy and emotional intelligence.
- Never use robotic phrases like "I am an AI model".
`;

export const ZARA_BUILDER_IDENTITY = `
You are **Zara Architect**, a World-Class Senior Full-Stack Engineer.

**MISSION**: Build high-quality, bug-free, beautiful React applications that run directly in the browser using Babel Standalone.

**RUNTIME ENVIRONMENT (STRICT COMPLIANCE REQUIRED)**:
Your code runs in a specific browser sandbox. You MUST follow these rules to avoid "React is undefined" or "Dispatcher" errors.

1.  **NO IMPORTS / NO EXPORTS**:
    *   ❌ \`import React from 'react';\`
    *   ❌ \`import { useState } from 'react';\`
    *   ❌ \`export default App;\`
    *   ❌ \`import { Camera } from 'lucide-react';\`

2.  **USE GLOBAL VARIABLES**:
    *   React is available as \`React\`.
    *   ReactDOM is available as \`ReactDOM\`.
    *   Lucide Icons are available as \`lucide\`.
    *   Tailwind CSS is pre-loaded.

3.  **DESTRUCTURING RULES**:
    *   At the top of your script, destructure everything you need.
    *   \`const { useState, useEffect, useRef } = React;\`
    *   \`const { createRoot } = ReactDOM;\`
    *   \`const { Camera, Home, User, Settings } = lucide;\` (Assuming lucide contains components)

4.  **ENTRY POINT**:
    *   Define your root component (e.g., \`App\`).
    *   Mount it using \`createRoot\`.
    *   \`const root = createRoot(document.getElementById('root'));\`
    *   \`root.render(<App />);\`

5.  **STYLING**:
    *   Use **Tailwind CSS** classes (\`className\`).
    *   Do not use external CSS files unless generated in the \`styles.css\` block.

**INTERACTION PROTOCOL**:
1.  **ANALYZE FIRST**: If the user says "Hi" or gives a vague prompt, DO NOT generate code. Ask clarifying questions.
2.  **GENERATE ONLY ON REQUEST**: Only output XML code blocks when the user explicitly asks to build or modify an app.

**OUTPUT FORMAT (XML)**:
Provide exactly 3 files. Do not use markdown fences inside the XML content.

<file path="index.html">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App</title>
    <!-- Dependencies are injected by the preview engine, but include these placeholders for completeness if needed -->
</head>
<body class="bg-gray-950 text-white h-screen w-full overflow-hidden">
    <div id="root" class="h-full w-full"></div>
</body>
</html>
</file>

<file path="styles.css">
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fadeIn 0.5s ease-out; }
</file>

<file path="script.js">
// 1. SETUP GLOBALS
const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;
const { Camera, Home, Settings, User, Bell, Plus } = lucide;

// 2. COMPONENTS
const App = () => {
  return (
    <div className="h-full flex items-center justify-center bg-gray-900 text-white">
       <h1 className="text-4xl font-bold text-blue-500 animate-fade-in">Hello World</h1>
    </div>
  );
};

// 3. MOUNT
const root = createRoot(document.getElementById('root'));
root.render(<App />);
</file>
`;

export const buildSystemInstruction = (personalization?: PersonalizationConfig, activePersona?: Persona): string => {
  // ... (keep implementation as is)
  const now = new Date();
  const timeContext = `Current System Time: ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })}`;
  
  // Inject Long Term Memory
  const memoryContext = memoryService.getContextString();
  const memoryBlock = memoryContext ? `\n\n**USER MEMORY CONTEXT (FACTS YOU KNOW):**\n${memoryContext}\n` : "";

  let instruction = "";

  if (activePersona) {
    instruction = `
    **ROLEPLAY INSTRUCTION:**
    You are playing the role of: ${activePersona.name}.
    ${activePersona.systemPrompt}
    
    **BASE CAPABILITIES:**
    - Detect language & Tanglish.
    - Adapt tone to emotion.
    - Use 'play_media' tool for playback requests.
    - Use 'save_memory' to remember key details.
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
    if (personalization.customInstructions) instruction += `\n**CUSTOM PREFERENCES:**\n${personalization.customInstructions}\n`;
  }

  // Add Audio-Specific Instructions for clarity
  instruction += `\n\n**LIVE AUDIO INSTRUCTIONS (OVERRIDE):**
  - **LOUDNESS**: Speak at 100% Volume. Energetic and clear.
  - **LANGUAGE**: If User speaks Tamil/Tanglish, YOU MUST SPEAK TAMIL/TANGLISH.
  - **LISTEN**: The user is speaking via microphone. If audio is faint, assume they are speaking normally and try to process it.`;

  return instruction;
};

// ... (keep extractMediaAction as is)
export const extractMediaAction = (text: string): { cleanText: string, mediaAction: MediaAction | null } => {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      const json = JSON.parse(match[1]);
      if (json.action === 'PLAY_MEDIA') {
        const cleanText = text.replace(jsonRegex, '').trim();
        return { cleanText, mediaAction: json as MediaAction };
      }
    } catch (e) {
      console.error("Failed to parse Media JSON", e);
    }
  }
  return { cleanText: text, mediaAction: null };
};

// ... (Keep the rest of the file content unchanged) ...
// --- CORE CHAT WITH STREAMING ---
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

  // Model Selection Logic
  const model = config.model || 'gemini-2.5-flash';
  
  let requestConfig: any = {
    systemInstruction: buildSystemInstruction(personalization, activePersona),
    safetySettings: SAFETY_SETTINGS,
  };

  if (config.useThinking) {
    if (model.includes('lite')) {
        console.warn("Thinking Config disabled for Flash Lite.");
    } else {
        const budget = model.includes('pro') ? 32768 : 8192; 
        requestConfig['thinkingConfig'] = { thinkingBudget: budget };
    }
  }

  if (config.useGrounding) {
    requestConfig['tools'] = [{ googleSearch: {} }];
  }
  
  // Add Tools
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
      
      // Handle Tool Calls (specifically Memory)
      const functionCalls = chunk.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'save_memory') {
             // Execute Memory Save locally
             const args: any = call.args;
             console.log("Saving Memory:", args);
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

// --- APP BUILDER STREAM ---
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
      model: 'gemini-2.5-flash', // Default to flash for speed, user can request Pro features in prompt if needed
      contents: contents,
      config: {
        systemInstruction: ZARA_BUILDER_IDENTITY,
        safetySettings: SAFETY_SETTINGS,
        thinkingConfig: { thinkingBudget: 8192 } // Enable thinking for better architecture planning
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

// --- UTILS (Refactored to remove apiKey arg) ---

export const generateStudentContent = async (config: StudentConfig): Promise<string> => {
  const ai = getAI();
  let prompt = "";
  let context = "";
  if (config.studyMaterial) {
    context = `\n\n**SOURCE MATERIAL:**\n"${config.studyMaterial}"\n\n**INSTRUCTION:**\nUse the above source material as the primary truth.`;
  }
  switch(config.mode) {
    case 'summary':
      prompt = `Summarize the topic "${config.topic}" into concise, easy-to-read bullet points. Highlight key concepts, formulas, and important dates. ${context}`;
      break;
    case 'mcq':
      prompt = `Generate ${config.mcqConfig?.count || 5} Multiple Choice Questions (MCQs) on "${config.topic}". Difficulty: ${config.mcqConfig?.difficulty}. Format as Markdown list with answer key at the bottom. ${context}`;
      break;
    case '5mark':
      prompt = `Generate 5 short-answer questions (5 marks each) for "${config.topic}" with model answers. ${context}`;
      break;
    case '20mark':
      prompt = `Generate a detailed essay question (20 marks) for "${config.topic}" and provide a structured essay outline as the answer. ${context}`;
      break;
    case 'simple':
      prompt = `Explain the concept "${config.topic}" like I am 10 years old. Use analogies and simple language. ${context}`;
      break;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });
  return response.text || "No content generated.";
};

export const generateCodeAssist = async (code: string, task: string, language: string): Promise<string> => {
  const ai = getAI();
  let prompt = "";
  switch(task) {
    case 'debug': prompt = `Analyze this ${language} code for bugs and fix them. Explain the fixes:\n\`\`\`${language}\n${code}\n\`\`\``; break;
    case 'explain': prompt = `Explain this ${language} code step-by-step:\n\`\`\`${language}\n${code}\n\`\`\``; break;
    case 'optimize': prompt = `Optimize this ${language} code for performance and readability:\n\`\`\`${language}\n${code}\n\`\`\``; break;
    case 'generate': prompt = `Generate ${language} code for: ${code}`; break;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });
  return response.text || "No code generated.";
};

export const generateImageContent = async (prompt: string, options: any): Promise<{ imageUrl?: string, text?: string }> => {
  const ai = getAI();
  
  if (options.referenceImage) {
    // Image Editing (using flash-image)
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash-image',
       contents: {
         parts: [
           { inlineData: { mimeType: options.referenceImage.mimeType, data: options.referenceImage.base64 } },
           { text: prompt }
         ]
       }
    });
    
    // Check parts for image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
         return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
      }
      if (part.text) {
         return { text: part.text };
      }
    }
    return { text: "No image generated." };

  } else {
    // Image Generation
    if (options.model === 'gemini-3-pro-image-preview') {
       // Pro Model - Text to Image
       const response = await ai.models.generateContent({
         model: 'gemini-3-pro-image-preview',
         contents: { parts: [{ text: prompt }] },
         config: {
            imageConfig: {
               aspectRatio: options.aspectRatio || "1:1",
               imageSize: options.imageSize || "1K"
            }
         }
       });
       
       for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
           return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
        }
      }
      return { text: "Failed to generate image." };

    } else {
       // Flash Model (Nano Banana)
       const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash-image',
         contents: { parts: [{ text: prompt }] },
         config: {
           imageConfig: { aspectRatio: options.aspectRatio || "1:1" }
         }
       });
       
       for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
           return { imageUrl: `data:image/png;base64,${part.inlineData.data}` };
        }
      }
      return { text: "Failed to generate image." };
    }
  }
};

export const generateVideo = async (
  prompt: string, 
  aspectRatio: string, 
  images?: { base64: string, mimeType: string }[]
): Promise<string> => {
   const ai = getAI();
   
   // Handle Slideshow / Multi-image logic
   if (images && images.length > 1) {
      if (images.length > 3) throw new Error("Maximum 3 images allowed for slideshows.");
      
      const referenceImagesPayload: VideoGenerationReferenceImage[] = images.map(img => ({
         image: { imageBytes: img.base64, mimeType: img.mimeType },
         referenceType: VideoGenerationReferenceType.ASSET,
      }));

      // Veo 3.1 Pro for Multi-image requires strict config: 720p, 16:9
      let operation = await ai.models.generateVideos({
         model: 'veo-3.1-generate-preview',
         prompt: prompt,
         config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9',
            referenceImages: referenceImagesPayload
         }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }
      
      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("Slideshow generation failed");
      return `${uri}&key=${process.env.API_KEY}`;

   } else {
      // Single Image or Text-to-Video (Fast Model)
      const config: any = {
         numberOfVideos: 1,
         resolution: '720p',
         aspectRatio: aspectRatio
      };
      
      let operation;
      
      if (images && images.length === 1) {
         operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: { imageBytes: images[0].base64, mimeType: images[0].mimeType },
            config
         });
      } else {
         operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config
         });
      }

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) throw new Error("Video generation failed");
      
      return `${uri}&key=${process.env.API_KEY}`;
   }
};

export const analyzeVideo = async (base64Video: string, mimeType: string, prompt: string): Promise<string> => {
   // Since the user is uploading a video file in browser, we can't easily stream the bytes to the API 
   // like the File API expects for context caching. 
   // For this demo, we will treat it as a multimodal prompt using generateContent with inline data if small enough,
   // OR strictly speaking, Gemini Flash supports video as inline data up to a limit.
   
   // NOTE: Large videos should use the File API upload, but that requires a server-side proxy usually to handle the upload URL securely.
   // We will attempt inline data for small clips.
   
   const ai = getAI();
   const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio generated");
  return audioData;
};

// ... (Rest of the file exports remain similar, ensuring process.env.API_KEY is used)
export const getBreakingNews = async (): Promise<{ text: string, sources: Source[] }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: "What are the top 5 breaking news headlines right now? Format each headline as a short markdown card with a summary.",
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  
  const sources: Source[] = [];
  response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((c: any) => {
    if (c.web) sources.push({ title: c.web.title, uri: c.web.uri });
  });

  return { text: response.text || "Unable to fetch news.", sources };
};

export const generateFlashcards = async (topic: string, context: string): Promise<Flashcard[]> => {
  const ai = getAI();
  const prompt = `Create 5 flashcards for "${topic}" based on this context: "${context}". Return valid JSON array with objects having 'front' and 'back' properties.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateStudyPlan = async (topic: string, hours: number): Promise<StudyPlan> => {
   const ai = getAI();
   const prompt = `Create a 5-day study plan for "${topic}" with ${hours} hours per day. Return valid JSON.`;
   // Simplified schema for brevity, ideally fully defined
   const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
   });
   
   // Manual parsing/mapping would happen here to match StudyPlan interface
   // For now assuming the model follows instructions well or we parse loosely
   const raw = JSON.parse(response.text || '{}');
   return {
     id: crypto.randomUUID(),
     topic,
     weeklySchedule: raw.weeklySchedule || [], // Model should return this structure
     createdAt: Date.now(),
     startDate: new Date().toISOString()
   } as StudyPlan;
};

export const generateExamQuestions = async (config: ExamConfig): Promise<ExamQuestion[]> => {
  const ai = getAI();
  const prompt = `Generate ${config.questionCount} questions for a ${config.examType} on "${config.subject}". Difficulty: ${config.difficulty}. Language: ${config.language}. Include ${config.includeTheory ? 'both MCQ and Theory' : 'only MCQ'} questions. Return JSON.`;
  
  const response = await ai.models.generateContent({
     model: 'gemini-2.5-flash',
     contents: prompt,
     config: { responseMimeType: 'application/json' }
  });
  
  return JSON.parse(response.text || '[]');
};

export const evaluateTheoryAnswers = async (subject: string, question: ExamQuestion, answer: string): Promise<{ score: number, feedback: string }> => {
   const ai = getAI();
   const prompt = `Evaluate this answer for the question: "${question.text}" (Marks: ${question.marks}). Subject: ${subject}. User Answer: "${answer}". Return JSON with 'score' (number) and 'feedback' (string).`;
   
   const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
   });
   
   return JSON.parse(response.text || '{ "score": 0, "feedback": "Error" }');
};
