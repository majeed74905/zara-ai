
import React, { useState } from 'react';
import { Github, Search, BookOpen, Code, Loader2, GitBranch, FileText, Database, Layers } from 'lucide-react';
import { analyzeGithubRepo } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

export const GithubMode: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'overview' | 'implementation'>('overview');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!repoUrl) return;
    setIsLoading(true);
    setResult('');
    try {
      const content = await analyzeGithubRepo(repoUrl, analysisMode);
      setResult(content);
    } catch (e: any) {
      setResult(`Analysis Failed: ${e.message}`);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-200 via-white to-gray-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
          <Github className="w-8 h-8 text-white" />
          GitHub Analyzer
        </h2>
        <p className="text-text-sub">Reverse engineer and understand any repository instantly.</p>
      </div>

      <div className="flex flex-col gap-6 h-full min-h-0">
        
        {/* Search Bar & Controls */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-end md:items-center">
           <div className="flex-1 w-full">
              <label className="text-xs font-bold text-text-sub uppercase mb-1.5 block">Repository URL</label>
              <div className="relative">
                 <Search className="absolute left-3 top-3 w-4 h-4 text-text-sub" />
                 <input 
                   value={repoUrl}
                   onChange={(e) => setRepoUrl(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder="https://github.com/username/repo"
                   className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-white/50 focus:outline-none transition-all font-mono"
                 />
              </div>
           </div>
           
           <div className="flex bg-surfaceHighlight p-1 rounded-xl w-full md:w-auto">
              <button 
                onClick={() => setAnalysisMode('overview')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${analysisMode === 'overview' ? 'bg-background shadow text-white' : 'text-text-sub hover:text-text'}`}
              >
                 <BookOpen className="w-4 h-4" /> Overview
              </button>
              <button 
                onClick={() => setAnalysisMode('implementation')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${analysisMode === 'implementation' ? 'bg-background shadow text-white' : 'text-text-sub hover:text-text'}`}
              >
                 <Code className="w-4 h-4" /> Code Guide
              </button>
           </div>

           <button 
             onClick={handleAnalyze}
             disabled={isLoading || !repoUrl}
             className="w-full md:w-auto bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-white/10"
           >
             {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
             Analyze
           </button>
        </div>

        {/* Output Area */}
        <div className="flex-1 glass-panel rounded-2xl p-6 md:p-8 overflow-y-auto min-h-[400px] border-t-4 border-t-gray-500 relative">
           {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm rounded-2xl z-10">
                 <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                 <p className="text-text font-medium animate-pulse">Cloning context...</p>
                 <p className="text-xs text-text-sub mt-2">Reading documentation and structure</p>
              </div>
           ) : null}

           {result ? (
              <div className="markdown-body prose prose-invert max-w-none">
                 <ReactMarkdown>{result}</ReactMarkdown>
              </div>
           ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-sub/30 gap-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-surfaceHighlight rounded-xl flex flex-col items-center">
                       <Layers className="w-8 h-8 mb-2 opacity-50" />
                       <span className="text-xs font-bold">Architecture</span>
                    </div>
                    <div className="p-4 bg-surfaceHighlight rounded-xl flex flex-col items-center">
                       <FileText className="w-8 h-8 mb-2 opacity-50" />
                       <span className="text-xs font-bold">Tech Stack</span>
                    </div>
                    <div className="p-4 bg-surfaceHighlight rounded-xl flex flex-col items-center">
                       <Database className="w-8 h-8 mb-2 opacity-50" />
                       <span className="text-xs font-bold">Data Models</span>
                    </div>
                    <div className="p-4 bg-surfaceHighlight rounded-xl flex flex-col items-center">
                       <Code className="w-8 h-8 mb-2 opacity-50" />
                       <span className="text-xs font-bold">Snippets</span>
                    </div>
                 </div>
                 <p className="text-sm font-medium">Enter a GitHub URL to decompose the repository.</p>
              </div>
           )}
        </div>

      </div>
    </div>
  );
};
