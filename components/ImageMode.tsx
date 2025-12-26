
import React, { useState, useCallback, useMemo } from 'react';
import { Image as ImageIcon, Sparkles, Download, Loader2, Upload, Crown, Eraser, Users, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { generateImageContent } from '../services/gemini';
import { fileToBase64 } from '../utils/fileUtils';

const FAMOUS_FIGURES = [
  { name: 'Dr. APJ Abdul Kalam', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/A._P._J._Abdul_Kalam_in_2008.jpg/800px-A._P._J._Abdul_Kalam_in_2008.jpg', role: 'Scientist' },
  { name: 'Albert Einstein', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/800px-Albert_Einstein_Head.jpg', role: 'Physicist' },
  { name: 'Mahatma Gandhi', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Mahatma-Gandhi-profile.jpg/800px-Mahatma-Gandhi-profile.jpg', role: 'Leader' },
  { name: 'Nikola Tesla', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/N.Tesla.jpg/800px-N.Tesla.jpg', role: 'Inventor' },
];

export const ImageMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [faceLock, setFaceLock] = useState(true);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setGeneratedImage(null);
    setTextResponse('');
    
    try {
      let options: any = { aspectRatio };
      if (activeTab === 'generate') {
        options.model = modelType === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      } else {
        options.model = 'gemini-2.5-flash-image';
        if (editImageFile) {
          options.referenceImage = {
            base64: await fileToBase64(editImageFile),
            mimeType: editImageFile.type
          };
          options.preserveIdentity = faceLock; // Internal flag for prompt logic
        }
      }

      const result = await generateImageContent(prompt, options);
      if (result.imageUrl) setGeneratedImage(result.imageUrl);
      if (result.text) setTextResponse(result.text);
    } catch (e: any) {
      setTextResponse(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = useCallback(async (url: string, name: string) => {
    try {
      setImageLoading(true);
      const res = await fetch(url);
      const blob = await res.blob();
      setEditImageFile(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
      setActiveTab('edit');
    } catch (e) {
      alert("Failed to load preset.");
    } finally {
      setImageLoading(false);
    }
  }, []);

  const Gallery = useMemo(() => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {FAMOUS_FIGURES.map((p) => (
        <button key={p.name} onClick={() => handleSelectPreset(p.url, p.name)} className="group relative rounded-xl overflow-hidden aspect-square border border-border hover:border-primary/50 transition-all">
          <img src={p.url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col justify-end">
            <p className="text-white font-bold text-xs">{p.name}</p>
            <p className="text-[9px] text-white/70">{p.role}</p>
          </div>
        </button>
      ))}
    </div>
  ), [handleSelectPreset]);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto p-4 md:p-8 animate-fade-in overflow-y-auto custom-scrollbar">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-black bg-gradient-to-br from-white to-primary bg-clip-text text-transparent mb-2 italic tracking-tighter">IMAGE STUDIO</h2>
        <p className="text-text-sub text-sm">Ultra-fast visual generation and identity-preserving edits.</p>
      </div>

      <div className="flex justify-center gap-2 mb-8 bg-surfaceHighlight p-1 rounded-full w-fit mx-auto border border-border">
        <button onClick={() => setActiveTab('generate')} className={`px-6 py-2 rounded-full text-xs font-black tracking-widest transition-all ${activeTab === 'generate' ? 'bg-primary text-white shadow-lg' : 'text-text-sub hover:text-text'}`}>GENERATE</button>
        <button onClick={() => setActiveTab('edit')} className={`px-6 py-2 rounded-full text-xs font-black tracking-widest transition-all ${activeTab === 'edit' ? 'bg-primary text-white shadow-lg' : 'text-text-sub hover:text-text'}`}>EDIT IMAGE</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 space-y-6">
          <div className="glass-panel p-6 rounded-[2rem] border-white/5 space-y-6">
            {activeTab === 'edit' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/50 transition-all relative bg-black/20 group overflow-hidden">
                  {editImageFile ? (
                    <div className="relative animate-fade-in">
                      <img src={URL.createObjectURL(editImageFile)} alt="Reference" className="w-32 h-32 object-cover rounded-xl mx-auto mb-2 shadow-2xl border border-white/10" />
                      <p className="text-[10px] font-black text-primary uppercase">{editImageFile.name}</p>
                      <button onClick={() => setEditImageFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"><Eraser className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <>
                      <input type="file" accept="image/*" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <Upload className="w-10 h-10 mx-auto text-text-sub mb-2 group-hover:text-primary transition-colors" />
                      <p className="text-xs font-bold text-text-sub">Drop reference photo</p>
                    </>
                  )}
                </div>
                {editImageFile && (
                  <button onClick={() => setFaceLock(!faceLock)} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${faceLock ? 'bg-primary/10 border-primary text-primary' : 'bg-surfaceHighlight border-border text-text-sub'}`}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-tighter">Face Lock Active</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative ${faceLock ? 'bg-primary' : 'bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-all ${faceLock ? 'translate-x-4' : ''}`} />
                    </div>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-sub uppercase tracking-widest px-1">Describe changes</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={activeTab === 'edit' ? "e.g. 'Make a couple photo with a sunset background'" : "A futuristic robot in a forest..."} className="w-full bg-black/40 border border-border rounded-2xl p-4 h-32 resize-none text-sm focus:border-primary outline-none transition-all shadow-inner" />
            </div>

            <button onClick={handleGenerate} disabled={loading || !prompt || (activeTab === 'edit' && !editImageFile)} className="w-full bg-gradient-to-r from-primary to-accent text-white py-4 rounded-2xl font-black text-sm tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
              PROCESS
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="glass-panel rounded-[3rem] p-4 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-white/5 relative overflow-hidden bg-black/40 shadow-2xl">
            {loading ? (
              <div className="flex flex-col items-center gap-4 z-10 animate-pulse">
                <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-primary font-black text-xs tracking-[0.3em]">SYNTHESIZING...</p>
              </div>
            ) : generatedImage ? (
              <div className="relative group w-full h-full flex items-center justify-center animate-fade-in">
                <img src={generatedImage} alt="Generated" className="max-h-[600px] w-auto rounded-[2rem] shadow-2xl object-contain border border-white/10" />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <a href={generatedImage} download="zara_design.png" className="bg-black/60 backdrop-blur-xl text-white p-3 rounded-2xl hover:bg-primary transition-all flex items-center gap-2 border border-white/10">
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-10 space-y-4">
                <ImageIcon className="w-32 h-32 mx-auto" />
                <p className="text-2xl font-black italic tracking-tighter uppercase">Canvas Ready</p>
              </div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          </div>
          <div className="glass-panel p-8 rounded-[2.5rem] border-white/5">
            <h3 className="font-black text-xs uppercase tracking-[0.3em] mb-6 flex items-center gap-2 text-text-sub">
              <Users className="w-4 h-4 text-primary" /> Inspiration Gallery
            </h3>
            {Gallery}
          </div>
        </div>
      </div>
    </div>
  );
};
