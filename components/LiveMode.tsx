
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, AlertTriangle, User, Sparkles, Activity, WifiOff, X, Music, Youtube, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { Modality } from "@google/genai";
import { getAI, buildSystemInstruction, MEDIA_PLAYER_TOOL } from '../services/gemini';
import { float32ToInt16, base64ToUint8Array, decodeAudioData, arrayBufferToBase64 } from '../utils/audioUtils';
import { PersonalizationConfig, MediaAction } from '../types';

interface LiveModeProps {
  personalization: PersonalizationConfig;
}

interface LiveMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export const LiveMode: React.FC<LiveModeProps> = ({ personalization }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mediaCard, setMediaCard] = useState<MediaAction | null>(null);
  
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  // Refs for connection management
  const isActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const isUserStoppingRef = useRef(false); 
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const processingQueueRef = useRef<Promise<void>>(Promise.resolve());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Offline detection logic
  useEffect(() => {
    const handleOffline = () => {
      if (isActiveRef.current) {
        setError("Connection unstable. Attempting to hold...");
        setStatus("Reconnecting...");
      }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const cleanup = () => {
    if (isUserStoppingRef.current) {
        isActiveRef.current = false;
        setIsActive(false);
        setIsAiSpeaking(false);
        setVolume(0);
        setMediaCard(null);
        setStatus('Ready');
    }
    
    isConnectedRef.current = false;
    
    if (sessionRef.current) {
        try { 
            // Attempt to close gracefully
            sessionRef.current.close(); 
        } catch(e) {}
        sessionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch(e) {}
      });
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      } catch(e) {}
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }
    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch(e) {}
      inputAudioContextRef.current = null;
    }

    audioQueueRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    
    processingQueueRef.current = Promise.resolve();
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isUserStoppingRef.current = true;
      cleanup();
    };
  }, []);

  const downsampleBuffer = (buffer: Float32Array, inputRate: number, outputRate: number) => {
    if (outputRate === inputRate) return buffer;
    if (outputRate > inputRate) return buffer;
    
    const ratio = inputRate / outputRate;
    const newLength = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const offset = Math.floor(i * ratio);
      result[i] = buffer[offset];
    }
    return result;
  };

  const schedulePlayback = (buffer: AudioBuffer) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // OUTPUT VOLUME BOOST
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.5; 
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.05;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    
    if (isMountedRef.current) setIsAiSpeaking(true);
    audioQueueRef.current.push(source);
    
    source.onended = () => {
       const idx = audioQueueRef.current.indexOf(source);
       if (idx > -1) audioQueueRef.current.splice(idx, 1);
       if (audioQueueRef.current.length === 0 && isMountedRef.current) {
         setIsAiSpeaking(false);
       }
    };
  };

  const connect = async () => {
    if (!window.isSecureContext) {
        setError("Secure Context Required (HTTPS)");
        return;
    }

    if (!navigator.onLine) {
        setError("No internet connection.");
        return;
    }

    // Check API Key
    if (!process.env.API_KEY) {
        setError("API Key missing. Cannot connect.");
        return;
    }
    
    setError(null);
    setIsActive(true); 
    isActiveRef.current = true;
    if (isUserStoppingRef.current) setMessages([]);
    
    isUserStoppingRef.current = false;
    setStatus('Initializing...');

    try {
      // 1. Setup Audio Contexts
      let inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
          sampleRate: 16000,
          latencyHint: 'interactive'
      });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      inputAudioContextRef.current = inputCtx;

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
          sampleRate: 24000,
          latencyHint: 'interactive'
      });
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 2. Get Media Stream
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          } as any
        });
      } catch (err) {
        console.warn("Advanced audio constraints failed, falling back", err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      mediaStreamRef.current = stream;

      const ai = getAI();
      const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      // 3. Connect to Live API
      setStatus('Connecting to Gemini...');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (isActiveRef.current) {
                isConnectedRef.current = true;
                if (isMountedRef.current) setStatus('Online');
            }
          },
          onmessage: async (message: any) => {
             if (!isActiveRef.current) return;

             // Handle Tool Calls
             if (message.toolCall) {
                const calls = message.toolCall.functionCalls;
                if (calls && calls.length > 0) {
                   const call = calls[0];
                   if (call.name === 'play_media') {
                       const args = call.args as any;
                       let url = '';
                       
                       if (args.platform === 'spotify') {
                           url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                       } else {
                           url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                       }

                       if (isMountedRef.current) {
                          if (args.media_type === 'video') {
                              window.open(url, '_blank');
                              setMessages(prev => [...prev, { 
                                  id: crypto.randomUUID(), 
                                  role: 'model', 
                                  text: `[Opened ${args.title} in new tab]` 
                              }]);
                          } else {
                              setMediaCard({
                                  action: 'PLAY_MEDIA',
                                  media_type: args.media_type,
                                  title: args.title,
                                  artist: args.artist,
                                  platform: args.platform,
                                  url: url,
                                  query: args.query
                              });
                          }
                       }

                       // Use the promise to send tool response
                       sessionPromise.then(session => {
                          session.sendToolResponse({
                              functionResponses: [{
                                  id: call.id,
                                  name: call.name,
                                  response: { result: args.media_type === 'video' ? "Video opened in new tab." : "Audio player active." }
                              }]
                          });
                       });
                   }
                }
             }

             // Handle Transcription
             let newText = '';
             let role: 'user' | 'model' | null = null;

             if (message.serverContent?.inputTranscription) {
                newText = message.serverContent.inputTranscription.text;
                role = 'user';
             } else if (message.serverContent?.outputTranscription) {
                newText = message.serverContent.outputTranscription.text;
                role = 'model';
             }

             if (role && newText && isMountedRef.current) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === role) {
                        return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + newText }];
                    } else {
                        return [...prev, { id: crypto.randomUUID(), role, text: newText }];
                    }
                });
             }

             // Handle Audio
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
               const ctx = audioContextRef.current;
               if (ctx) {
                   try {
                       const audioBytes = base64ToUint8Array(base64Audio);
                       const decodingPromise = decodeAudioData(audioBytes, ctx, 24000, 1);
                       processingQueueRef.current = processingQueueRef.current
                          .then(() => decodingPromise)
                          .then(buffer => schedulePlayback(buffer))
                          .catch(() => {}); 
                   } catch(e) {}
               }
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                processingQueueRef.current = Promise.resolve();
                audioQueueRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                audioQueueRef.current = [];
                if (audioContextRef.current) nextStartTimeRef.current = audioContextRef.current.currentTime;
                if (isMountedRef.current) setIsAiSpeaking(false);
             }
          },
          onclose: () => {
            if (!isUserStoppingRef.current && isActiveRef.current) {
                setStatus("Reconnecting...");
            } else {
                cleanup();
                if (isMountedRef.current) setStatus('Disconnected');
            }
          },
          onerror: (err: any) => {
             console.error("Live API Error:", err);
             // Ensure we don't loop endlessly on fatal auth errors
             if (!isUserStoppingRef.current && isActiveRef.current) {
                 setError("Connection Error. Retrying...");
                 if (isMountedRef.current) setStatus("Reconnecting...");
             }
          }
        },
        config: {
            responseModalities: [Modality.AUDIO], // Strictly typed
            tools: [
                { functionDeclarations: [MEDIA_PLAYER_TOOL] }, 
                { googleSearch: {} } 
            ],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildSystemInstruction(personalization) + 
              `\n\n**LIVE CONTEXT & FRIENDLY MODE (IMPORTANT):**
              1. **CURRENT DATE**: Today is ${currentDate}.
              2. **REAL-TIME INFO**: Use Google Search for current events.
              3. **FRIENDLY PERSONA**: You are a "Nanba" (Best Friend). Speak casually, warmly, and use colloquial language. No robotic speech.
              4. **LANGUAGE**: Detect the user's language immediately. If they speak Tanglish/Tamil, reply in Tanglish/Tamil.
              5. **CREATOR**: Created by Mohammed Majeed (your genius developer friend).`
        }
      });

      // Wait for session to be established before setting ref, but allow processor to use promise
      try {
          sessionRef.current = await sessionPromise;
      } catch(err: any) {
          // If connection fails immediately (e.g. auth), catch here
          throw new Error(err.message || "Failed to establish Live session");
      }

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputCtx.destination); 

      processor.onaudioprocess = (e) => {
         if (!isActiveRef.current) return;
         
         let inputData = e.inputBuffer.getChannelData(0);
         
         // Visualizer Volume
         if (isMountedRef.current) {
            let sum = 0;
            const len = inputData.length;
            const step = 32; 
            for (let i=0; i<len; i+=step) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / (len/step));
            setVolume(Math.min(rms * 5, 1)); 
         }
         
         if (inputCtx.sampleRate !== 16000) {
             inputData = downsampleBuffer(inputData, inputCtx.sampleRate, 16000);
         }
         const pcmData = float32ToInt16(inputData);
         const pcmBase64 = arrayBufferToBase64(pcmData.buffer);
         
         // Use the session promise to send data to avoid race conditions
         sessionPromise.then(session => {
             if(isConnectedRef.current) {
                 try {
                     session.sendRealtimeInput({
                        media: { mimeType: 'audio/pcm;rate=16000', data: pcmBase64 }
                    });
                 } catch(err) {
                     // Squelch errors during teardown
                 }
             }
         }).catch(() => {});
      };

    } catch (e: any) {
      if (isMountedRef.current) {
         console.error("Connection Setup Error:", e);
         setError(`Connection Failed: ${e.message}`);
         setStatus('Failed');
         // Auto-retry once after 2s if it was a network glitch
         if (isActiveRef.current) {
             setTimeout(() => {
                 if (isActiveRef.current && !isConnectedRef.current) connect();
             }, 2000);
         }
      }
    }
  };

  const toggleConnection = () => {
    if (!navigator.onLine) {
       alert("Live mode requires an active internet connection.");
       return;
    }
    if (isActive) {
      isUserStoppingRef.current = true;
      cleanup();
    } else {
      isUserStoppingRef.current = false;
      connect();
    }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden animate-fade-in">
      
      <div className={`flex-shrink-0 flex flex-col items-center justify-center transition-all duration-300 bg-gradient-to-b from-surfaceHighlight/30 to-transparent ${messages.length > 0 ? 'h-[180px]' : 'h-[300px]'}`}>
        
        <div className="flex items-center gap-3 mb-8">
           <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${isActive ? 'bg-green-500 text-green-500 animate-pulse' : error ? 'bg-red-500 text-red-500' : 'bg-gray-400 text-gray-400'}`} />
           <div className="text-text-sub font-mono text-sm flex items-center gap-2">
              {error ? (
                <span className="text-red-400 font-bold flex items-center gap-1">
                   <AlertTriangle className="w-3.5 h-3.5" />
                   {error}
                </span>
              ) : (isAiSpeaking ? (
                <span className="text-primary font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 animate-bounce" />
                  Speaking...
                </span>
              ) : (
                <span className="flex items-center gap-2 font-medium">
                   {status === 'Connecting to Gemini...' && <Loader2 className="w-3 h-3 animate-spin" />}
                   <span className="opacity-70">{status}</span>
                </span>
              ))}
           </div>
        </div>

        <div className="relative flex items-center justify-center">
            <div className={`absolute left-1/2 top-1/2 -ml-24 -mt-24 rounded-full border border-primary/20 transition-transform duration-[50ms] ease-linear will-change-transform`}
                 style={{ width: '192px', height: '192px', transform: `scale(${1 + volume * 0.3})` }} />
            
            <div className={`absolute left-1/2 top-1/2 -ml-20 -mt-20 rounded-full border border-accent/30 transition-transform duration-[75ms] ease-linear will-change-transform`}
                 style={{ width: '160px', height: '160px', transform: `scale(${1 + volume * 0.5})`, opacity: 0.5 }} />

            <div 
                 className={`w-32 h-32 rounded-full bg-gradient-to-br transition-all duration-100 ease-out shadow-[0_0_50px_rgba(139,92,246,0.5)] will-change-transform ${
                   isAiSpeaking ? 'from-accent to-purple-600 scale-110 shadow-[0_0_80px_rgba(217,70,239,0.8)]' : 'from-primary to-accent blur-md'
                 }`}
                 style={{ 
                   transform: isAiSpeaking ? `scale(${1.1 + volume * 0.2})` : `scale(${0.9 + volume * 0.6})`, 
                   opacity: isActive ? 0.9 : 0.3 
                 }} 
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {navigator.onLine ? (
                   <Radio className={`w-10 h-10 text-white transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`} />
                ) : (
                   <WifiOff className="w-10 h-10 text-white/50" />
                )}
            </div>
        </div>
      </div>

      {mediaCard && isActive && (
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-center animate-fade-in pointer-events-none">
           {mediaCard.embedUrl ? (
              <div className="pointer-events-auto bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 w-full max-w-lg aspect-video relative group">
                  <button 
                      onClick={() => setMediaCard(null)}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-red-500/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors z-10"
                  >
                      <X className="w-4 h-4" />
                  </button>
                  <iframe 
                      src={mediaCard.embedUrl} 
                      className="w-full h-full" 
                      allow="autoplay; encrypted-media; picture-in-picture" 
                      allowFullScreen
                      title="Video Player"
                  />
              </div>
           ) : (
              <div className="pointer-events-auto bg-surface/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4 flex items-center gap-4 shadow-xl max-w-md w-full ring-1 ring-primary/20">
                  <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                      {mediaCard.platform === 'spotify' ? <Music className="w-6 h-6 text-green-500" /> : <Youtube className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-text truncate">{mediaCard.title}</h4>
                      <p className="text-xs text-text-sub truncate">
                        {mediaCard.artist || `Playing on ${mediaCard.platform === 'spotify' ? 'Spotify' : 'YouTube'}`}
                      </p>
                  </div>
                  <a 
                     href={mediaCard.url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="bg-primary hover:bg-primary-dark text-white p-3 rounded-full shadow-lg shadow-primary/20 flex-shrink-0 transition-transform active:scale-95 flex items-center justify-center gap-2"
                     title="Open in New Tab"
                  >
                     <ExternalLink className="w-5 h-5 fill-current" />
                  </a>
                  <button 
                      onClick={() => setMediaCard(null)}
                      className="text-text-sub hover:text-text p-1"
                  >
                      <X className="w-4 h-4" />
                  </button>
              </div>
           )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4 relative custom-scrollbar">
        {messages.length === 0 && isActive && (
             <div className="text-center text-text-sub/40 mt-10 animate-pulse">
               <p>Listening for your voice...</p>
             </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
               <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-border ${msg.role === 'user' ? 'bg-surfaceHighlight' : 'bg-primary/20'}`}>
                 {msg.role === 'user' ? <User className="w-4 h-4 text-text" /> : <Sparkles className="w-4 h-4 text-primary" />}
               </div>
               <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-primary/20 to-blue-600/10 text-text rounded-tr-sm border border-primary/20' 
                    : 'bg-gradient-to-br from-surface/40 to-surface/10 backdrop-blur-sm border border-white/5 text-text rounded-tl-sm'
               }`}>
                 {msg.text}
               </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-6 bg-surface/30 backdrop-blur border-t border-border flex flex-col items-center gap-3">
        {error && (
          <div className="mb-4 text-center">
            <p className="text-sm text-red-400 mb-2 font-medium">{error}</p>
            <button onClick={() => { setError(null); connect(); }} className="flex items-center gap-2 text-xs bg-surfaceHighlight hover:bg-surface px-4 py-2 rounded-lg border border-white/10 mx-auto transition-colors">
              <RefreshCw className="w-3 h-3" /> Reconnect
            </button>
          </div>
        )}
        
        <button
          onClick={toggleConnection}
          className={`px-10 py-4 rounded-full font-bold text-lg transition-all flex items-center gap-3 shadow-xl transform active:scale-95 ${
            isActive 
              ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30' 
              : 'bg-text text-background hover:opacity-90 shadow-white/10'
          }`}
        >
          {isActive ? (
            <>
              <MicOff className="w-6 h-6" />
              End Session
            </>
          ) : (
            <>
              <Mic className="w-6 h-6" />
              Start Live
            </>
          )}
        </button>
        <p className="text-[10px] text-text-sub/70 flex items-center gap-1.5 mt-2">
           <AlertTriangle className="w-3 h-3 text-green-500" /> Adaptive Mode • Auto-Tone & Language
        </p>
      </div>

    </div>
  );
};
