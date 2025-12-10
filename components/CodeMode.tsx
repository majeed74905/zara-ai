
import React, { useState } from 'react';
import { Code2, Bug, Zap, Book, Loader2, Play } from 'lucide-react';
import { generateCodeAssist } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

export const CodeMode: React.FC = () => {
  const [inputCode, setInputCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activeTask, setActiveTask] = useState<'debug' | 'explain' | 'optimize' | 'generate'>('debug');

  const handleRun = async () => {
    if (!inputCode) return;
    setLoading(true);
    try {
      const content = await generateCodeAssist(inputCode, activeTask, language);
      setResult(content);
    } catch (e) {
      setResult("Error processing code.");
    }
    setLoading(false);
  };

  const tasks = [
    { id: 'debug', label: 'Debug', icon: Bug },
    { id: 'explain', label: 'Explain', icon: Book },
    { id: 'optimize', label: 'Optimize', icon: Zap },
    { id: 'generate', label: 'Generate', icon: Code2 },
  ];

  return (
    <div className="h-full flex flex-col p-4 md:p-8 animate-fade-in max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Code Architect
          </h2>
          <p className="text-text-sub">Debug, optimize, and generate code in any language.</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="sql">SQL</option>
            <option value="bash">Bash</option>
            <option value="react">React</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-4 rounded-xl flex-1 flex flex-col min-h-[400px]">
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setActiveTask(task.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTask === task.id 
                      ? 'bg-primary text-white' 
                      : 'bg-surfaceHighlight text-text-sub hover:bg-surfaceHighlight/80'
                  }`}
                >
                  <task.icon className="w-3.5 h-3.5" />
                  {task.label}
                </button>
              ))}
            </div>
            
            <textarea
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder={activeTask === 'generate' ? "Describe the code you want to generate..." : "Paste your code here..."}
              className="flex-1 bg-background rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-text border border-border"
            />
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleRun}
                disabled={loading || !inputCode}
                className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-2 rounded-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                Execute
              </button>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl overflow-y-auto min-h-[400px] markdown-body">
          {result ? (
            <ReactMarkdown>{result}</ReactMarkdown>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-sub/30">
              <Code2 className="w-16 h-16 mb-4" />
              <p>Output will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
