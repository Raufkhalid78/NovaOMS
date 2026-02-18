
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, TicketStatus, CounterState, ServiceDefinition } from '../types';
import { COLOR_THEMES } from '../constants';
import { MonitorPlay, Clock, LogOut, Sun, Moon, Volume2, VolumeX, Timer } from 'lucide-react';

interface DisplayViewProps {
  tickets: Ticket[];
  counters: CounterState[];
  services: ServiceDefinition[];
  onLogout: () => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

export const DisplayView: React.FC<DisplayViewProps> = ({ tickets, counters, services, onLogout, toggleTheme, isDarkMode }) => {
  // Get currently serving tickets for display
  const servingTickets = tickets.filter(t => t.status === TicketStatus.SERVING);
  
  // Get upcoming waiting tickets (next 5) for display
  const waitingTickets = tickets
    .filter(t => t.status === TicketStatus.WAITING)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .slice(0, 5);

  // State for dynamic wait times per service
  const [serviceEstimates, setServiceEstimates] = useState<Record<string, number>>({});
  
  // Force re-render every second for live timer
  const [now, setNow] = useState(Date.now());

  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const lastAnnouncedRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // TTS Effect
  useEffect(() => {
    // Find the most recently served ticket (latest timestamp)
    const latestServing = [...servingTickets].sort((a, b) => (b.servedAt || 0) - (a.servedAt || 0))[0];

    // Check if we have a ticket, it's different from the last one, and audio is on
    if (latestServing && latestServing.id !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = latestServing.id;
        
        if (!isMuted && 'speechSynthesis' in window) {
            // Cancel any current speaking
            window.speechSynthesis.cancel();
            
            // Updated announcement to include name
            const text = `Ticket number ${latestServing.number}, ${latestServing.name}, please proceed to Counter ${latestServing.counter}`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slightly slower for clarity
            
            // Try to set a good voice if available (optional)
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;

            window.speechSynthesis.speak(utterance);
        }
    }
  }, [servingTickets, isMuted]);

  useEffect(() => {
    const calculateWaitTimes = () => {
      const calcNow = Date.now();
      
      const currentlyServing = tickets.filter(t => t.status === TicketStatus.SERVING);
      const allWaiting = tickets.filter(t => t.status === TicketStatus.WAITING);

      // Optimization: If system is completely empty, show 0 wait time
      if (currentlyServing.length === 0 && allWaiting.length === 0) {
        const zeroEstimates: Record<string, number> = {};
        services.forEach(s => zeroEstimates[s.id] = 0);
        setServiceEstimates(zeroEstimates);
        return;
      }

      // 1. Define Standard Session Duration per Service
      const standardTimes: Record<string, number> = {};
      services.forEach(service => {
         standardTimes[service.id] = (service.defaultWaitTime || 5) * 60 * 1000;
      });

      // 2. Calculate remaining time for currently serving tickets
      const activeCountersCount = counters.filter(c => c.isOpen).length || 1;

      const servingBacklog = currentlyServing.reduce((acc, t) => {
        // If ticket served time is missing or in future, assume full standard duration
        if (!t.servedAt || t.servedAt > calcNow) return acc + (standardTimes[t.serviceId] || 300000);
        
        const elapsed = calcNow - t.servedAt;
        const duration = standardTimes[t.serviceId] || 300000;
        // Assume at least 30 seconds remaining even if overdue
        const remaining = Math.max(30000, duration - elapsed); 
        return acc + remaining;
      }, 0);

      // 3. Calculate total waiting backlog using standard times
      const waitingBacklog = allWaiting.reduce((acc, t) => acc + (standardTimes[t.serviceId] || 300000), 0);

      // 4. Total backlog / Active Counters
      const totalBacklog = servingBacklog + waitingBacklog;
      const estTimeMs = totalBacklog / activeCountersCount;
      
      // Round up to nearest minute
      const estMinutes = Math.ceil(estTimeMs / 60000);

      const newEstimates: Record<string, number> = {};
      services.forEach(service => {
        newEstimates[service.id] = estMinutes;
      });

      setServiceEstimates(newEstimates);
    };

    calculateWaitTimes();
    const interval = setInterval(calculateWaitTimes, 5000); 
    return () => clearInterval(interval);

  }, [tickets, counters, services]);

  const getServiceColorClass = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return 'bg-slate-100 text-slate-800 border-slate-200';
    const theme = COLOR_THEMES.find(t => t.value === service.colorTheme) || COLOR_THEMES[0];
    return theme.classes;
  };

  const formatRemainingTime = (ticket: Ticket) => {
    if (!ticket.servedAt) return "--:--";
    
    const service = services.find(s => s.id === ticket.serviceId);
    const durationMs = (service?.defaultWaitTime || 30) * 60 * 1000;
    const elapsed = now - ticket.servedAt;
    const remaining = Math.max(0, durationMs - elapsed);
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (ticket: Ticket) => {
      if (!ticket.servedAt) return "text-slate-400";
      const service = services.find(s => s.id === ticket.serviceId);
      const durationMs = (service?.defaultWaitTime || 30) * 60 * 1000;
      const elapsed = now - ticket.servedAt;
      const remaining = durationMs - elapsed;
      
      if (remaining < 0) return "text-red-500 animate-pulse"; // Overtime
      if (remaining < 5 * 60 * 1000) return "text-amber-500"; // < 5 mins
      return "text-emerald-500";
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-1 gap-4 md:gap-8 overflow-y-auto relative transition-colors duration-300">
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 shadow-sm"
            title={isMuted ? "Unmute Announcements" : "Mute Announcements"}
        >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 shadow-sm"
            title="Toggle Theme"
        >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button 
            onClick={onLogout}
            className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-500 transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-900 shadow-sm"
            title="Logout"
        >
            <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Left Panel: Currently Serving */}
      <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
        <div className="flex items-center gap-3 mb-1 md:mb-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <h2 className="text-lg md:text-xl font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Now Serving</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full content-start">
          {servingTickets.length === 0 ? (
            <div className="col-span-full h-64 md:h-96 flex flex-col items-center justify-center bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
              <MonitorPlay className="w-12 h-12 md:w-16 md:h-16 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-400 dark:text-slate-500 text-lg md:text-2xl font-light">Please wait for the next number</p>
            </div>
          ) : (
            servingTickets.map((ticket) => (
              <div key={ticket.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border-l-8 border-blue-500 shadow-xl dark:shadow-2xl relative overflow-hidden animate-in zoom-in duration-300 ring-1 ring-slate-100 dark:ring-0">
                <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
                  <span className="text-6xl md:text-9xl font-black text-slate-900 dark:text-white">{ticket.counter}</span>
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg uppercase tracking-wider font-semibold mb-2">Counter</p>
                        <p className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-4 md:mb-6">{ticket.counter}</p>
                   </div>
                   
                   <div className="border-t border-slate-100 dark:border-slate-800 pt-4 md:pt-6">
                     <div className="flex justify-between items-end mb-2">
                        <div>
                             <p className="text-slate-400 dark:text-slate-400 text-xs md:text-sm uppercase tracking-wider mb-1">Ticket Number</p>
                             <p className="text-4xl md:text-5xl font-bold text-blue-600 dark:text-blue-400 tracking-tighter">{ticket.number}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-end gap-1">
                                <Timer className="w-3 h-3" /> Time Left
                            </p>
                            <p className={`text-2xl md:text-3xl font-mono font-bold ${getTimerColor(ticket)}`}>
                                {formatRemainingTime(ticket)}
                            </p>
                        </div>
                     </div>
                     <p className="text-xl md:text-2xl font-medium text-slate-600 dark:text-slate-300 mt-2 truncate">{ticket.name}</p>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Up Next List & Stats */}
      <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-700/50 flex flex-col min-h-[400px] lg:min-h-0 lg:h-full overflow-hidden shadow-sm">
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-lg md:text-xl font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 md:mb-6 pb-3 md:pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">Up Next</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative mb-4">
            {waitingTickets.length === 0 ? (
              <div className="text-center text-slate-400 dark:text-slate-500 mt-10">
                <p>Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {waitingTickets.map((ticket, index) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 md:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{ticket.number}</p>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-500 truncate max-w-[100px] md:max-w-[120px]">{ticket.name}</p>
                      </div>
                    </div>
                    <div className={`text-[10px] md:text-xs px-2 py-1 rounded border ${getServiceColorClass(ticket.serviceId).replace('bg-', 'bg-opacity-20 ')}`}>
                      {ticket.serviceName}
                    </div>
                  </div>
                ))}
                {tickets.filter(t => t.status === TicketStatus.WAITING).length > 5 && (
                  <div className="text-center py-4 text-slate-500 dark:text-slate-500">
                    + {tickets.filter(t => t.status === TicketStatus.WAITING).length - 5} others waiting
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Estimated Wait Times Section */}
        <div className="mt-auto pt-4 md:pt-6 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Clock className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
            <h3 className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Est. Wait Times</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {services.map((service) => (
               <div key={service.id} className="bg-white dark:bg-slate-900 p-2 md:p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${getServiceColorClass(service.id).split(' ')[0].replace('bg-', 'bg-')}`}></div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1 truncate pl-2">{service.name}</span>
                  <div className="flex items-baseline gap-1 pl-2">
                    <span className="text-lg md:text-xl font-bold text-slate-800 dark:text-white transition-all duration-500">{serviceEstimates[service.id] || 0}</span>
                    <span className="text-[10px] md:text-xs text-slate-400">min</span>
                  </div>
               </div>
            ))}
          </div>
        </div>

        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl p-2 md:p-3 text-center shadow-lg shadow-blue-200 dark:shadow-none">
             <p className="text-xs font-medium text-white mb-0.5">Download our App</p>
             <p className="text-[10px] text-blue-100">Track your ticket remotely</p>
          </div>
        </div>
      </div>
    </div>
  );
};
