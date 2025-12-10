
import React, { useState, useEffect } from 'react';
import { Brain, Globe, ChevronDown, UserCircle, Upload, FileText, File } from 'lucide-react';
import { ChatConfig, GeminiModel, Persona, ChatSession } from '../types';
import { exportChatToMarkdown, exportChatToPDF, exportChatToText } from '../utils/exportUtils';

interface ChatControlsProps {
  config: ChatConfig;
  setConfig: React.Dispatch<React.SetStateAction<ChatConfig>>;
  currentSession: ChatSession | null;
}

export const ChatControls: React.FC<ChatControlsProps> = ({ config, setConfig, currentSession }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('zara_personas');
    if (stored) setPersonas(JSON.parse(stored));
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, model: e.target.value as GeminiModel }));
  };

  const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, activePersonaId: e.target.value || undefined }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-surface/50 border-b border-white/5 backdrop-blur-sm z-20">
      
      {/* Model Selector */}
      <div className="relative group">
        <select
          value={config.model}
          onChange={handleModelChange}
          className="appearance-none bg-surfaceHighlight border border-border text-text text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer hover:bg-surfaceHighlight/80 transition-all"
        >
          <option value="gemini-2.5-flash">Zara Fast (Default)</option>
          <option value="gemini-3-pro-preview">Zara Pro (High IQ)</option>
          <option value="gemini-flash-lite-latest">Zara Lite (Eco)</option>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-sub pointer-events-none" />
      </div>

      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* Persona Selector */}
      {personas.length > 0 && (
         <div className="relative group">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
               <UserCircle className="w-3.5 h-3.5 text-text-sub" />
            </div>
            <select
               value={config.activePersonaId || ''}
               onChange={handlePersonaChange}
               className="appearance-none bg-surfaceHighlight border border-border text-text text-xs font-medium rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer hover:bg-surfaceHighlight/80 transition-all max-w-[120px] truncate"
            >
               <option value="">Default Zara</option>
               {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-sub pointer-events-none" />
         </div>
      )}

      <div className="flex-1" />
      
      {/* Toggles */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfig(prev => ({ ...prev, useThinking: !prev.useThinking }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            config.useThinking 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
              : 'hover:bg-white/5 text-text-sub'
          }`}
          title="Enable Thinking Process (Slower but Smarter)"
        >
          <Brain className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Thinking</span>
        </button>

        <button
          onClick={() => setConfig(prev => ({ ...prev, useGrounding: !prev.useGrounding }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            config.useGrounding 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'hover:bg-white/5 text-text-sub'
          }`}
          title="Enable Search Grounding (Adds latency)"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Grounding</span>
        </button>
        
        {currentSession && (
          <div className="relative">
             <button 
               onClick={() => setShowExportMenu(!showExportMenu)} 
               className={`p-1.5 rounded-lg transition-colors ${showExportMenu ? 'bg-surfaceHighlight text-text' : 'text-text-sub hover:bg-surfaceHighlight hover:text-text'}`}
               title="Export Chat"
             >
                <Upload className="w-4 h-4" />
             </button>
             {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl overflow-hidden flex flex-col z-50 animate-fade-in">
                     <div className="px-3 py-2 text-[10px] font-bold text-text-sub uppercase tracking-wider bg-surfaceHighlight/50">Export As</div>
                     <button onClick={() => { exportChatToMarkdown(currentSession); setShowExportMenu(false); }} className="px-4 py-2 hover:bg-surfaceHighlight text-left text-sm flex items-center gap-2 text-text transition-colors">
                        <FileText className="w-4 h-4 text-primary" /> Markdown
                     </button>
                     <button onClick={() => { exportChatToText(currentSession); setShowExportMenu(false); }} className="px-4 py-2 hover:bg-surfaceHighlight text-left text-sm flex items-center gap-2 text-text transition-colors">
                        <File className="w-4 h-4 text-primary" /> Plain Text
                     </button>
                     <button onClick={() => { exportChatToPDF(currentSession); setShowExportMenu(false); }} className="px-4 py-2 hover:bg-surfaceHighlight text-left text-sm flex items-center gap-2 text-text transition-colors">
                        <FileText className="w-4 h-4 text-primary" /> Print / PDF
                     </button>
                  </div>
                </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
