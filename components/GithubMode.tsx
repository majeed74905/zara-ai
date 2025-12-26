
import React, { useState, useEffect, useRef } from 'react';
import { Github, Search, BookOpen, Code, Loader2, GitBranch, FileText, Database, Layers, Workflow, Copy, Check, Sparkles, AlertCircle, Download } from 'lucide-react';
import { analyzeGithubRepo } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import mermaid from 'mermaid';

// --- Mermaid Component for Architectural Visualization ---
const MermaidDiagram = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif'
    });
    
    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, code);
        setSvg(svg);
      } catch (error) {
        setSvg(`<div class="text-red-400 font-mono text-xs p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
          <strong class="text-red-500">Diagram Visualization Error:</strong><br/>
          <pre class="whitespace-pre-wrap mt-2 opacity-70">${code}</pre>
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
      const width = bcr.width || 1200;
      const height = bcr.height || 800;
      
      canvas.width = width * scale;
      canvas.height = height * scale;

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        if (!ctx) return;
        // Background for contrast (dark theme default)
        ctx.fillStyle = '#09090b'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        
        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `architecture-${Date.now()}.png`;
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
    <div className="my-8 overflow-hidden rounded-2xl bg-surfaceHighlight/50 border border-white/10 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 bg-surfaceHighlight border-b border-white/5">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">System Architecture</span>
            </div>
            <button 
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black text-indigo-400 hover:bg-white/5 transition-all border border-indigo-500/20 disabled:opacity-50 tracking-widest"
            >
              {isExporting ? "EXPORTING..." : <><Download className="w-3 h-3" /> DOWNLOAD HD</>}
            </button>
        </div>
        <div 
          ref={containerRef}
          className="p-8 flex justify-center overflow-x-auto custom-scrollbar" 
          dangerouslySetInnerHTML={{ __html: svg }} 
        />
    </div>
  );
};

// --- Custom Code Block for Repo Structure & Snippets ---
const MarkdownCodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const content = String(children).replace(/\n$/, '');
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    if (match[1] === 'mermaid') {
        return <MermaidDiagram code={content} />;
    }

    return (
      <div className="relative group my-6 rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-surfaceHighlight border-b border-white/5">
           <div className="flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-text-sub font-black uppercase tracking-wider">{match[1]}</span>
           </div>
           <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-bold text-text-sub hover:text-white transition-colors">
             {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
             {copied ? 'COPIED' : 'COPY'}
           </button>
        </div>
        <pre className="!m-0 !p-6 !bg-transparent overflow-x-auto text-[13px] leading-relaxed font-mono custom-scrollbar">
          <code className={className} {...props}>{children}</code>
        </pre>
      </div>
    );
  }
  return <code className={`${className} bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-bold`} {...props}>{children}</code>;
};

export const GithubMode: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'overview' | 'implementation'>('overview');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to fetch file structure from GitHub API
  const fetchGithubStructure = async (url: string): Promise<string | null> => {
     try {
        const cleanUrl = url.trim().replace(/\/$/, '');
        // Match both https and ssh styles, extract owner and repo
        const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) return null;
        
        const owner = match[1];
        let repo = match[2];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);

        // Function to fetch from a specific branch
        const fetchBranch = async (branch: string) => {
           const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
           const response = await fetch(apiUrl);
           if (!response.ok) return null;
           const data = await response.json();
           if (!data.tree) return null;
           // Filter and condense: Take top 300 files to avoid context bloating, prioritizing common files
           return data.tree
             .map((f: any) => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`)
             .slice(0, 300)
             .join('\n');
        };

        // Try 'main' then 'master'
        let structure = await fetchBranch('main');
        if (!structure) structure = await fetchBranch('master');
        
        return structure;
     } catch (e) {
        console.warn("GitHub API fetch failed:", e);
        return null;
     }
  };

  const handleAnalyze = async () => {
    if (!repoUrl) return;
    setIsLoading(true);
    setIsFetching(true);
    setError(null);
    setResult('');
    
    try {
      // 1. Fetch real file tree from GitHub API first
      const fileTree = await fetchGithubStructure(repoUrl);
      setIsFetching(false);
      
      if (!fileTree) {
         console.warn("Could not fetch file tree, falling back to general model knowledge.");
      }

      // 2. Pass tree (if found) to Zara for deep analysis
      const content = await analyzeGithubRepo(repoUrl, analysisMode, fileTree || undefined);
      setResult(content);
    } catch (e: any) {
      setError(e.message);
      setResult(`Analysis Failed: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="mb-10">
        <h2 className="text-4xl font-black bg-gradient-to-r from-white via-primary to-accent bg-clip-text text-transparent mb-3 tracking-tight flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white text-black shadow-xl shadow-white/10">
             <Github className="w-8 h-8" />
          </div>
          GitHub Architect
        </h2>
        <p className="text-text-sub font-medium text-lg">Reverse engineer public repositories into real-time architectural DNA.</p>
      </div>

      <div className="flex flex-col gap-8 h-full min-h-0">
        
        {/* Search Bar & Controls */}
        <div className="glass-panel p-8 rounded-[2rem] flex flex-col md:flex-row gap-6 items-end md:items-center shadow-2xl border-white/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-20 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
           
           <div className="flex-1 w-full relative z-10">
              <label className="text-[10px] font-black text-text-sub uppercase mb-2.5 block tracking-[0.2em] opacity-60">Repository Endpoint</label>
              <div className="relative group">
                 <Search className="absolute left-4 top-4 w-5 h-5 text-text-sub group-focus-within:text-white transition-colors" />
                 <input 
                   value={repoUrl}
                   onChange={(e) => setRepoUrl(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder="https://github.com/owner/repo"
                   className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 focus:outline-none transition-all font-mono shadow-inner group-hover:border-white/10"
                 />
              </div>
           </div>
           
           <div className="flex bg-surfaceHighlight p-1.5 rounded-2xl w-full md:w-auto border border-white/5 relative z-10">
              <button 
                onClick={() => setAnalysisMode('overview')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 tracking-widest ${analysisMode === 'overview' ? 'bg-background shadow-xl text-white border border-white/10' : 'text-text-sub hover:text-text'}`}
              >
                 <BookOpen className="w-4 h-4" /> OVERVIEW
              </button>
              <button 
                onClick={() => setAnalysisMode('implementation')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 tracking-widest ${analysisMode === 'implementation' ? 'bg-background shadow-xl text-white border border-white/10' : 'text-text-sub hover:text-text'}`}
              >
                 <Code className="w-4 h-4" /> GUIDE
              </button>
           </div>

           <button 
             onClick={handleAnalyze}
             disabled={isLoading || !repoUrl}
             className="w-full md:w-auto bg-primary hover:bg-primary-dark text-white px-10 py-4 rounded-2xl font-black transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-primary/20 active:scale-95 relative z-10"
           >
             {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitBranch className="w-5 h-5" />}
             ANALYZE
           </button>
        </div>

        {/* Output Area */}
        <div className="flex-1 glass-panel rounded-[2rem] p-8 md:p-12 overflow-y-auto min-h-[400px] border border-white/5 relative custom-scrollbar bg-black/20">
           {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-xl rounded-[2rem] z-20 overflow-hidden">
                 <div className="relative mb-10">
                    <div className="w-24 h-24 border-2 border-primary/20 rounded-full animate-ping absolute inset-0" />
                    <div className="w-24 h-24 border-b-2 border-primary rounded-full animate-spin relative z-10" />
                    <Sparkles className="w-10 h-10 text-primary absolute inset-0 m-auto animate-pulse" />
                 </div>
                 <div className="text-center space-y-4 max-w-md px-6">
                    <p className="text-2xl font-black text-white tracking-tight uppercase italic">
                       {isFetching ? "Crawling GitHub API" : "Deconstructing Project"}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-primary font-mono text-[10px] tracking-[0.3em] font-black">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                       <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                       <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                       <span className="ml-2 uppercase">{isFetching ? "Building Manifest" : "Real-time Synthesis"}</span>
                    </div>
                    <p className="text-text-sub text-sm leading-relaxed opacity-60">
                       {isFetching 
                          ? "Zara is fetching the live file tree from GitHub's servers..." 
                          : "Manifest generated. Zara is now mapping components, logic flows, and architecture patterns."}
                    </p>
                 </div>
              </div>
           ) : null}

           {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 animate-fade-in">
                 <AlertCircle className="w-5 h-5 flex-shrink-0" />
                 <p className="text-sm font-bold">Live Fetch Failed: {error}. Zara will attempt a general analysis.</p>
              </div>
           )}

           {result ? (
              <div className="markdown-body prose prose-invert max-w-none animate-fade-in">
                 <ReactMarkdown 
                    components={{
                       code: MarkdownCodeBlock
                    }}
                 >
                    {result}
                 </ReactMarkdown>
              </div>
           ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-sub/20 gap-12">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl">
                    {[
                       { icon: Layers, label: 'FILE TREE', desc: 'Real-time manifest' },
                       { icon: FileText, label: 'TECH STACK', desc: 'Pattern detection' },
                       { icon: Database, label: 'DATA MODEL', desc: 'Structure analysis' },
                       { icon: Workflow, label: 'LOGIC FLOW', desc: 'Functional mapping' }
                    ].map((item, i) => (
                       <div key={i} className="p-8 bg-surfaceHighlight/30 border border-white/5 rounded-[2rem] flex flex-col items-center group hover:bg-white/5 transition-all cursor-default">
                          <item.icon className="w-12 h-12 mb-4 opacity-20 group-hover:opacity-100 group-hover:text-primary transition-all duration-500 transform group-hover:scale-110" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center mb-1">{item.label}</span>
                          <span className="text-[9px] font-bold opacity-0 group-hover:opacity-40 transition-opacity uppercase text-center">{item.desc}</span>
                       </div>
                    ))}
                 </div>
                 <div className="text-center max-w-sm px-6">
                    <p className="text-base font-bold text-text-sub tracking-wide">Enter a public repository URL to begin architectural deconstruction.</p>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] mt-3 opacity-30 text-primary">universal github decompiler v3.0</p>
                 </div>
              </div>
           )}
        </div>

      </div>
    </div>
  );
};
