import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles, BookOpen, Heart, Code2, Palette, Hammer, WifiOff, Globe, Search, ChevronDown, Brain, Upload, FileText, File } from 'lucide-react';
import { Message, Role, Attachment, ViewMode, ChatConfig, PersonalizationConfig, Persona } from './types';
import { sendMessageToGeminiStream } from './services/gemini';
import { OfflineService } from './services/offlineService';
import { MessageItem } from './components/MessageItem';
import { InputArea } from './components/InputArea';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { StudentMode } from './components/StudentMode';
import { CodeMode } from './components/CodeMode';
import { LiveMode } from './components/LiveMode';
import { ChatControls } from './components/ChatControls';
import { ImageMode } from './components/ImageMode';
import { ExamMode } from './components/ExamMode';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { StudyPlanner } from './components/StudyPlanner';
import { AboutPage } from './components/AboutPage';
import { FeedbackModal } from './components/FeedbackModal';
import { useChatSessions } from './hooks/useChatSessions';
import { useTheme } from './theme/ThemeContext'; 
import { useAppMemory } from './hooks/useAppMemory';
import { useModeThemeSync } from './hooks/useModeThemeSync';
import { THEMES } from './theme/themes';
import { ThemeName } from './theme/types';
import { FlashcardMode } from './components/FlashcardMode';
import { VideoMode } from './components/VideoMode';
import { NotesVault } from './components/NotesVault';
import { AppBuilderMode } from './components/AppBuilderMode';
import { GithubMode } from './components/GithubMode';
import { CommandPalette } from './components/CommandPalette';
import { HomeDashboard } from './components/features/HomeDashboard';
import { LifeOS } from './components/features/LifeOS';
import { SkillOS } from './components/features/SkillOS';
import { MemoryVault } from './components/features/MemoryVault';
import { CreativeStudio } from './components/features/CreativeStudio';
import { PricingView } from './components/os/PricingView';
import { exportChatToMarkdown, exportChatToPDF, exportChatToText } from './utils/exportUtils';

const STORAGE_KEY_PERSONALIZATION = 'zara_personalization';

const App: React.FC = () => {
  const { lastView, updateView, systemConfig, updateSystemConfig } = useAppMemory();
  const { currentThemeName, setTheme } = useTheme();

  const [currentView, setCurrentView] = useState<ViewMode>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Animation State for Branding Star
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
     const handleOnline = () => setIsOnline(true);
     const handleOffline = () => setIsOnline(false);
     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);
     return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
     };
  }, []);

  useEffect(() => {
     if (lastView) setCurrentView(lastView);
  }, [lastView]);

  const handleViewChange = useCallback((view: ViewMode) => {
    setCurrentView(view);
    updateView(view);
    if(view === 'settings') setIsSettingsOpen(true);
    setIsSidebarOpen(false);
  }, [updateView]);

  useModeThemeSync(currentView, systemConfig.autoTheme, setTheme);
  
  const [personalization, setPersonalization] = useState<PersonalizationConfig>({
    nickname: '', occupation: '', aboutYou: '', customInstructions: '', fontSize: 'medium'
  });

  const { 
    sessions, currentSessionId, createSession, updateSession, deleteSession, renameSession, loadSession, clearCurrentSession 
  } = useChatSessions();

  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig>({ 
    model: 'gemini-2.5-flash', 
    useThinking: false, 
    useGrounding: false,
    isEmotionalMode: false 
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); 
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PERSONALIZATION);
    if (stored) {
      try { setPersonalization(JSON.parse(stored)); } catch(e) {}
    }
  }, []);

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    abortRef.current = false;
    shouldAutoScrollRef.current = true;
    
    let historyToUse = messages;
    if (editingMessage) {
      const idx = messages.findIndex(m => m.id === editingMessage.id);
      if (idx !== -1) historyToUse = messages.slice(0, idx);
      setEditingMessage(null);
    }

    const newUserMsg: Message = { id: crypto.randomUUID(), role: Role.USER, text, attachments, timestamp: Date.now() };
    const msgsWithUser = [...historyToUse, newUserMsg];
    setMessages(msgsWithUser);
    setIsLoading(true);

    const botMsgId = crypto.randomUUID();
    
    if (!isOnline) {
       setTimeout(async () => {
          const resp = await OfflineService.processMessage(text, personalization, handleViewChange);
          const botMsg: Message = { id: botMsgId, role: Role.MODEL, text: resp, timestamp: Date.now(), isOffline: true };
          const final = [...msgsWithUser, botMsg];
          setMessages(final);
          setIsLoading(false);
          if (currentSessionId) updateSession(currentSessionId, final); else createSession(final);
       }, 600);
       return;
    }

    const initialBotMsg: Message = { id: botMsgId, role: Role.MODEL, text: '', timestamp: Date.now(), isStreaming: true };
    setMessages([...msgsWithUser, initialBotMsg]);

    try {
      let activePersona: Persona | undefined;
      if (chatConfig.activePersonaId) {
         const stored = localStorage.getItem('zara_personas');
         if (stored) {
            const personas: Persona[] = JSON.parse(stored);
            activePersona = personas.find(p => p.id === chatConfig.activePersonaId);
         }
      }

      const { text: finalText, sources } = await sendMessageToGeminiStream(
        historyToUse, text, attachments, chatConfig, personalization,
        (partial) => {
             if (abortRef.current) return;
             setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: partial } : m));
        },
        activePersona
      );
      
      if (abortRef.current) return;
      const finalBotMsg = { ...initialBotMsg, text: finalText, sources, isStreaming: false };
      const finalMessages = [...msgsWithUser, finalBotMsg];
      setMessages(finalMessages);
      if (currentSessionId) updateSession(currentSessionId, finalMessages); else createSession(finalMessages);
    } catch (error: any) {
      if (abortRef.current) return;
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false, isError: true, text: m.text || "Connection failed." } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const currentSession = currentSessionId ? sessions.find(s => s.id === currentSessionId) || null : null;

  // Memoize content based on view to prevent unnecessary re-renders, but trigger animations on view change
  const currentContent = useMemo(() => {
    switch (currentView) {
      case 'dashboard': return <HomeDashboard onViewChange={handleViewChange} />;
      case 'student': return <StudentMode />;
      case 'code': return <CodeMode />;
      case 'live': return <LiveMode personalization={personalization} />;
      case 'exam': return <ExamMode />;
      case 'analytics': return <AnalyticsDashboard />;
      case 'planner': return <StudyPlanner />;
      case 'about': return <AboutPage />;
      case 'workspace': return <ImageMode />;
      case 'builder': return <AppBuilderMode />;
      case 'notes': return <NotesVault onStartChat={(ctx) => { handleSendMessage(ctx, []); handleViewChange('chat'); }} />;
      case 'life-os': return <LifeOS />;
      case 'skills': return <SkillOS />;
      case 'memory': return <MemoryVault />;
      case 'creative': return <CreativeStudio />;
      case 'pricing': return <PricingView />;
      case 'mastery': return <FlashcardMode />;
      case 'video': return <VideoMode />;
      case 'github': return <GithubMode />;
      case 'chat':
      default:
        const fs = personalization.fontSize === 'large' ? 'text-lg' : personalization.fontSize === 'small' ? 'text-sm' : 'text-base';
        return (
          <div className={`flex-1 flex flex-col h-full relative ${fs} transition-all duration-500 ${chatConfig.isEmotionalMode ? 'bg-gradient-to-b from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20' : ''} animate-fade-in`}>
            {/* Unified Header with Sidebar Toggle Removed */}
            <header className="flex items-center justify-between px-4 py-3 bg-background/50 backdrop-blur-sm border-b border-white/5 z-30 sticky top-0 transition-transform duration-300">
               <div className="flex items-center gap-3">
                  <ChatControls 
                    config={chatConfig} setConfig={setChatConfig} 
                    currentSession={currentSession}
                  />
               </div>
               
               <div className="flex items-center gap-1 md:gap-4">
                  {/* Emotional Mode Button */}
                  <button
                    onClick={() => setChatConfig(prev => ({ ...prev, isEmotionalMode: !prev.isEmotionalMode }))}
                    className={`p-2 rounded-full transition-all ${
                      chatConfig.isEmotionalMode 
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-pulse' 
                        : 'text-text-sub hover:bg-surfaceHighlight hover:text-violet-400'
                    }`}
                    title="Toggle Emotional Support Mode"
                  >
                    <Heart className={`w-5 h-5 ${chatConfig.isEmotionalMode ? 'fill-current' : ''}`} />
                  </button>

                  <div className="flex items-center gap-2 text-text-sub">
                    <button className="hidden md:block p-2 hover:bg-surfaceHighlight rounded-lg transition-colors"><Globe className="w-5 h-5 hover:animate-spin" /></button>
                  </div>

                  {/* Export Button */}
                  {currentSession && (
                    <div className="relative">
                       <button 
                         onClick={() => setShowExportMenu(!showExportMenu)} 
                         className={`p-2 rounded-full transition-colors ${showExportMenu ? 'bg-surfaceHighlight text-text' : 'text-text-sub hover:bg-surfaceHighlight'}`}
                         title="Export Chat"
                       >
                          <Upload className="w-5 h-5" />
                       </button>
                       {showExportMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 animate-fade-in backdrop-blur-xl">
                               <div className="px-4 py-3 text-[10px] font-black text-text-sub uppercase tracking-[0.2em] bg-white/5">Export As</div>
                               <button onClick={() => { exportChatToMarkdown(currentSession); setShowExportMenu(false); }} className="px-4 py-3 hover:bg-white/5 text-left text-sm flex items-center gap-3 text-text transition-colors">
                                  <FileText className="w-4 h-4 text-primary" /> Markdown
                               </button>
                               <button onClick={() => { exportChatToText(currentSession); setShowExportMenu(false); }} className="px-4 py-3 hover:bg-white/5 text-left text-sm flex items-center gap-3 text-text transition-colors">
                                  <File className="w-4 h-4 text-primary" /> Plain Text
                               </button>
                               <button onClick={() => { exportChatToPDF(currentSession); setShowExportMenu(false); }} className="px-4 py-3 hover:bg-white/5 text-left text-sm flex items-center gap-3 text-text transition-colors">
                                  <FileText className="w-4 h-4 text-primary" /> Print / PDF
                               </button>
                            </div>
                          </>
                       )}
                    </div>
                  )}

                  {/* Thinking Button - Moved to Rightmost Position */}
                  <button
                    onClick={() => setChatConfig(prev => ({ ...prev, useThinking: !prev.useThinking }))}
                    className={`p-2 rounded-full transition-all ${
                      chatConfig.useThinking 
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                        : 'text-text-sub hover:bg-surfaceHighlight'
                    }`}
                    title="Enable Thinking"
                  >
                    <Brain className="w-5 h-5" />
                  </button>
               </div>
            </header>

            <div ref={scrollContainerRef} onScroll={() => {
              if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
              }
            }} className="flex-1 overflow-y-auto px-4 md:px-0">
              <div className="max-w-3xl mx-auto h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                     {/* Branding Section with Interactive Flip Animation */}
                     <div 
                        onClick={() => {
                           setIsFlipping(true);
                           setTimeout(() => setIsFlipping(false), 1000);
                        }}
                        className={`w-24 h-24 border rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden group transition-all duration-500 cursor-pointer ${isFlipping ? 'animate-flip-3d' : 'animate-float'} ${chatConfig.isEmotionalMode ? 'bg-violet-500/10 border-violet-500/20' : 'bg-surfaceHighlight/50 border-white/10'}`}
                     >
                        <div className={`absolute inset-0 bg-gradient-to-br to-transparent ${chatConfig.isEmotionalMode ? 'from-violet-500/20' : 'from-purple-500/20'} animate-shimmer`} />
                        {chatConfig.isEmotionalMode ? (
                           <Heart className="w-12 h-12 text-violet-500 fill-violet-500/20 relative z-10 animate-pulse" />
                        ) : (
                           <Sparkles className="w-12 h-12 text-primary relative z-10" />
                        )}
                     </div>
                     
                     <div className="mb-12 animate-slide-up">
                        <h2 className="text-xl font-medium text-text-sub mb-1">Hello, I'm</h2>
                        <h1 className={`text-6xl font-black mb-6 tracking-tight bg-clip-text text-transparent ${chatConfig.isEmotionalMode ? 'bg-gradient-to-r from-violet-400 to-fuchsia-500' : 'bg-gradient-to-r from-purple-400 to-indigo-400'}`}>
                           {chatConfig.isEmotionalMode ? 'Zara Care' : 'Zara AI'}
                        </h1>
                        <p className="text-lg text-text-sub/80">
                           {chatConfig.isEmotionalMode ? "I'm listening. How are you feeling?" : "What would you like to do?"}
                        </p>
                     </div>

                     {/* Action Cards - Hidden in Emotional Mode to focus on convo */}
                     {!chatConfig.isEmotionalMode && (
                       <div className="w-full max-w-sm space-y-4 animate-slide-up delay-100">
                          <button 
                             onClick={() => handleViewChange('builder')}
                             className="w-full glass-panel p-5 rounded-2xl flex items-center gap-5 hover:bg-white/5 transition-all text-left group hover:scale-[1.02] duration-300"
                          >
                             <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                <Hammer className="w-6 h-6" />
                             </div>
                             <div>
                                <h3 className="font-bold text-lg text-text">App Builder</h3>
                                <p className="text-[10px] font-black text-text-sub uppercase tracking-[0.2em]">FULL STACK</p>
                             </div>
                          </button>

                          <button 
                             onClick={() => {
                                setChatConfig(prev => ({ ...prev, isEmotionalMode: true }));
                             }}
                             className="w-full glass-panel p-5 rounded-2xl flex items-center gap-5 hover:bg-white/5 transition-all text-left group hover:scale-[1.02] duration-300"
                          >
                             <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform">
                                <Heart className="w-6 h-6" />
                             </div>
                             <div>
                                <h3 className="font-bold text-lg text-text">Emotional Support</h3>
                                <p className="text-[10px] font-black text-text-sub uppercase tracking-[0.2em]">WELL-BEING</p>
                             </div>
                          </button>
                       </div>
                     )}
                  </div>
                ) : (
                  <div className="flex-1 py-6 space-y-2">
                    {messages.map((msg) => (
                      <MessageItem key={msg.id} message={msg} onEdit={setEditingMessage} />
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
              </div>
            </div>
            <InputArea 
              onSendMessage={handleSendMessage} onStop={() => { abortRef.current = true; setIsLoading(false); }}
              isLoading={isLoading} disabled={false} isOffline={!isOnline} editMessage={editingMessage}
              onCancelEdit={() => setEditingMessage(null)} viewMode={currentView}
              isEmotionalMode={chatConfig.isEmotionalMode} // Pass the mode
            />
          </div>
        );
    }
  }, [currentView, handleViewChange, messages, isLoading, isOnline, editingMessage, personalization, chatConfig, sessions, currentSessionId, isFlipping, showExportMenu]);

  return (
    <div className={`flex h-screen bg-background overflow-hidden text-text font-sans transition-all duration-300 ${systemConfig.density === 'compact' ? 'text-sm' : ''}`}>
      <Sidebar 
        currentView={currentView} onViewChange={handleViewChange} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        sessions={sessions} activeSessionId={currentSessionId} onNewChat={() => { clearCurrentSession(); setMessages([]); handleViewChange('chat'); }}
        onSelectSession={(id) => { setMessages(loadSession(id)); handleViewChange('chat'); }} onRenameSession={renameSession}
        onDeleteSession={(id) => { deleteSession(id); if (currentSessionId === id) setMessages([]); }} onOpenFeedback={() => setIsFeedbackOpen(true)}
      />
      <div className="flex-1 flex flex-col h-full relative w-full">
        {!isOnline && <div className="bg-orange-500 text-white text-[10px] font-black py-1 px-4 text-center z-50 uppercase tracking-widest animate-slide-in-right">OFFLINE MODE</div>}
        {/* Main Content Area with Key-Based Transition Trigger */}
        <main className="flex-1 overflow-hidden relative flex flex-col key-transition-wrapper">
           <div key={currentView} className="h-full w-full animate-fade-in">
              {currentContent}
           </div>
        </main>
      </div>
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} onAction={(a, p) => { if(a === 'new-chat') { clearCurrentSession(); setMessages([]); handleViewChange('chat'); } else if(a === 'switch-mode') handleViewChange(p); }} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} personalization={personalization} setPersonalization={(p) => { setPersonalization(p); localStorage.setItem(STORAGE_KEY_PERSONALIZATION, JSON.stringify(p)); }} systemConfig={systemConfig} setSystemConfig={updateSystemConfig} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
};

export default App;