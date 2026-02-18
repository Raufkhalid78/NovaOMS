
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, TicketStatus, CounterState, AIInsight, ServiceDefinition, User, SystemSettings } from '../types';
import { generateQueueInsight } from '../services/geminiService';
import { COLOR_THEMES } from '../constants';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles,
  Bell,
  Settings,
  Volume2,
  Eye,
  LogOut,
  RefreshCw,
  X,
  Moon,
  Sun,
  Monitor,
  MessageSquare,
  Send,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface CounterViewProps {
  tickets: Ticket[];
  counters: CounterState[];
  services: ServiceDefinition[];
  currentUser: User;
  currentCounterId: number;
  systemSettings: SystemSettings;
  onCallNext: (counterId: number) => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  onToggleCounter: (counterId: number) => void;
  onChangeCounter: () => void;
  onLogout: () => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

// Simple AudioContext synth
const playNotificationSound = (type: 'success' | 'alert') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

export const CounterView: React.FC<CounterViewProps> = ({
  tickets,
  counters,
  services,
  currentUser,
  currentCounterId,
  systemSettings,
  onCallNext,
  onUpdateStatus,
  onToggleCounter,
  onChangeCounter,
  onLogout,
  toggleTheme,
  isDarkMode
}) => {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('nova_staff_settings');
      return saved ? JSON.parse(saved) : {
        soundNewTicket: true,
        soundCounterClosed: true,
        visualFlash: true
      };
    } catch {
      return { soundNewTicket: true, soundCounterClosed: true, visualFlash: true };
    }
  });

  // State for notification sending
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  useEffect(() => {
    localStorage.setItem('nova_staff_settings', JSON.stringify(settings));
  }, [settings]);

  const [flashActive, setFlashActive] = useState(false);
  const [animateWaiting, setAnimateWaiting] = useState(false);

  const myCounter = counters.find(c => c.id === currentCounterId);
  const currentTicket = tickets.find(t => t.id === myCounter?.currentTicketId);
  const waitingCount = tickets.filter(t => t.status === TicketStatus.WAITING).length;
  const completedCount = tickets.filter(t => t.status === TicketStatus.COMPLETED && t.counter === currentCounterId).length;

  const prevWaitingCountRef = useRef(waitingCount);
  const prevIsOpenRef = useRef(myCounter?.isOpen ?? true);
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  const countersRef = useRef(counters);
  countersRef.current = counters;

  const refreshInsight = async () => {
    setIsGeneratingInsight(true);
    const result = await generateQueueInsight(ticketsRef.current, countersRef.current.filter(c => c.isOpen).length);
    if (result) {
      setInsight({
        message: result.message,
        severity: result.severity,
        timestamp: Date.now()
      });
    }
    setIsGeneratingInsight(false);
  };

  const sendWhatsAppNotification = async () => {
    if (!currentTicket || !currentTicket.phone || !systemSettings.whatsappEnabled || isSendingNotification) return;
    
    const message = systemSettings.whatsappTemplate
        .replace('{name}', currentTicket.name)
        .replace('{number}', currentTicket.number)
        .replace('{service}', currentTicket.serviceName)
        .replace('{counter}', currentCounterId.toString());

    // Fallback URL generator
    const openDeepLink = () => {
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${currentTicket.phone?.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
        window.open(url, '_blank');
    };

    if (systemSettings.whatsappApiKey) {
        // Backend API Integration Mode
        setIsSendingNotification(true);
        try {
            // Try to hit the backend
            const response = await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: currentTicket.phone,
                    message: message,
                    ticketId: currentTicket.id,
                    apiKey: systemSettings.whatsappApiKey 
                })
            });

            if (response.ok) {
                alert('Notification sent successfully!');
            } else {
                // If backend fails (e.g. 404 because it doesn't exist), fallback to Deep Link
                console.warn("Backend API unavailable, falling back to Deep Link");
                openDeepLink();
            }
        } catch (error) {
            console.error("Error sending notification:", error);
            // Network error -> Fallback
            openDeepLink();
        } finally {
            setIsSendingNotification(false);
        }
    } else {
        // Direct Client-side Deep Link (Default)
        openDeepLink();
    }
  };

  useEffect(() => {
    if (waitingCount > prevWaitingCountRef.current) {
       if (settings.soundNewTicket) playNotificationSound('success');
       if (settings.visualFlash) {
         setFlashActive(true);
         setAnimateWaiting(true);
         setTimeout(() => setFlashActive(false), 400);
         setTimeout(() => setAnimateWaiting(false), 1000);
       }
    }
    prevWaitingCountRef.current = waitingCount;
  }, [waitingCount, settings]);

  useEffect(() => {
    if (myCounter) {
      if (prevIsOpenRef.current && !myCounter.isOpen && settings.soundCounterClosed) {
        playNotificationSound('alert');
      }
      prevIsOpenRef.current = myCounter.isOpen;
    }
  }, [myCounter?.isOpen, settings.soundCounterClosed]);

  const getServiceColorClass = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return 'bg-slate-100 text-slate-800 border-slate-200';
    const theme = COLOR_THEMES.find(t => t.value === service.colorTheme) || COLOR_THEMES[0];
    return theme.classes;
  };

  if (!myCounter) return <div>Counter not found</div>;

  return (
    <div 
      className="h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-y-auto relative transition-colors duration-300"
      onClick={() => { if(showSettings) setShowSettings(false); }}
    >
      {/* Visual Flash Overlay */}
      <div 
        className={`absolute inset-0 pointer-events-none z-50 transition-all duration-300 ease-out ${
          flashActive 
            ? 'bg-blue-400/10 dark:bg-blue-500/10 ring-4 ring-inset ring-blue-400/50' 
            : 'bg-transparent ring-0 ring-transparent'
        }`}
      />

      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 relative z-10">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          <div 
            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between relative"
            onClick={(e) => e.stopPropagation()} 
          >
            <div>
               <div className="flex items-center gap-2 mb-0.5">
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        Counter {currentCounterId}
                    </span>
                    <button 
                        onClick={onChangeCounter}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        title="Switch Counter"
                    >
                        <RefreshCw className="w-3 h-3" />
                    </button>
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate">{currentUser.name}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                  {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}
                title="Settings"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5" />
              </button>
               <button 
                onClick={onLogout}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {/* Settings Popover */}
            {showSettings && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-20 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <Settings className="w-4 h-4" />
                  Preferences
                </h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Volume2 className="w-3 h-3" /> Audio Alerts
                    </h5>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">New Ticket Sound</span>
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            checked={settings.soundNewTicket}
                            onChange={(e) => setSettings(p => ({...p, soundNewTicket: e.target.checked}))}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-600 checked:bg-blue-600 right-4"
                          />
                          <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.soundNewTicket ? 'bg-blue-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Station Closed Sound</span>
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            checked={settings.soundCounterClosed}
                            onChange={(e) => setSettings(p => ({...p, soundCounterClosed: e.target.checked}))}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-600 checked:bg-blue-600 right-4"
                          />
                          <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.soundCounterClosed ? 'bg-blue-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Eye className="w-3 h-3" /> Visual Alerts
                    </h5>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Screen Flash</span>
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            checked={settings.visualFlash}
                            onChange={(e) => setSettings(p => ({...p, visualFlash: e.target.checked}))}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-blue-600 checked:bg-blue-600 right-4"
                          />
                          <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.visualFlash ? 'bg-blue-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-all duration-300 ${animateWaiting ? 'scale-105 ring-2 ring-blue-400 border-blue-400 shadow-lg shadow-blue-100 dark:shadow-blue-900/20' : ''}`}>
            <div className={`p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-transform ${animateWaiting ? 'scale-110' : ''}`}>
              <Users className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Waiting</p>
               <h3 className={`text-2xl font-bold text-slate-800 dark:text-white transition-colors ${animateWaiting ? 'text-blue-600 dark:text-blue-400' : ''}`}>{waitingCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
             <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Served by Me</p>
               <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{completedCount}</h3>
            </div>
          </div>

           <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
             <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Avg Time</p>
               <h3 className="text-2xl font-bold text-slate-800 dark:text-white">4m</h3> 
            </div>
          </div>
        </div>

        {/* AI Insight Section */}
        {/* Only show button if no insight, otherwise show insight with dismiss option */}
        {!insight ? (
           <div className="flex justify-end">
             <button 
               onClick={refreshInsight}
               disabled={isGeneratingInsight}
               className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all group"
             >
               <Sparkles className={`w-4 h-4 ${isGeneratingInsight ? 'text-blue-500' : 'text-purple-500 group-hover:scale-110 transition-transform'}`} />
               {isGeneratingInsight ? 'Analyzing Queue...' : 'Generate AI Operational Insights'}
             </button>
           </div>
        ) : (
          <div className={`rounded-xl p-4 border flex items-start gap-3 animate-in slide-in-from-top duration-500 ${
            insight.severity === 'alert' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-200' :
            insight.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200' :
            'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-200'
          }`}>
            <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1">Gemini Operational Insight</p>
              <p className="text-sm opacity-90">{insight.message}</p>
            </div>
            <div className="flex items-center gap-1">
               <button 
                  onClick={refreshInsight} 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded transition text-current opacity-70 hover:opacity-100" 
                  title="Refresh Insight"
               >
                 <RefreshCw className={`w-4 h-4 ${isGeneratingInsight ? 'animate-spin' : ''}`} />
               </button>
               <button 
                  onClick={() => setInsight(null)} 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded transition text-current opacity-70 hover:opacity-100" 
                  title="Dismiss"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>
          </div>
        )}

        {/* Main Control Area - Changed height to min-h for mobile responsiveness */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
          
          {/* Active Ticket Card */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {!myCounter.isOpen ? (
              <div className="text-center">
                 <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-full inline-flex mb-4">
                   <AlertTriangle className="w-8 h-8 text-slate-400 dark:text-slate-300" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-700 dark:text-white mb-2">Counter Closed</h3>
                 <button 
                  onClick={() => onToggleCounter(currentCounterId)}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
                 >
                   Open Counter
                 </button>
              </div>
            ) : currentTicket ? (
              <div className="w-full max-w-lg">
                <div className="mb-6 md:mb-8">
                  <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold mb-3 md:mb-4 ${getServiceColorClass(currentTicket.serviceId)}`}>
                    {currentTicket.serviceName}
                  </span>
                  <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">{currentTicket.number}</h1>
                  <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400">{currentTicket.name}</p>
                  {currentTicket.phone && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                          <p className="text-sm text-slate-400">{currentTicket.phone}</p>
                          {systemSettings.whatsappEnabled && (
                            <button 
                                onClick={sendWhatsAppNotification}
                                disabled={isSendingNotification}
                                className={`
                                    p-2 rounded-full transition-colors flex items-center justify-center gap-2 text-xs font-bold
                                    ${isSendingNotification 
                                        ? 'text-slate-400 bg-slate-100 dark:bg-slate-700 cursor-not-allowed' 
                                        : 'text-emerald-500 hover:text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30'
                                    }
                                `}
                                title={systemSettings.whatsappApiKey ? "Send WhatsApp (Fallback to App)" : "Open WhatsApp"}
                            >
                                {isSendingNotification ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                <span>Notify</span>
                            </button>
                          )}
                      </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <button 
                    onClick={() => onUpdateStatus(currentTicket.id, TicketStatus.COMPLETED)}
                    className="flex items-center justify-center gap-2 p-3 md:p-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20"
                   >
                     <CheckCircle2 className="w-5 h-5" />
                     Complete
                   </button>
                   <button 
                    onClick={() => onUpdateStatus(currentTicket.id, TicketStatus.NO_SHOW)}
                    className="flex items-center justify-center gap-2 p-3 md:p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                   >
                     <XCircle className="w-5 h-5" />
                     No Show
                   </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                 <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full inline-flex mb-6 animate-pulse">
                   <Bell className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Ready to Serve</h3>
                 <p className="text-slate-400 dark:text-slate-500 mb-8">Waiting for next customer...</p>
                 <button 
                  onClick={() => onCallNext(currentCounterId)}
                  disabled={waitingCount === 0}
                  className="px-8 py-4 bg-blue-600 text-white text-lg rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-200 dark:shadow-blue-900/20"
                 >
                   Call Next Ticket
                 </button>
                 
                 <div className="mt-8 flex justify-center">
                    <button 
                      onClick={() => onToggleCounter(currentCounterId)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium underline"
                    >
                      Close Counter
                    </button>
                 </div>
              </div>
            )}
          </div>

          {/* Queue List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
               <h3 className="font-bold text-slate-700 dark:text-slate-200">Waiting List</h3>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tickets.filter(t => t.status === TicketStatus.WAITING).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <p className="text-sm">No tickets waiting</p>
                  </div>
                ) : (
                  tickets
                  .filter(t => t.status === TicketStatus.WAITING)
                  .sort((a, b) => a.joinedAt - b.joinedAt)
                  .map((ticket) => (
                    <div key={ticket.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-800 dark:text-white">{ticket.number}</span>
                        <span className="text-[10px] text-slate-400">{new Date(ticket.joinedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{ticket.name}</span>
                        <div className={`w-2 h-2 rounded-full ${getServiceColorClass(ticket.serviceId).split(' ')[0].replace('bg-', 'bg-')}`}></div>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
