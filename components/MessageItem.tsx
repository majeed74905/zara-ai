
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Role, Message } from '../types';
import { Bot, User, FileText, ExternalLink, Volume2, Square, Copy, Check, Pencil, Download, WifiOff, Workflow } from 'lucide-react';
import mermaid from 'mermaid';

interface MessageItemProps {
  message: Message;
  onEdit?: (message: Message) => void;
}

// Mermaid Component
const MermaidDiagram = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Re-initialize with a light theme for the white background
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'default', // 'default' is the standard light theme
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif',
        flowchart: {
            htmlLabels: true,
            curve: 'basis'
        }
    });
    
    const renderDiagram = async () => {
      try {
        // Wrap rendering in a try-catch to handle syntax errors gracefully
        const { svg } = await mermaid.render(idRef.current, code);
        setSvg(svg);
      } catch (error) {
        console.error('Mermaid render error:', error);
        // Fallback: Display the raw code so the user can still read the logic
        setSvg(`<div class="text-red-500 font-mono text-xs p-2 bg-red-50 border border-red-100 rounded">
          <strong>Diagram Syntax Error:</strong><br/>
          ${(error as any).message}<br/><br/>
          <span class="text-gray-500">Raw Code:</span><br/>
          <pre class="whitespace-pre-wrap">${code}</pre>
        </div>`);
      }
    };

    renderDiagram();
  }, [code]);

  const handleDownload = async () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    setIsExporting(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      // HD Quality: Scale up by 3x
      const scale = 3;
      const bcr = svgElement.getBoundingClientRect();
      const width = bcr.width || 800;
      const height = bcr.height || 600;
      
      canvas.width = width * scale;
      canvas.height = height * scale;

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        if (!ctx) return;
        // Background for contrast
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        
        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `flowchart-${Date.now()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };
      img.src = url;
    } catch (err) {
      console.error("Export failed", err);
      setIsExporting(false);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl bg-white border border-gray-200 shadow-md">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
                <Workflow className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visualization</span>
            </div>
            <button 
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              title="Download HD Image"
            >
              {isExporting ? <span className="animate-pulse">EXPORTING...</span> : <><Download className="w-3 h-3" /> DOWNLOAD HD</>}
            </button>
        </div>
        <div 
            ref={containerRef}
            className="p-4 flex justify-center overflow-x-auto custom-scrollbar"
            dangerouslySetInnerHTML={{ __html: svg }} 
        />
    </div>
  );
};

// Custom Code Block Component
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  
  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    if (match[1] === 'mermaid') {
        return <MermaidDiagram code={String(children).replace(/\n$/, '')} />;
    }

    return (
      <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
           <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
           <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
             {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
             {copied ? 'Copied' : 'Copy code'}
           </button>
        </div>
        <pre className="!m-0 !p-4 !bg-transparent overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  }
  return <code className={`${className} bg-primary/10 text-primary px-1 py-0.5 rounded text-sm`} {...props}>{children}</code>;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, onEdit }) => {
  const isUser = message.role === Role.USER;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleSpeak = () => {
    // Cancel any current speech
    window.speechSynthesis.cancel();

    // Simple markdown stripping for better speech
    const cleanText = message.text
      .replace(/[*_#`]/g, '') // Remove basic markdown symbols
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just text
      .replace(/\[.*?\]/g, ''); // Remove tone tags like [Softly], [Laughs]

    const newUtterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to select a better voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) 
                        || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) newUtterance.voice = preferredVoice;

    newUtterance.rate = speed;
    
    newUtterance.onend = () => {
      setIsSpeaking(false);
      setUtterance(null);
    };

    newUtterance.onerror = () => {
      setIsSpeaking(false);
      setUtterance(null);
    };

    setUtterance(newUtterance);
    setIsSpeaking(true);
    window.speechSynthesis.speak(newUtterance);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setUtterance(null);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setSpeed(newSpeed);
    
    // If currently speaking, we need to restart to apply speed change in most browsers
    if (isSpeaking && utterance) {
       window.speechSynthesis.cancel();
       const newUtt = new SpeechSynthesisUtterance(utterance.text);
       newUtt.voice = utterance.voice;
       newUtt.rate = newSpeed;
       newUtt.onend = () => { setIsSpeaking(false); setUtterance(null); };
       setUtterance(newUtt);
       window.speechSynthesis.speak(newUtt);
    }
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
      <div className={`flex max-w-[95%] md:max-w-[80%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-border ${isUser ? 'bg-surfaceHighlight' : message.isOffline ? 'bg-orange-500/10 border-orange-500/30' : 'bg-transparent'}`}>
          {isUser ? (
            <User className="w-5 h-5 text-text" />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${message.isOffline ? 'bg-orange-500' : 'bg-gradient-to-br from-primary to-accent'}`}>
                {message.isOffline ? <WifiOff className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
            </div>
          )}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}>
          
          {/* Metadata/Name */}
          <span className="text-xs text-text-sub mb-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {isUser ? 'You' : 'Zara AI'}
            {!isUser && message.isOffline && (
                <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 rounded">OFFLINE</span>
            )}
          </span>

          {/* Attachments Display */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {message.attachments.map((att) => (
                <div 
                  key={att.id} 
                  className={`relative group overflow-hidden rounded-lg border border-border bg-background ${
                    att.mimeType === 'application/pdf' ? 'w-full max-w-sm' : ''
                  }`}
                >
                  {att.mimeType.startsWith('image/') ? (
                    <img src={att.previewUrl} alt="attachment" className="h-32 w-auto object-cover" />
                  ) : att.mimeType === 'application/pdf' ? (
                     <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between p-2.5 border-b border-border bg-surfaceHighlight/50">
                           <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                              <span className="text-xs font-medium text-text truncate max-w-[180px]">
                                {att.file.name}
                              </span>
                           </div>
                           <a 
                             href={att.previewUrl} 
                             download={att.file.name} 
                             className="p-1.5 hover:bg-surface rounded-md text-text-sub hover:text-text transition-colors" 
                             title="Download PDF"
                           >
                              <Download className="w-4 h-4" />
                           </a>
                        </div>
                        <div className="h-[400px] w-full bg-surface relative rounded-b-lg overflow-hidden">
                             <iframe 
                               src={`${att.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                               className="w-full h-full border-none" 
                               title={`PDF Viewer for ${att.file.name}`}
                             />
                        </div>
                     </div>
                  ) : (
                    <div className="h-20 w-32 bg-surfaceHighlight flex flex-col items-center justify-center p-2">
                      <FileText className="w-8 h-8 text-text-sub mb-1" />
                      <span className="text-[10px] text-text-sub truncate w-full text-center">
                        {att.file.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 max-w-full">
             {/* Edit Button (User only) - appears to the left of the bubble */}
             {isUser && onEdit && (
               <button 
                 onClick={() => onEdit(message)}
                 className="p-1.5 text-text-sub hover:text-text bg-surfaceHighlight hover:bg-surface border border-transparent hover:border-border rounded-full opacity-0 group-hover:opacity-100 transition-all"
                 title="Edit message"
               >
                 <Pencil className="w-3.5 h-3.5" />
               </button>
             )}

            {/* Text Content */}
            <div
              className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm overflow-hidden ${
                isUser
                  ? 'bg-surfaceHighlight text-text rounded-tr-sm border border-white/5'
                  : message.isOffline
                    ? 'bg-orange-500/5 text-text-sub w-full markdown-body border border-orange-500/10'
                    : 'bg-transparent text-text-sub w-full markdown-body'
              }`}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.text}</div>
              ) : (
                 /* Using custom renderers for code blocks */
                 <div className="relative">
                   <ReactMarkdown 
                     components={{
                       code: CodeBlock
                     }}
                   >
                     {message.text}
                   </ReactMarkdown>
                   {/* Streaming Cursor */}
                   {message.isStreaming && (
                     <span className="inline-block w-2.5 h-2.5 rounded-full bg-text-sub ml-1 animate-pulse align-baseline" />
                   )}
                 </div>
              )}
              
              {message.isError && (
                 <p className="text-red-400 text-sm mt-2">Error sending message.</p>
              )}
            </div>
          </div>

          {/* Sources / Grounding */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-2 ml-1 mb-2">
              <div className="flex flex-wrap gap-2">
                {message.sources.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-surfaceHighlight border border-border hover:bg-surface hover:border-primary/50 text-text-sub hover:text-primary px-3 py-1.5 rounded-full text-xs transition-all max-w-[240px]"
                    title={source.title}
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{source.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* TTS Controls (Only for AI) */}
          {!isUser && !message.isError && (
            <div className="mt-1 ml-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {isSpeaking ? (
                <div className="flex items-center gap-2 bg-surfaceHighlight border border-border rounded-full px-2 py-1">
                  <button 
                    onClick={handleStop}
                    className="p-1.5 rounded-full hover:bg-surface text-primary transition-colors"
                    title="Stop reading"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <div className="w-px h-3 bg-border" />
                  <button 
                    onClick={cycleSpeed}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-surface text-[10px] font-medium text-text-sub transition-colors min-w-[32px] justify-center"
                    title="Change speed"
                  >
                    {speed}x
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleSpeak}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-text-sub hover:text-text hover:bg-surfaceHighlight transition-colors"
                  title="Read aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Read</span>
                </button>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};
