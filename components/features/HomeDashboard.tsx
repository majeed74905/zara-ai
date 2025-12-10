
import React, { useEffect, useState } from 'react';
import { Layout, Heart, Target, Brain, ArrowRight, Zap, MessageSquare, Clock, Calendar, Hammer } from 'lucide-react';
import { ViewMode } from '../../types';

interface HomeDashboardProps {
  onViewChange: (view: ViewMode) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onViewChange }) => {
  const [greeting, setGreeting] = useState('');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  return (
    <div className="h-full p-6 md:p-8 animate-fade-in overflow-y-auto max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent mb-2">
          {greeting}, User
        </h2>
        <p className="text-text-sub">Here is your daily Zara AI snapshot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Mood Insight */}
        <div className="bg-surface/50 border border-border rounded-2xl p-6 backdrop-blur-sm hover:border-primary/30 transition-all group">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                 <Heart className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold bg-surfaceHighlight px-2 py-1 rounded text-text-sub">Today</span>
           </div>
           <h3 className="text-xl font-bold text-text mb-1">Balanced & Calm</h3>
           <p className="text-sm text-text-sub mb-4">Your emotional baseline is stable today. Great time for deep work.</p>
           <button onClick={() => onViewChange('life-os')} className="text-sm text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Open LifeOS <ArrowRight className="w-4 h-4" />
           </button>
        </div>

        {/* Builder Shortcut */}
        <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/20 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm hover:shadow-lg transition-all group">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                 <Hammer className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">New</span>
           </div>
           <h3 className="text-xl font-bold text-text mb-1">App Builder</h3>
           <p className="text-sm text-text-sub mb-4">Generate web apps, dashboards, and tools instantly with AI Architect.</p>
           <button onClick={() => onViewChange('builder')} className="text-sm text-blue-400 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              Start Building <ArrowRight className="w-4 h-4" />
           </button>
        </div>

        {/* Goals */}
        <div className="bg-surface/50 border border-border rounded-2xl p-6 backdrop-blur-sm hover:border-primary/30 transition-all group">
           <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                 <Target className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold bg-surfaceHighlight px-2 py-1 rounded text-text-sub">Progress</span>
           </div>
           <h3 className="text-xl font-bold text-text mb-1">3 Tasks Pending</h3>
           <p className="text-sm text-text-sub mb-4">You're making good progress on "React Mastery".</p>
           <button onClick={() => onViewChange('skills')} className="text-sm text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Go to SkillOS <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Quick Actions */}
         <div className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
               <Zap className="w-5 h-5 text-primary" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => onViewChange('chat')} className="p-3 rounded-xl bg-surfaceHighlight hover:bg-surface border border-transparent hover:border-primary/30 transition-all text-left">
                  <MessageSquare className="w-5 h-5 mb-2 text-indigo-400" />
                  <span className="font-bold text-sm block">New Chat</span>
                  <span className="text-xs text-text-sub">Start fresh</span>
               </button>
               <button onClick={() => onViewChange('planner')} className="p-3 rounded-xl bg-surfaceHighlight hover:bg-surface border border-transparent hover:border-primary/30 transition-all text-left">
                  <Calendar className="w-5 h-5 mb-2 text-green-400" />
                  <span className="font-bold text-sm block">Study Plan</span>
                  <span className="text-xs text-text-sub">Review schedule</span>
               </button>
               <button onClick={() => onViewChange('creative')} className="p-3 rounded-xl bg-surfaceHighlight hover:bg-surface border border-transparent hover:border-primary/30 transition-all text-left">
                  <Brain className="w-5 h-5 mb-2 text-pink-400" />
                  <span className="font-bold text-sm block">Brainstorm</span>
                  <span className="text-xs text-text-sub">New ideas</span>
               </button>
               <button onClick={() => onViewChange('life-os')} className="p-3 rounded-xl bg-surfaceHighlight hover:bg-surface border border-transparent hover:border-primary/30 transition-all text-left">
                  <Heart className="w-5 h-5 mb-2 text-red-400" />
                  <span className="font-bold text-sm block">Check-in</span>
                  <span className="text-xs text-text-sub">Log mood</span>
               </button>
            </div>
         </div>

         {/* Recent Activity */}
         <div className="bg-surface border border-border rounded-2xl p-6">
             <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
               <Clock className="w-5 h-5 text-text-sub" /> Recent Activity
            </h3>
            <div className="space-y-4">
               {[1, 2, 3].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surfaceHighlight transition-colors cursor-pointer" onClick={() => onViewChange('chat')}>
                     <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        AI
                     </div>
                     <div className="flex-1">
                        <h4 className="font-bold text-sm text-text">Project Discussion</h4>
                        <p className="text-xs text-text-sub truncate">Discussing architecture for the new React app...</p>
                     </div>
                     <span className="text-[10px] text-text-sub">2h ago</span>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
