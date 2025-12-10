
import React, { useRef, useState, useEffect } from 'react';
import { SendHorizontal, Paperclip, X, Image as ImageIcon, FileText, Loader2, Plus, Square, Info, Pencil, Sparkles, Mic, MicOff, WifiOff } from 'lucide-react';
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
  viewMode?: ViewMode; // Add viewMode prop to show context-aware templates
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  onStop, 
  isLoading, 
  disabled,
  isOffline = false,
  editMessage,
  onCancelEdit,
  viewMode = 'chat'
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
      return "Enter a prompt here";
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 relative">
      {/* Templates Row */}
      {!editMessage && !isLoading && !disabled && !isOffline && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide px-2">
          {templates.map(tpl => (
             <button
               key={tpl.id}
               onClick={() => applyTemplate(tpl.prompt)}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-xs text-text-sub hover:text-primary hover:border-primary/30 transition-all whitespace-nowrap shadow-sm"
             >
               <Sparkles className="w-3 h-3" />
               {tpl.label}
             </button>
          ))}
        </div>
      )}
      
      {/* Edit Mode Banner */}
      {editMessage && (
        <div className="mx-2 mb-2 bg-surfaceHighlight border border-border rounded-xl p-3 flex items-start gap-3 animate-fade-in">
           <div className="bg-primary/10 p-1.5 rounded-full text-primary mt-0.5">
             <Pencil className="w-3.5 h-3.5" />
           </div>
           <div className="flex-1">
             <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-primary flex items-center gap-2">
                   Editing message
                   <button 
                     onClick={onCancelEdit}
                     className="bg-surface border border-border rounded-full p-0.5 text-text-sub hover:text-text hover:bg-surfaceHighlight ml-2"
                   >
                     <X className="w-3 h-3" />
                   </button>
                </span>
             </div>
             <p className="text-xs text-text-sub mt-1 flex items-center gap-1.5">
               <Info className="w-3 h-3" />
               Editing this message will restart the conversation from here.
             </p>
           </div>
        </div>
      )}

      <div className={`relative bg-gradient-to-b from-surface/90 to-surface/50 backdrop-blur-md rounded-3xl border shadow-lg flex flex-col transition-all focus-within:border-primary/30 focus-within:shadow-xl focus-within:shadow-primary/5 ${editMessage ? 'border-primary/30' : isOffline ? 'border-orange-500/30' : 'border-white/10'}`}>
        
        {attachments.length > 0 && (
          <div className="flex gap-3 p-3 pl-4 overflow-x-auto">
            {attachments.map((att) => (
              <div key={att.id} className="relative group flex-shrink-0">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-secondary/50 bg-background relative">
                   {att.mimeType.startsWith('image/') ? (
                     <img src={att.previewUrl} alt="preview" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center">
                       <FileText className="w-6 h-6 text-text-sub" />
                       <span className="text-[8px] text-text-sub truncate w-full text-center px-1">
                         {att.file.name.split('.').pop()?.toUpperCase()}
                       </span>
                     </div>
                   )}
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 bg-secondary text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-2 pl-4">
          <div className="pb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-full transition-colors ${isOffline ? 'text-gray-600 cursor-not-allowed' : 'text-text-sub hover:text-text hover:bg-secondary/30'}`}
              title={isOffline ? "Uploads unavailable offline" : "Add files"}
              disabled={disabled || isLoading || isOffline}
            >
              <Plus className="w-5 h-5" />
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,application/pdf,text/*"
            />
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled}
            className={`flex-1 bg-transparent text-text placeholder-text-sub/50 text-[16px] resize-none py-3 focus:outline-none max-h-[200px] overflow-y-auto transition-colors ${isListening ? 'placeholder-red-400/70' : ''}`}
            rows={1}
          />

          <div className="pb-2 pr-1 flex items-center gap-1">
            
            {/* Mic Button */}
            <button
               onClick={toggleListening}
               className={`p-2 rounded-full transition-all ${
                 isListening 
                   ? 'bg-red-500/10 text-red-500 animate-pulse' 
                   : isOffline
                     ? 'text-gray-600 cursor-not-allowed'
                     : 'text-text-sub hover:text-text hover:bg-surfaceHighlight'
               }`}
               title={isOffline ? "Voice unavailable offline" : "Speech to Text"}
               disabled={disabled || isLoading || isOffline}
             >
               {isListening ? <MicOff className="w-5 h-5" /> : isOffline ? <WifiOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
             </button>

            {isLoading ? (
              <button
                onClick={onStop}
                className="p-2 rounded-full bg-surfaceHighlight border border-border text-text hover:bg-surface/80 transition-all flex items-center justify-center group"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-current text-text group-hover:text-red-400 transition-colors" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!text.trim() && attachments.length === 0) || disabled}
                className={`p-2 rounded-full transition-all ${
                  (!text.trim() && attachments.length === 0) || disabled
                    ? 'text-secondary cursor-not-allowed'
                    : 'bg-text text-background hover:bg-white'
                }`}
              >
                <SendHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="text-center mt-2">
         <p className="text-xs text-text-sub/50">
           {isOffline 
             ? "Offline Mode: AI features limited to local memory search." 
             : "Zara AI may display inaccurate info, including about people, so double-check its responses."
           }
         </p>
      </div>
    </div>
  );
};
