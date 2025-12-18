
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Sparkles, BookOpen, Heart, Code2, Palette, Hammer, WifiOff } from 'lucide-react';
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
import { VoiceMode } from './components/VoiceMode';
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
import { NewsMode } from './components/NewsMode';
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
     // Restore view, fallback to chat if the stored view is invalid (handled by set default in state but good to check)
     if (lastView) {
        setCurrentView(lastView);
     }
  }, [lastView]);

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
    updateView(view);
    if(view === 'settings') setIsSettingsOpen(true);
    setIsSidebarOpen(false);
  };

  useModeThemeSync(currentView, systemConfig.autoTheme, setTheme);
  
  const [personalization, setPersonalization] = useState<PersonalizationConfig>({
    nickname: '',
    occupation: '',
    aboutYou: '',
    customInstructions: '',
    fontSize: 'medium'
  });

  const { 
    sessions, 
    currentSessionId, 
    createSession, 
    updateSession, 
    deleteSession, 
    renameSession, 
    loadSession, 
    clearCurrentSession 
  } = useChatSessions();

  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [chatConfig, setChatConfig] = useState<ChatConfig>({ 
    model: 'gemini-2.5-flash', 
    useThinking: false, 
    useGrounding: false
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); 
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    const storedPersonalization = localStorage.getItem(STORAGE_KEY_PERSONALIZATION);
    if (storedPersonalization) {
      try {
        setPersonalization(JSON.parse(storedPersonalization));
      } catch(e) {
        console.error("Failed to parse personalization", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
       if (e.ctrlKey && e.key === 'n') {
          e.preventDefault();
          handleNewChat();
       }
       if (e.ctrlKey && e.key === 'k') {
          e.preventDefault();
          setIsCommandOpen(true);
       }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handlePersonalizationChange = (config: PersonalizationConfig) => {
    setPersonalization(config);
    localStorage.setItem(STORAGE_KEY_PERSONALIZATION, JSON.stringify(config));
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScrollRef.current = isAtBottom;
  };

  useEffect(() => {
    if (currentView === 'chat' && shouldAutoScrollRef.current) {
       scrollToBottom('smooth');
    }
  }, [messages, currentView]);

  const handleNewChat = () => {
    clearCurrentSession();
    setMessages([]);
    handleViewChange('chat');
    setIsSidebarOpen(false);
    setEditingMessage(null);
    shouldAutoScrollRef.current = true;
  };

  const handleSelectSession = (id: string) => {
    const msgs = loadSession(id);
    setMessages(msgs);
    handleViewChange('chat');
    setIsSidebarOpen(false);
    setEditingMessage(null);
    shouldAutoScrollRef.current = true;
    setTimeout(() => scrollToBottom(), 100);
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id);
    if (currentSessionId === id) {
      setMessages([]);
    }
  };

  const handleStop = () => {
    if (isLoading) {
      abortRef.current = true;
      setIsLoading(false);
    }
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessage(message);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleQuickAction = (text: string) => {
    handleSendMessage(text, []);
  };

  const handleCommandAction = (action: string, payload?: any) => {
    if (action === 'new-chat') handleNewChat();
    if (action === 'switch-mode') handleViewChange(payload);
    if (action === 'open-settings') setIsSettingsOpen(true);
    if (action === 'theme-next') {
        const themes = Object.keys(THEMES) as ThemeName[];
        const currentIndex = themes.indexOf(currentThemeName);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setTheme(nextTheme);
    }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    abortRef.current = false;
    shouldAutoScrollRef.current = true;
    scrollToBottom();

    let historyToUse = messages;
    if (editingMessage) {
      const editIndex = messages.findIndex(m => m.id === editingMessage.id);
      if (editIndex !== -1) {
        historyToUse = messages.slice(0, editIndex);
      }
      setEditingMessage(null);
    }

    const newUserMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.USER,
      text: text,
      attachments: attachments,
      timestamp: Date.now(),
    };

    const msgsWithUser = [...historyToUse, newUserMsg];
    setMessages(msgsWithUser);
    setIsLoading(true);

    const botMsgId = crypto.randomUUID();
    
    // --- OFFLINE MODE HANDLER ---
    if (!isOnline) {
       // Simulate a brief delay for realism
       setTimeout(async () => {
          const offlineResponse = await OfflineService.processMessage(text, personalization, handleViewChange);
          
          const offlineBotMsg: Message = {
             id: botMsgId,
             role: Role.MODEL,
             text: offlineResponse,
             timestamp: Date.now(),
             isOffline: true
          };
          
          const finalMessages = [...msgsWithUser, offlineBotMsg];
          setMessages(finalMessages);
          setIsLoading(false);
          
          if (currentSessionId) updateSession(currentSessionId, finalMessages);
          else createSession(finalMessages);
          
       }, 600);
       return;
    }

    // --- ONLINE GEMINI HANDLER ---
    const initialBotMsg: Message = {
        id: botMsgId,
        role: Role.MODEL,
        text: '',
        timestamp: Date.now(),
        isStreaming: true
    };
    
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
        historyToUse, 
        text, 
        attachments, 
        chatConfig,
        personalization,
        (partialText) => {
             if (abortRef.current) return;
             setMessages(prev => prev.map(m => 
                m.id === botMsgId ? { ...m, text: partialText } : m
             ));
        },
        activePersona
      );
      
      if (abortRef.current) return;

      const finalBotMsg = { ...initialBotMsg, text: finalText, sources, isStreaming: false };
      const finalMessages = [...msgsWithUser, finalBotMsg];
      
      setMessages(finalMessages);
      
      if (currentSessionId) {
        updateSession(currentSessionId, finalMessages);
      } else {
        createSession(finalMessages);
      }

    } catch (error: any) {
      if (abortRef.current) return;
      setMessages(prev => prev.map(m => 
        m.id === botMsgId 
           ? { ...m, isStreaming: false, isError: true, text: m.text || error.message || "An unexpected error occurred." } 
           : m
      ));
    } finally {
      if (!abortRef.current) setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <HomeDashboard onViewChange={handleViewChange} />;
      case 'student': return <StudentMode />;
      case 'code': return <CodeMode />;
      case 'live': return <LiveMode personalization={personalization} />;
      case 'voice': return <VoiceMode />;
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
        const fontSizeClass = personalization.fontSize === 'large' ? 'text-lg' : personalization.fontSize === 'small' ? 'text-sm' : 'text-base';
        return (
          <div className={`flex-1 flex flex-col h-full relative animate-fade-in ${fontSizeClass}`}>
            <ChatControls 
               config={chatConfig} 
               setConfig={setChatConfig} 
               currentSession={currentSessionId ? sessions.find(s => s.id === currentSessionId) || null : null}
            />
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 md:px-0"
            >
              <div className="max-w-3xl mx-auto h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in z-10">
                     <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(139,92,246,0.15)] backdrop-blur-xl border border-white/10 relative group cursor-default">
                        <Sparkles className="w-10 h-10 text-primary transition-transform duration-700 group-hover:rotate-180" />
                        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                     <div className="text-center mb-10 space-y-2">
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                          <span className="text-text-sub font-light opacity-60 block text-2xl md:text-3xl mb-1">Hello, I'm</span>
                          <span className="bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent">Zara AI</span>
                        </h1>
                        <p className="text-lg text-text-sub font-light max-w-md mx-auto">
                           What would you like to do?
                        </p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                        <button onClick={() => handleViewChange('builder')} className="p-4 rounded-xl bg-surface/50 border border-border hover:border-primary/50 hover:bg-surfaceHighlight transition-all text-left group flex items-center gap-4">
                           <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                              <Hammer className="w-5 h-5" />
                           </div>
                           <div>
                             <span className="block font-medium text-text mb-0.5 group-hover:text-primary transition-colors">App Builder</span>
                             <span className="text-xs text-text-sub uppercase tracking-wider">Full Stack</span>
                           </div>
                        </button>
                        <button onClick={() => handleQuickAction("I'm feeling a bit stressed and need to talk.")} className="p-4 rounded-xl bg-surface/50 border border-border hover:border-primary/50 hover:bg-surfaceHighlight transition-all text-left group flex items-center gap-4">
                           <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                              <Heart className="w-5 h-5" />
                           </div>
                           <div>
                             <span className="block font-medium text-text mb-0.5 group-hover:text-primary transition-colors">Emotional Support</span>
                             <span className="text-xs text-text-sub uppercase tracking-wider">Well-being</span>
                           </div>
                        </button>
                     </div>
                     {personalization.nickname && (
                        <p className="mt-8 text-xs text-text-sub/40 font-mono">
                           USER: {personalization.nickname.toUpperCase()}
                        </p>
                     )}
                  </div>
                ) : (
                  <div className="flex-1 py-6 space-y-2">
                    {messages.map((msg) => (
                      <MessageItem 
                        key={msg.id} 
                        message={msg} 
                        onEdit={handleStartEdit} 
                      />
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 pb-4 pt-2 z-10 bg-gradient-to-t from-background via-background to-transparent">
              <InputArea 
                onSendMessage={handleSendMessage} 
                onStop={handleStop}
                isLoading={isLoading} 
                disabled={false}
                isOffline={!isOnline}
                editMessage={editingMessage}
                onCancelEdit={handleCancelEdit}
                viewMode={currentView}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`flex h-screen bg-background overflow-hidden text-text font-sans transition-colors duration-300 ${systemConfig.density === 'compact' ? 'text-sm' : ''}`}>
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onRenameSession={renameSession}
        onDeleteSession={handleDeleteSession}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Offline Banner */}
        {!isOnline && (
           <div className="bg-orange-500/90 backdrop-blur text-white text-xs font-bold py-2 px-4 text-center z-50 flex items-center justify-center gap-2 animate-fade-in shadow-lg">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode &bull; Searching Local Memory Only</span>
           </div>
        )}

        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="text-text">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-lg">Zara AI</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {renderContent()}
        </main>
      </div>

      <CommandPalette 
         isOpen={isCommandOpen} 
         onClose={() => setIsCommandOpen(false)} 
         onAction={handleCommandAction}
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        personalization={personalization}
        setPersonalization={handlePersonalizationChange}
        systemConfig={systemConfig}
        setSystemConfig={updateSystemConfig}
      />
      
      <FeedbackModal 
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  );
};

export default App;
