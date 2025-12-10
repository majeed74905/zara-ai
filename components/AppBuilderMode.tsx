
import React, { useState, useRef, useEffect } from 'react';
import { Code, Play, Smartphone, Monitor, Globe, Download, Terminal, Activity, Save, FolderOpen, Plus, Trash2, ArrowLeft, FileCode, FileJson, FileType, RefreshCw, Layout, Cpu, X, Check } from 'lucide-react';
import { sendAppBuilderStream } from '../services/gemini';
import { Message, Role, Attachment, GeneratedFile } from '../types';
import { InputArea } from './InputArea';

declare const JSZip: any; // Available via CDN in index.html

// --- TYPES ---
interface SavedProject {
  id: string;
  name: string;
  files: GeneratedFile[];
  createdAt: number;
  updatedAt: number;
}

// --- STYLED COMPONENTS ---

const FileIcon = ({ name }: { name: string }) => {
  if (name.endsWith('.html')) return <Code className="w-4 h-4 text-orange-500" />;
  if (name.endsWith('.css')) return <FileType className="w-4 h-4 text-blue-400" />;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return <FileCode className="w-4 h-4 text-yellow-400" />;
  if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-green-400" />;
  return <FileCode className="w-4 h-4 text-gray-400" />;
};

const IdeHeader = ({ title, onDeploy, onDownload, onSave, onBack, isSaving, device, setDevice, onRefresh }: any) => (
  <div className="h-14 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-4 select-none flex-shrink-0">
     <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-[#27272a] rounded-lg text-gray-400 hover:text-white transition-colors" title="Back to Projects">
           <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <Cpu className="w-5 h-5" />
           </div>
           <div>
              <h3 className="font-bold text-gray-100 text-sm truncate max-w-[200px]">{title || "Untitled Project"}</h3>
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                 Zara Architect <span className="w-1 h-1 bg-gray-600 rounded-full"/> v3.0
              </p>
           </div>
        </div>
     </div>

     <div className="flex items-center gap-4">
        <div className="flex bg-[#27272a] p-1 rounded-lg border border-[#3f3f46]">
           <button 
             onClick={() => setDevice('desktop')}
             className={`p-1.5 rounded-md transition-all ${device === 'desktop' ? 'bg-[#3f3f46] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
             title="Desktop View"
           >
              <Monitor className="w-4 h-4" />
           </button>
           <button 
             onClick={() => setDevice('mobile')}
             className={`p-1.5 rounded-md transition-all ${device === 'mobile' ? 'bg-[#3f3f46] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
             title="Mobile View"
           >
              <Smartphone className="w-4 h-4" />
           </button>
        </div>

        <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors" title="Reload Preview">
           <RefreshCw className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-[#27272a]" />

        <button onClick={onSave} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#27272a] rounded-md transition-colors">
           <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onDownload} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#27272a] rounded-md transition-colors border border-transparent hover:border-[#3f3f46]">
           <Download className="w-3.5 h-3.5" /> Export ZIP
        </button>
        <button onClick={onDeploy} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-lg shadow-green-900/20">
           <Globe className="w-3.5 h-3.5" /> Deploy
        </button>
     </div>
  </div>
);

const ConsolePanel = ({ logs }: { logs: string[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-32 bg-[#09090b] border-t border-[#27272a] flex flex-col font-mono text-xs flex-shrink-0">
       <div className="flex items-center px-4 py-1 bg-[#18181b] border-b border-[#27272a] gap-4 text-gray-400 select-none">
          <span className="flex items-center gap-1 hover:text-white cursor-pointer"><Terminal className="w-3 h-3" /> Terminal</span>
          <span className="flex items-center gap-1 hover:text-white cursor-pointer"><Activity className="w-3 h-3" /> Output</span>
       </div>
       <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 text-gray-300">
          {logs.length === 0 && <span className="text-gray-600 italic pl-2">Console ready...</span>}
          {logs.map((log, i) => (
             <div key={i} className="flex gap-2 font-mono border-b border-white/5 py-0.5">
                <span className="text-gray-600 select-none min-w-[60px]">{new Date().toLocaleTimeString().split(' ')[0]}</span>
                <span className={`break-all ${log.includes('Error') ? 'text-red-400' : log.includes('Success') ? 'text-green-400' : 'text-gray-300'}`}>
                   {log}
                </span>
             </div>
          ))}
       </div>
    </div>
  );
};

export const AppBuilderMode: React.FC = () => {
  const [view, setView] = useState<'projects' | 'ide'>('projects');
  
  // IDE State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<GeneratedFile | null>(null);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [iframeKey, setIframeKey] = useState(0); // To force refresh iframe
  
  // Deployment Modal
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  // Listen for messages from Iframe
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'ERROR') {
            setConsoleLogs(prev => [...prev, `> Runtime Error: ${event.data.log}`]);
        }
        if (event.data && event.data.type === 'LOG') {
            setConsoleLogs(prev => [...prev, `> App: ${event.data.log}`]);
        }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  // Persistence
  useEffect(() => {
    const stored = localStorage.getItem('zara_app_projects');
    if (stored) {
      try { setProjects(JSON.parse(stored)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveProjectsToStorage = (updated: SavedProject[]) => {
    setProjects(updated);
    localStorage.setItem('zara_app_projects', JSON.stringify(updated));
  };

  const createProject = () => {
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      name: `New App ${projects.length + 1}`,
      files: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const updated = [newProject, ...projects];
    saveProjectsToStorage(updated);
    openProject(newProject.id);
  };

  const openProject = (id: string) => {
    setActiveProjectId(id);
    const proj = projects.find(p => p.id === id);
    if (proj && proj.files.length > 0) {
      // Try to open index.html or script.js by default
      const defaultFile = proj.files.find(f => f.path === 'script.js') || proj.files.find(f => f.path === 'index.html') || proj.files[0];
      setActiveFile(defaultFile);
    } else {
      setActiveFile(null);
    }
    setMessages([]); 
    setView('ide');
    setConsoleLogs(['> Project loaded successfully.', '> Environment ready.']);
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    // CRITICAL: Stop event from bubbling to the parent div
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.preventDefault();

    if (window.confirm("Are you sure you want to permanently delete this project?")) {
      const updatedProjects = projects.filter(p => p.id !== id);
      setProjects(updatedProjects);
      localStorage.setItem('zara_app_projects', JSON.stringify(updatedProjects));
      
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
    }
  };

  // --- PREVIEW GENERATOR ---
  const getPreviewSource = () => {
    const proj = projects.find(p => p.id === activeProjectId);
    if (!proj) return '';

    const htmlFile = proj.files.find(f => f.path === 'index.html');
    const cssFile = proj.files.find(f => f.path === 'styles.css');
    const jsFile = proj.files.find(f => f.path === 'script.js');

    // Robust Boilerplate with Bootloader
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${proj.name}</title>
    <!-- 1. DEPENDENCIES - STRICT ORDER -->
    <script crossorigin src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Use unpkg for Lucide React UMD if available, otherwise vanilla lucide + mapper -->
    <script src="https://unpkg.com/lucide@latest"></script>
    
    <!-- 2. ERROR TRAPPING -->
    <script>
      window.onerror = function(msg, url, line) {
        window.parent.postMessage({type: 'ERROR', log: msg + ' (Line ' + line + ')'}, '*');
      };
      console.log = function(...args) {
        window.parent.postMessage({type: 'LOG', log: args.join(' ')}, '*');
      };
      console.error = function(...args) {
        window.parent.postMessage({type: 'ERROR', log: args.join(' ')}, '*');
      };
    </script>
`;

    // Inject User HTML Content (Body)
    if (htmlFile) {
        // Strip existing html/head/body tags to avoid nesting
        const content = htmlFile.content
            .replace(/<!DOCTYPE html>/gi, '')
            .replace(/<html[^>]*>/gi, '')
            .replace(/<\/html>/gi, '')
            .replace(/<head>[\s\S]*?<\/head>/gi, '')
            .replace(/<body[^>]*>/gi, '')
            .replace(/<\/body>/gi, '');
        
        html += `<style>\n${cssFile?.content || ''}\n</style>\n`;
        html += `</head>\n<body class="bg-gray-900 text-white h-screen overflow-hidden">\n`;
        html += content;
    } else {
        html += `</head>\n<body class="bg-gray-900 text-white h-screen overflow-hidden">\n<div id="root"></div>\n`;
    }

    // 3. BOOTLOADER & USER CODE
    // We wrap user code in a function and call it only when dependencies are ready.
    if (jsFile) {
        html += `
        <script>
          // Helper to map Lucide icons to React components
          function setupLucide() {
             if (window.lucide && window.React) {
                const { createElement } = window.React;
                // Vanilla Lucide exposes 'icons' object { Camera: {...}, ... }
                // We create a wrapper component for each
                const LucideIcons = {};
                
                Object.keys(window.lucide.icons).forEach(key => {
                   const iconData = window.lucide.icons[key];
                   LucideIcons[key] = (props) => {
                      // Render SVG using lucide's data (simplified for brevity, standard React SVG)
                      return createElement('svg', {
                         ...props,
                         width: props.size || 24,
                         height: props.size || 24,
                         fill: 'none',
                         stroke: 'currentColor',
                         strokeWidth: props.strokeWidth || 2,
                         strokeLinecap: 'round',
                         strokeLinejoin: 'round',
                         viewBox: '0 0 24 24',
                         dangerouslySetInnerHTML: { __html: iconData.toSvg ? iconData.toSvg(props) : '' } // Fallback
                      });
                   };
                });
                
                // Expose it back to window.lucide so user code 'const { Camera } = lucide' works
                // Note: We are overwriting the vanilla library object with our component map
                // But typically user code only destructures icons.
                // Better approach: Merge
                Object.assign(window.lucide, LucideIcons);
             }
          }

          function boot() {
             if (window.React && window.ReactDOM && window.Babel) {
                console.log("System Ready. Compiling User Code...");
                
                // If using vanilla lucide, setup the mapper. 
                // However, user code might expect "lucide-react" exports.
                // We will assume AI uses "const { Icon } = lucide;" pattern.
                setupLucide();

                try {
                   // Compile and Run
                   const userCode = \`${jsFile.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                   const compiled = Babel.transform(userCode, { presets: ['react', 'env'] }).code;
                   
                   // Execute
                   new Function(compiled)();
                   console.log("App Started.");
                } catch (err) {
                   console.error("Compilation/Runtime Error: " + err.message);
                }
             } else {
                setTimeout(boot, 50);
             }
          }
          
          // Start Bootloader
          boot();
        </script>
        `;
    }

    html += `</body></html>`;
    return html;
  };

  const refreshPreview = () => {
    setIframeKey(prev => prev + 1);
    setConsoleLogs(prev => [...prev, '> Preview refreshed.']);
  };

  // --- AI PARSER & STREAMING ---
  const updateActiveProjectFiles = (newFiles: GeneratedFile[]) => {
    if (!activeProjectId) return;
    
    setProjects(currentProjects => {
      const updatedProjects = currentProjects.map(p => {
        if (p.id === activeProjectId) {
          const mergedFiles = [...p.files];
          newFiles.forEach(nf => {
            const idx = mergedFiles.findIndex(of => of.path === nf.path);
            if (idx >= 0) mergedFiles[idx] = nf;
            else mergedFiles.push(nf);
          });
          return { ...p, files: mergedFiles, updatedAt: Date.now() };
        }
        return p;
      });
      
      localStorage.setItem('zara_app_projects', JSON.stringify(updatedProjects));
      return updatedProjects;
    });

    if (!activeFile && newFiles.length > 0) {
       setActiveFile(newFiles[0]);
    }
    if (activeFile) {
       const updatedActive = newFiles.find(f => f.path === activeFile.path);
       if (updatedActive) setActiveFile(updatedActive);
    }
  };

  const extractFiles = (text: string): GeneratedFile[] => {
    const files: GeneratedFile[] = [];
    // Enhanced regex to capture content strictly between tags
    const tagPattern = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      const path = match[1];
      let rawContent = match[2];
      
      // Clean up markdown code blocks if the model wrapped the code in ```javascript ... ```
      // This regex removes the first line if it starts with ``` and the last line if it is ```
      rawContent = rawContent.replace(/^\s*```[a-zA-Z0-9]*\n/, '').replace(/\n\s*```\s*$/, '');
      
      if (rawContent.startsWith('\n')) rawContent = rawContent.substring(1);

      files.push({
        name: path.split('/').pop() || path,
        path: path,
        content: rawContent,
        language: path.split('.').pop() || 'text'
      });
    }
    return files;
  };

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.role === Role.MODEL) {
      const parsedFiles = extractFiles(lastMsg.text);
      if (parsedFiles.length > 0) {
        updateActiveProjectFiles(parsedFiles);
        
        if (lastMsg.isStreaming) {
           const lastFile = parsedFiles[parsedFiles.length - 1];
           setConsoleLogs(prev => {
              const msg = `> Streaming ${lastFile.name}...`;
              if (prev[prev.length-1] === msg) return prev;
              return [...prev.slice(-3), msg];
           });
        } else if (!lastMsg.isStreaming && !lastMsg.isError) {
           setConsoleLogs(prev => [...prev, `> Build Complete. ${parsedFiles.length} files generated.`, '> Preview Hot Reloaded.']);
           setIframeKey(prev => prev + 1);
        }
      }
    }
  }, [messages]);

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (!text.trim() && attachments.length === 0) return;

    const newUserMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.USER,
      text: text,
      attachments: attachments,
      timestamp: Date.now(),
    };

    const msgsWithUser = [...messages, newUserMsg];
    setMessages(msgsWithUser);
    setIsLoading(true);
    setConsoleLogs(prev => [...prev, `> User Command: ${text}`]);

    const botMsgId = crypto.randomUUID();
    const initialBotMsg: Message = {
        id: botMsgId,
        role: Role.MODEL,
        text: '',
        timestamp: Date.now(),
        isStreaming: true
    };
    
    setMessages([...msgsWithUser, initialBotMsg]);

    try {
      await sendAppBuilderStream(
        msgsWithUser,
        text,
        attachments,
        (partialText) => {
           setMessages(prev => prev.map(m => 
              m.id === botMsgId ? { ...m, text: partialText } : m
           ));
        }
      );
      
      setMessages(prev => prev.map(m => 
        m.id === botMsgId ? { ...m, isStreaming: false } : m
      ));

    } catch (error: any) {
      setMessages(prev => prev.map(m => 
        m.id === botMsgId 
           ? { ...m, isStreaming: false, isError: true, text: m.text || error.message } 
           : m
      ));
      setConsoleLogs(prev => [...prev, `> Error: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipDownload = () => {
     const proj = projects.find(p => p.id === activeProjectId);
     if (!proj) return;
     
     if (typeof JSZip === 'undefined') {
        alert("System Error: JSZip library not loaded. Please refresh.");
        return;
     }

     const zip = new JSZip();
     proj.files.forEach(f => {
        zip.file(f.path, f.content);
     });

     zip.generateAsync({type:"blob"}).then((content: Blob) => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proj.name.replace(/\s+/g, '_')}_Source.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setConsoleLogs(prev => [...prev, '> Project exported to ZIP successfully.']);
     });
  };

  const handleDeploy = () => {
     const source = getPreviewSource();
     if (!source || source.length < 50) {
        setConsoleLogs(prev => [...prev, '> Error: Source code empty or invalid.']);
        return;
     }
     
     const blob = new Blob([source], { type: 'text/html' });
     const url = URL.createObjectURL(blob);
     setDeployedUrl(url);
     setShowDeployModal(true);
     setConsoleLogs(prev => [...prev, '> Deployment successful. URL generated.']);
  };

  // --- RENDER PROJECT LIST ---
  if (view === 'projects') {
     return (
        <div className="h-full bg-[#09090b] text-white p-8 animate-fade-in overflow-y-auto">
           <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                 <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent mb-2">Zara Architect</h1>
                    <p className="text-gray-400">Professional AI App Builder & IDE</p>
                 </div>
                 <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105">
                    <Plus className="w-5 h-5" /> Create Project
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {projects.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => openProject(p.id)} 
                        className="bg-[#18181b] border border-[#27272a] p-6 rounded-2xl cursor-pointer hover:border-blue-500/50 hover:bg-[#1e1e1e] hover:shadow-xl transition-all group relative overflow-hidden"
                    >
                       <div className="absolute top-0 right-0 p-20 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
                       
                       <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500 group-hover:scale-110 transition-transform border border-blue-500/20">
                          <Layout className="w-6 h-6" />
                       </div>
                       
                       <h3 className="text-lg font-bold mb-1 group-hover:text-blue-400 transition-colors">{p.name}</h3>
                       <p className="text-xs text-gray-500 mb-6">Last modified: {new Date(p.updatedAt).toLocaleDateString()}</p>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#27272a] px-2 py-1 rounded text-gray-400 border border-[#3f3f46] flex items-center gap-1">
                             <Code className="w-3 h-3" /> {p.files.length} Files
                          </span>
                       </div>

                       {/* Delete Button - Increased Z-index and Stop Propagation */}
                       <div
                         role="button"
                         tabIndex={0}
                         onClick={(e) => handleDeleteProject(e, p.id)}
                         className="absolute top-3 right-3 p-2 bg-[#18181b] hover:bg-red-900/20 text-gray-500 hover:text-red-500 rounded-lg border border-[#27272a] hover:border-red-500/50 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-50 cursor-pointer shadow-sm"
                         title="Delete Project"
                       >
                          <Trash2 className="w-4 h-4" />
                       </div>
                    </div>
                 ))}
                 
                 {projects.length === 0 && (
                    <div className="col-span-full py-24 text-center border-2 border-dashed border-[#27272a] rounded-2xl bg-[#121214]">
                       <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                       <h3 className="text-lg font-bold text-gray-500">No projects found</h3>
                       <p className="text-sm text-gray-600 mb-6">Start your first AI-generated application.</p>
                       <button onClick={createProject} className="text-blue-500 hover:underline text-sm font-medium">Create New Project</button>
                    </div>
                 )}
              </div>
           </div>
        </div>
     );
  }

  // --- RENDER IDE ---
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="h-full flex flex-col bg-[#09090b] text-white animate-fade-in overflow-hidden">
       <IdeHeader 
         title={activeProject?.name} 
         onDeploy={handleDeploy} 
         onDownload={handleZipDownload} 
         onSave={() => saveProjectsToStorage(projects)} 
         onBack={() => setView('projects')}
         isSaving={false}
         device={deviceMode}
         setDevice={setDeviceMode}
         onRefresh={refreshPreview}
       />

       <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: Sidebar & Chat */}
          <div className="w-[380px] flex flex-col border-r border-[#27272a] bg-[#18181b] flex-shrink-0">
             
             {/* File Explorer */}
             <div className="h-1/3 flex flex-col border-b border-[#27272a]">
                <div className="px-4 py-3 border-b border-[#27272a] bg-[#202023] flex justify-between items-center">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project Files</span>
                   <span className="text-[10px] bg-[#27272a] px-1.5 py-0.5 rounded text-gray-500">{activeProject?.files.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                   {activeProject?.files.map(f => (
                      <button 
                        key={f.path} 
                        onClick={() => setActiveFile(f)}
                        className={`w-full text-left px-4 py-2 text-xs flex items-center gap-3 transition-colors border-l-2 ${activeFile?.path === f.path ? 'bg-[#27272a] text-blue-400 border-blue-500' : 'text-gray-400 border-transparent hover:bg-[#27272a]'}`}
                      >
                         <FileIcon name={f.name} />
                         <span className="truncate">{f.name}</span>
                      </button>
                   ))}
                   {activeProject?.files.length === 0 && (
                      <div className="p-8 text-center text-gray-600 text-xs">
                         Waiting for generation...
                      </div>
                   )}
                </div>
             </div>

             {/* Chat Interface */}
             <div className="flex-1 flex flex-col min-h-0 bg-[#18181b]">
                <div className="px-4 py-2 border-b border-[#27272a] bg-[#202023] text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <Play className="w-3 h-3 text-green-500" /> AI Instructions
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[90%] rounded-lg p-3 text-xs ${msg.role === Role.USER ? 'bg-blue-600 text-white' : 'bg-[#27272a] text-gray-300 border border-[#3f3f46]'}`}>
                            {msg.role === Role.USER ? msg.text : (
                                <div>
                                   <p className="mb-1">{msg.text.split('<file')[0]}</p>
                                   {msg.text.includes('<file') && <span className="text-[10px] text-gray-500 italic">Generating code...</span>}
                                </div>
                            )} 
                         </div>
                      </div>
                   ))}
                   <div className="h-4" />
                </div>
                <div className="p-3 border-t border-[#27272a] bg-[#18181b]">
                   <InputArea 
                      onSendMessage={handleSendMessage} 
                      onStop={() => setIsLoading(false)}
                      isLoading={isLoading} 
                      disabled={false}
                      editMessage={null}
                      onCancelEdit={() => {}}
                      viewMode="builder" 
                   />
                </div>
             </div>
          </div>

          {/* MIDDLE: Code Editor */}
          <div className="flex-1 flex flex-col border-r border-[#27272a] bg-[#1e1e1e] min-w-[300px]">
             {activeFile ? (
                <>
                   <div className="flex items-center justify-between text-xs text-gray-400 bg-[#1e1e1e] px-4 py-2 border-b border-[#27272a]">
                      <div className="flex items-center gap-2">
                         <FileIcon name={activeFile.name} />
                         <span>{activeFile.path}</span>
                      </div>
                      <span className="opacity-50 text-[10px] uppercase">Read Only</span>
                   </div>
                   <div className="flex-1 relative">
                      <textarea 
                         value={activeFile.content} 
                         readOnly 
                         className="absolute inset-0 w-full h-full bg-[#1e1e1e] text-gray-300 font-mono text-sm p-4 outline-none resize-none leading-relaxed custom-scrollbar whitespace-pre"
                         spellCheck={false}
                      />
                   </div>
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 text-sm">
                   <Code className="w-12 h-12 mb-2 opacity-20" />
                   <p>Select a file to view code</p>
                </div>
             )}
          </div>

          {/* RIGHT: Live Preview */}
          <div className="flex-1 flex flex-col bg-[#09090b] min-w-[350px] relative">
             <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#27272a]">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Live Preview</span>
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[10px] text-green-500 font-mono">Running</span>
                </div>
             </div>
             
             <div className="flex-1 flex items-center justify-center p-4 bg-[#09090b] overflow-hidden relative">
                {/* Device Frame */}
                <div className={`transition-all duration-300 bg-white shadow-2xl overflow-hidden relative ${deviceMode === 'mobile' ? 'w-[375px] h-[667px] rounded-[30px] border-[8px] border-[#27272a]' : 'w-full h-full rounded-md border border-[#27272a]'}`}>
                   {activeProject?.files.length ? (
                      <iframe 
                         key={iframeKey}
                         title="Live Preview"
                         srcDoc={getPreviewSource()}
                         className="w-full h-full bg-white"
                         sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                      />
                   ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-[#18181b]">
                         <Activity className="w-12 h-12 mb-2 opacity-20" />
                         <p className="text-sm">App not started</p>
                         <p className="text-xs text-gray-600 mt-2">Ask AI to build something.</p>
                      </div>
                   )}
                </div>
             </div>
             
             <ConsolePanel logs={consoleLogs} />
          </div>

       </div>

       {/* Deployment Modal */}
       {showDeployModal && (
         <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-500" />
               <button onClick={() => setShowDeployModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
               
               <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 shadow-lg shadow-green-500/20">
                  <Check className="w-8 h-8" />
               </div>
               
               <h3 className="text-2xl font-bold text-white mb-2">Deployment Ready</h3>
               <p className="text-gray-400 text-sm mb-6">Your application has been bundled and is ready to be served.</p>
               
               <a 
                  href={deployedUrl || '#'} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all mb-3 flex items-center justify-center gap-2"
               >
                  Open in New Tab <Globe className="w-4 h-4" />
               </a>
               
               <div className="p-3 bg-[#09090b] rounded-lg border border-[#27272a] text-xs text-gray-500 break-all font-mono">
                  {deployedUrl ? 'blob:https://zara-ai.internal/...' : 'Generating link...'}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
