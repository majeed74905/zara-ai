
import React, { useState } from 'react';
import { BookOpen, HelpCircle, FileText, CheckCircle, Loader2, Upload, File, Trash2 } from 'lucide-react';
import { generateStudentContent } from '../services/gemini';
import { useStudyMaterial } from '../hooks/useStudyMaterial';
import ReactMarkdown from 'react-markdown';

export const StudentMode: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'mcq' | '5mark' | '20mark' | 'simple'>('summary');
  
  const [mcqCount, setMcqCount] = useState(5);
  const [mcqDifficulty, setMcqDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  const { studyMaterial, updateMaterial, loadFromFile, clearMaterial } = useStudyMaterial();
  const [showMaterialInput, setShowMaterialInput] = useState(false);

  const handleGenerate = async () => {
    if (!topic && !studyMaterial) return;
    setLoading(true);
    try {
      const config = {
        topic: topic || "Uploaded Content",
        mode: activeTab,
        mcqConfig: {
          count: mcqCount,
          difficulty: mcqDifficulty
        },
        studyMaterial: studyMaterial
      };
      
      const content = await generateStudentContent(config);
      setResult(content);
    } catch (e) {
      setResult("Error generating content. Please try again.");
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      loadFromFile(e.target.files[0]).catch(err => alert(err.message));
    }
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'simple', label: 'Explain Simple', icon: HelpCircle },
    { id: 'mcq', label: 'MCQs', icon: CheckCircle },
    { id: '5mark', label: 'Short Q&A', icon: BookOpen },
    { id: '20mark', label: 'Essay', icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
          Student Companion
        </h2>
        <p className="text-text-sub">Generate study materials, notes, and quizzes instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="glass-panel p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-text">Study Material</label>
              {studyMaterial && (
                <button onClick={clearMaterial} className="text-red-400 hover:bg-red-500/10 p-1 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {studyMaterial ? (
               <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded-xl text-xs flex items-center gap-2 mb-2">
                 <File className="w-4 h-4" />
                 Material Loaded ({studyMaterial.length} chars)
               </div>
            ) : (
               <p className="text-xs text-text-sub mb-3">Upload notes to generate questions based on specific content.</p>
            )}

            <div className="flex gap-2">
               <button 
                 onClick={() => setShowMaterialInput(!showMaterialInput)}
                 className="flex-1 bg-surfaceHighlight border border-border text-text text-xs py-2 rounded-lg hover:bg-surface"
               >
                 {showMaterialInput ? 'Hide Text Input' : 'Paste Text'}
               </button>
               <div className="relative flex-1">
                 <input 
                   type="file" 
                   accept=".txt,.md" 
                   onChange={handleFileUpload} 
                   className="absolute inset-0 opacity-0 cursor-pointer"
                 />
                 <button className="w-full bg-surfaceHighlight border border-border text-text text-xs py-2 rounded-lg hover:bg-surface flex justify-center items-center gap-2">
                    <Upload className="w-3 h-3" /> Upload .txt
                 </button>
               </div>
            </div>

            {showMaterialInput && (
              <textarea 
                value={studyMaterial}
                onChange={(e) => updateMaterial(e.target.value)}
                placeholder="Paste your notes here..."
                className="w-full mt-3 bg-background border border-border rounded-lg p-2 text-xs h-32 resize-none focus:border-primary focus:outline-none"
              />
            )}
          </div>

          <div className="glass-panel p-4 rounded-2xl">
             <label className="text-sm font-bold text-text mb-2 block">Topic / Subject</label>
             <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={studyMaterial ? "Optional (using uploaded notes)" : "e.g. Quantum Physics"}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="glass-panel p-4 rounded-2xl space-y-4">
             <div className="flex flex-wrap gap-2">
               {tabs.map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-grow justify-center ${
                     activeTab === tab.id 
                       ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                       : 'bg-surfaceHighlight text-text-sub hover:bg-surface border border-transparent'
                   }`}
                 >
                   <tab.icon className="w-3.5 h-3.5" />
                   {tab.label}
                 </button>
               ))}
             </div>

             {activeTab === 'mcq' && (
               <div className="bg-surfaceHighlight/50 p-3 rounded-xl border border-border space-y-3 animate-fade-in">
                  <div>
                    <label className="text-xs font-medium text-text-sub block mb-1">Number of Questions</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={20}
                      value={mcqCount}
                      onChange={(e) => setMcqCount(parseInt(e.target.value))}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-sub block mb-1">Difficulty</label>
                    <div className="flex gap-1">
                      {['Easy', 'Medium', 'Hard'].map(d => (
                         <button
                           key={d}
                           onClick={() => setMcqDifficulty(d as any)}
                           className={`flex-1 text-xs py-1.5 rounded-md border ${
                             mcqDifficulty === d 
                               ? 'bg-primary/20 border-primary text-primary' 
                               : 'bg-background border-border text-text-sub'
                           }`}
                         >
                           {d}
                         </button>
                      ))}
                    </div>
                  </div>
               </div>
             )}

             <button
              onClick={handleGenerate}
              disabled={loading || (!topic && !studyMaterial)}
              className="w-full bg-gradient-to-r from-primary to-accent text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Content
            </button>
          </div>

        </div>

        <div className="lg:col-span-2">
           <div className="glass-panel rounded-2xl p-6 md:p-8 h-full min-h-[500px] overflow-y-auto markdown-body relative">
              {result ? (
                 <ReactMarkdown>{result}</ReactMarkdown>
              ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-text-sub/30">
                    <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Ready to study</p>
                    <p className="text-sm max-w-xs text-center mt-2">Upload notes or enter a topic to generate custom study material.</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
