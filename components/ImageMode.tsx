
import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Download, Loader2, Upload, Crown, Eraser, Users, ArrowRight } from 'lucide-react';
import { generateImageContent } from '../services/gemini';
import { fileToBase64, validateFile } from '../utils/fileUtils';

const FAMOUS_FIGURES = [
  { 
    name: 'Dr. APJ Abdul Kalam', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/A._P._J._Abdul_Kalam_in_2008.jpg/800px-A._P._J._Abdul_Kalam_in_2008.jpg',
    role: 'Scientist & President'
  },
  { 
    name: 'Albert Einstein', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/800px-Albert_Einstein_Head.jpg',
    role: 'Theoretical Physicist'
  },
  { 
    name: 'Mahatma Gandhi', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Mahatma-Gandhi-profile.jpg/800px-Mahatma-Gandhi-profile.jpg',
    role: 'Leader'
  },
  { 
    name: 'Nikola Tesla', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/N.Tesla.jpg/800px-N.Tesla.jpg',
    role: 'Inventor'
  },
  { 
    name: 'Marie Curie', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Marie_Curie_c1920.jpg/800px-Marie_Curie_c1920.jpg',
    role: 'Physicist & Chemist'
  },
  { 
    name: 'Isaac Newton', 
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Portrait_of_Sir_Isaac_Newton%2C_1689.jpg/800px-Portrait_of_Sir_Isaac_Newton%2C_1689.jpg',
    role: 'Mathematician'
  },
  {
    name: 'Subhas Chandra Bose',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Subhas_Chandra_Bose_NRB.jpg/800px-Subhas_Chandra_Bose_NRB.jpg',
    role: 'Freedom Fighter'
  },
  {
    name: 'Rabindranath Tagore',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Rabindranath_Tagore_unknown_photographer.jpg/800px-Rabindranath_Tagore_unknown_photographer.jpg',
    role: 'Poet & Philosopher'
  }
];

export const ImageMode: React.FC = () => {
  // Tabs: 'generate' (Pro/Flash Text-to-Image) | 'edit' (Flash Image-to-Image)
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  
  // Common State
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false); // specifically for fetching presets
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState('');

  // Generation Config (Pro)
  const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // Edit Config
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setGeneratedImage(null);
    setTextResponse('');
    
    try {
      let options: any = {
        aspectRatio: aspectRatio,
      };

      if (activeTab === 'generate') {
         if (modelType === 'pro') {
            options.model = 'gemini-3-pro-image-preview';
            options.imageSize = imageSize;
         } else {
            options.model = 'gemini-2.5-flash-image';
         }
      } else {
         // Edit Mode always uses Flash (currently best for instruction based editing)
         options.model = 'gemini-2.5-flash-image';
         if (editImageFile) {
            const base64 = await fileToBase64(editImageFile);
            options.referenceImage = {
               base64,
               mimeType: editImageFile.type
            };
         }
      }

      const result = await generateImageContent(prompt, options);
      if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
      }
      if (result.text) {
        setTextResponse(result.text);
      }
    } catch (e: any) {
      setTextResponse(`Failed: ${e.message}`);
    }
    setLoading(false);
  };

  const handleSelectPreset = async (url: string, name: string) => {
    try {
      setImageLoading(true);
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `${name.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' });
      setEditImageFile(file);
      setActiveTab('edit');
      // Scroll to top or specific edit area could be added here
    } catch (e) {
      console.error("Failed to load preset", e);
      alert("Could not load image. Please try again or upload manually.");
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto p-4 md:p-8 animate-fade-in overflow-y-auto">
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold bg-gradient-to-br from-white via-primary to-accent bg-clip-text text-transparent mb-4">
          Image Studio
        </h2>
        <p className="text-text-sub max-w-lg mx-auto">Create and Edit stunning visuals with Nano Banana.</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
            activeTab === 'generate' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surfaceHighlight text-text-sub hover:bg-surface'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Generate
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
            activeTab === 'edit' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surfaceHighlight text-text-sub hover:bg-surface'
          }`}
        >
          <Eraser className="w-4 h-4" />
          Edit Image
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Controls Column */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-3xl space-y-6">
             
             {/* Configuration */}
             {activeTab === 'generate' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-text-sub mb-2 block">Model</label>
                    <div className="flex gap-2 p-1 bg-surfaceHighlight rounded-xl">
                      <button 
                        onClick={() => setModelType('flash')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${modelType === 'flash' ? 'bg-surface shadow-sm text-text' : 'text-text-sub'}`}
                      >
                        Flash (Fast)
                      </button>
                      <button 
                         onClick={() => setModelType('pro')}
                         className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${modelType === 'pro' ? 'bg-surface shadow-sm text-text' : 'text-text-sub'}`}
                      >
                         Pro (HD) <Crown className="w-3 h-3 text-yellow-500" />
                      </button>
                    </div>
                  </div>

                  {modelType === 'pro' && (
                    <div>
                      <label className="text-sm font-medium text-text-sub mb-2 block">Size</label>
                      <div className="flex gap-2">
                        {['1K', '2K', '4K'].map(size => (
                           <button
                             key={size}
                             onClick={() => setImageSize(size)}
                             className={`flex-1 py-2 rounded-lg text-xs font-bold border ${imageSize === size ? 'border-primary text-primary bg-primary/10' : 'border-border text-text-sub'}`}
                           >
                             {size}
                           </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                     <label className="text-sm font-medium text-text-sub mb-2 block">Aspect Ratio</label>
                     <select 
                       value={aspectRatio}
                       onChange={(e) => setAspectRatio(e.target.value)}
                       className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                     >
                       <option value="1:1">1:1 Square</option>
                       <option value="16:9">16:9 Landscape</option>
                       <option value="9:16">9:16 Portrait</option>
                       <option value="3:4">3:4 Portrait</option>
                       <option value="4:3">4:3 Landscape</option>
                     </select>
                  </div>
                </div>
             ) : (
                <div className="space-y-4">
                   <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors relative bg-background/50 group">
                      {imageLoading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-xl">
                           <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}
                      
                      {editImageFile ? (
                         <div className="relative z-0">
                            <img 
                              src={URL.createObjectURL(editImageFile)} 
                              alt="Reference" 
                              className="w-24 h-24 object-cover rounded-lg mx-auto mb-3 shadow-md" 
                            />
                            <p className="text-xs text-text font-bold truncate px-2">{editImageFile.name}</p>
                            <p className="text-[10px] text-green-500 mt-1">Ready to edit</p>
                            <button 
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditImageFile(null); }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                            >
                               <Eraser className="w-3 h-3" />
                            </button>
                         </div>
                      ) : (
                         <>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <Upload className="w-8 h-8 mx-auto text-text-sub mb-2 group-hover:text-primary transition-colors" />
                            <p className="text-xs text-text-sub truncate px-2">
                              Upload image to edit
                            </p>
                         </>
                      )}
                   </div>
                   
                   {!editImageFile && (
                      <div className="text-xs text-text-sub text-center">
                        <span className="opacity-50">OR</span>
                        <p className="mt-2">Select from the <strong>Famous Figures</strong> gallery below.</p>
                      </div>
                   )}
                </div>
             )}

             <div className="h-px bg-border" />
             
             {/* Prompt & Action */}
             <div>
                <label className="text-sm font-medium text-text-sub mb-2 block">Prompt</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeTab === 'generate' ? "A futuristic city in neon lights..." : "e.g., 'Add a retro filter' or 'Remove the person in the background'"}
                  className="w-full bg-background border border-border rounded-xl p-4 h-32 resize-none text-text focus:outline-none focus:border-primary mb-4"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt || (activeTab === 'edit' && !editImageFile)}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {activeTab === 'generate' ? 'Generate' : 'Edit Image'}
                </button>
             </div>

          </div>
        </div>

        <div className="flex-1 flex flex-col gap-6">
           {/* Result Area */}
           <div className="flex-1 glass-panel rounded-3xl p-4 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-white/5 relative overflow-hidden bg-black/20">
               {loading ? (
                 <div className="flex flex-col items-center gap-4 z-10">
                   <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                   <p className="text-primary font-medium animate-pulse">Processing...</p>
                 </div>
               ) : generatedImage ? (
                 <div className="relative group w-full h-full flex items-center justify-center">
                   <img src={generatedImage} alt="Generated" className="max-h-[600px] w-auto rounded-xl shadow-2xl object-contain" />
                   <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                       <a 
                         href={generatedImage} 
                         download={`zara-gen-${Date.now()}.png`}
                         className="bg-black/50 backdrop-blur text-white p-3 rounded-xl hover:bg-black/70 flex items-center gap-2"
                       >
                         <Download className="w-5 h-5" />
                         Save
                       </a>
                   </div>
                 </div>
               ) : (
                 <div className="text-center text-text-sub/20">
                   <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-50" />
                   <p className="text-xl font-medium">Your canvas is empty</p>
                   {textResponse && <p className="text-sm mt-4 text-red-400 max-w-sm mx-auto">{textResponse}</p>}
                 </div>
               )}
               
               {/* Background ambient glow */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
           </div>

           {/* Famous Figures Gallery */}
           <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-primary" /> Famous Figures
                 <span className="text-xs font-normal text-text-sub ml-2 bg-surfaceHighlight px-2 py-0.5 rounded-full">Click to Use</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                 {FAMOUS_FIGURES.map((person) => (
                    <button 
                      key={person.name}
                      onClick={() => handleSelectPreset(person.url, person.name)}
                      className="group relative rounded-xl overflow-hidden aspect-square border border-border hover:border-primary/50 transition-all text-left"
                    >
                       <img src={person.url} alt={person.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col justify-end">
                          <p className="text-white font-bold text-xs leading-tight">{person.name}</p>
                          <p className="text-[10px] text-white/70 truncate">{person.role}</p>
                       </div>
                       <div className="absolute top-2 right-2 bg-primary/90 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                          <ArrowRight className="w-3 h-3" />
                       </div>
                    </button>
                 ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
