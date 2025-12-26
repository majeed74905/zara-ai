import React, { useRef, useState, useEffect } from 'react';
import { SendHorizontal, Paperclip, X, Image as ImageIcon, FileText, Loader2, Plus, Square, Info, Pencil, Sparkles, Mic, MicOff, WifiOff, Heart } from 'lucide-react';
import { Attachment, Message, ViewMode } from '../types';
import { validateFile, createAttachment } from '../utils/fileUtils';
import { getTemplatesForView } from '../constants/templates';

interface InputAreaProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
  isOffline?: boolean;
  editMessage: Message | null;
  onCancelEdit: () => void;
  viewMode?: ViewMode;
  isEmotionalMode?: boolean; // New prop
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  onStop, 
  isLoading, 
  disabled,
  isOffline = false,
  editMessage,
  onCancelEdit,
  viewMode = 'chat',
  isEmotionalMode = false
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Speech to Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef(''); // Stores text before recording starts

  const templates = getTemplatesForView(viewMode as ViewMode);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; // Enabled for real-time feedback
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentTranscript = finalTranscript + interimTranscript;
        
        // Combine base text with current speech transcript
        const base = baseTextRef.current;
        const spacer = base && !base.endsWith(' ') && currentTranscript ? ' ' : '';
        
        setText(base + spacer + currentTranscript);
        
        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
           alert("Microphone access denied. Please allow microphone permissions.");
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isOffline) {
        alert("Voice input requires an internet connection.");
        return;
    }
    
    if (!recognitionRef.current) {
      alert("Speech to text is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Capture current text as base before starting new session
      baseTextRef.current = text;
      recognitionRef.current.start();
    }
  };

  // Sync text when editMessage changes
  useEffect(() => {
    if (editMessage) {
      setText(editMessage.text);
      setAttachments(editMessage.attachments || []);
      // Reset base text ref if editing
      baseTextRef.current = editMessage.text; 
      
      if (textareaRef.current) {
        textareaRef.current.focus();
        setTimeout(() => {
           if (textareaRef.current) {
               textareaRef.current.style.height = 'auto';
               textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
           }
        }, 0);
      }
    } else {
        setText('');
        setAttachments([]);
    }
  }, [editMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading || disabled) return;
    
    // Stop listening if sending
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    onSendMessage(text, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOffline) {
        alert("File upload is disabled in offline mode.");
        return;
    }
    
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          alert(error);
          continue;
        }
        try {
          const attachment = await createAttachment(file);
          setAttachments((prev) => [...prev, attachment]);
        } catch (err) {
          console.error("Error processing file", err);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const applyTemplate = (prompt: string) => {
    const newText = text + (text ? ' ' : '') + prompt;
    setText(newText);
    baseTextRef.current = newText; // Update base text so speech appends correctly after template
    if (textareaRef.current) textareaRef.current.focus();
  };

  const getPlaceholder = () => {
      if (disabled) return "Please enter API Key to start";
      if (isOffline) return "Offline Mode: Search local notes and memory...";
      if (editMessage) return "Update your message...";
      if (isListening) return "Listening...";
      
      // Emotional Mode Custom Placeholder
      if (isEmotionalMode) return "How are you feeling right now? I'm here to listen.";
      
      return "Enter a prompt here";
  };

  const borderColor = isEmotionalMode ? 'border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : editMessage ? 'border-primary/30' : isOffline ? 'border-orange-500/30' : 'border-white/10';

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:pb-6 relative">
      {/* Templates Row (Scrolling Chips) */}
      {!editMessage && !isLoading && !disabled && !isOffline && !isEmotionalMode && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide px-2">
          {templates.map(tpl => (
             <button
               key={tpl.id}
               onClick={() => applyTemplate(tpl.prompt)}
               className="flex items-center gap-1.5 px-4 py-2 bg-surfaceHighlight border border-white/10 rounded-xl text-xs text-text-sub hover:text-text hover:border-white/20 transition-all whitespace-nowrap shadow-sm group"
             >
               <Sparkles className="w-3 h-3 text-text-sub group-hover:text-primary transition-colors" />
               {tpl.label}
             </button>
          ))}
        </div>
      )}
      
      {/* Emotional Mode Indicator Banner */}
      {isEmotionalMode && (
         <div className="flex justify-center mb-4 animate-fade-in">
            <span className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-bold tracking-wide border border-violet-500/20">
               <Heart className="w-3 h-3 fill-current animate-pulse" /> Emotional Support Active
            </span>
         </div>
      )}
      
      {/* Edit Mode Banner */}
      {editMessage && (
        <div className="mx-2 mb-3 bg-surfaceHighlight border border-border rounded-2xl p-4 flex items-start gap-3 animate-fade-in shadow-xl">
           <div className="bg-primary/10 p-2 rounded-full text-primary mt-0.5">
             <Pencil className="w-4 h-4" />
           </div>
           <div className="flex-1">
             <div className="flex justify-between items-start">
                <span className="text-sm font-bold text-primary flex items-center gap-2">
                   Editing message
                   <button 
                     onClick={onCancelEdit}
                     className="bg-surface border border-border rounded-full p-0.5 text-text-sub hover:text-text hover:bg-surfaceHighlight ml-2"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                </span>
             </div>
             <p className="text-xs text-text-sub mt-1 flex items-center gap-1.5">
               <Info className="w-3.5 h-3.5 opacity-60" />
               Changes will restart the conversation from this point.
             </p>
           </div>
        </div>
      )}

      {/* Input Container */}
      <div className={`relative bg-surface/50 backdrop-blur-xl rounded-[2rem] border transition-all focus-within:ring-2 ${isEmotionalMode ? 'focus-within:ring-violet-500/20' : 'focus-within:ring-primary/20'} shadow-2xl flex flex-col ${borderColor}`}>
        
        {attachments.length > 0 && (
          <div className="flex gap-3 p-4 pb-2 overflow-x-auto">
            {attachments.map((att) => (
              <div key={att.id} className="relative group flex-shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/5 bg-background relative shadow-lg">
                   {att.mimeType.startsWith('image/') ? (
                     <img src={att.previewUrl} alt="preview" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center">
                       <FileText className="w-6 h-6 text-text-sub" />
                       <span className="text-[8px] text-text-sub truncate w-full text-center px-1 font-bold">
                         {att.file.name.split('.').pop()?.toUpperCase()}
                       </span>
                     </div>
                   )}
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-2">
          {/* File Add Icon on left */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 -ml-2 rounded-full transition-colors ${isOffline ? 'text-gray-600 cursor-not-allowed' : 'text-text-sub hover:text-text hover:bg-surfaceHighlight'}`}
            disabled={disabled || isLoading || isOffline}
          >
            <Plus className="w-6 h-6" />
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,application/pdf,text/*"
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled}
            className={`flex-1 bg-transparent text-text placeholder-text-sub/50 text-[16px] resize-none py-4 focus:outline-none max-h-[160px] overflow-y-auto transition-colors ${isListening ? 'placeholder-red-400/70' : ''}`}
            rows={1}
          />

          {/* Right Icons Container */}
          <div className="flex items-center gap-1">
            <div className="w-px h-6 bg-white/10 mx-2" />
            
            {/* Mic Button */}
            <button
               onClick={toggleListening}
               className={`p-2 rounded-full transition-all ${
                 isListening 
                   ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' 
                   : isOffline
                     ? 'text-gray-600 cursor-not-allowed'
                     : 'text-text-sub hover:text-text hover:bg-surfaceHighlight'
               }`}
               disabled={disabled || isLoading || isOffline}
             >
               {isListening ? <MicOff className="w-5 h-5" /> : isOffline ? <WifiOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
             </button>

            {isLoading ? (
              <button
                onClick={onStop}
                className="p-2 rounded-full text-text hover:text-red-400 transition-colors"
                title="Stop generation"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!text.trim() && attachments.length === 0) || disabled}
                className={`p-2 rounded-full transition-all ${
                  (!text.trim() && attachments.length === 0) || disabled
                    ? 'text-text-sub/20 cursor-not-allowed'
                    : isEmotionalMode 
                       ? 'text-white bg-violet-500 hover:bg-violet-600 shadow-lg shadow-violet-500/30' 
                       : 'text-text hover:scale-110 active:scale-95'
                }`}
              >
                <SendHorizontal className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Disclaimer */}
      <div className="text-center mt-4">
         <p className="text-[11px] text-text-sub/40 leading-relaxed px-4">
           {isOffline 
             ? "Offline Mode: AI features limited to local memory search." 
             : "Zara AI may display inaccurate info, including about people, so double-check its responses."
           }
         </p>
      </div>
    </div>
  );
};