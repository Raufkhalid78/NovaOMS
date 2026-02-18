
import React, { useState, useEffect, useRef } from 'react';
import { Ticket, ServiceDefinition, SystemSettings } from '../types';
import { COLOR_THEMES } from '../constants';
import { UserPlus, CheckCircle, Smartphone, XCircle, AlertTriangle, LogOut, Sun, Moon, Clock } from 'lucide-react';
import { generateWelcomeMessage } from '../services/geminiService';

interface KioskViewProps {
  services: ServiceDefinition[];
  onJoinQueue: (name: string, serviceId: string, phone: string) => Ticket;
  onCancelTicket: (ticketId: string) => void;
  onLogout: () => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  isMobileMode?: boolean;
  systemSettings?: SystemSettings;
}

export const KioskView: React.FC<KioskViewProps> = ({ 
  services, 
  onJoinQueue, 
  onCancelTicket, 
  onLogout, 
  toggleTheme, 
  isDarkMode, 
  isMobileMode = false,
  systemSettings
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [generatedTicket, setGeneratedTicket] = useState<Ticket | null>(null);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  
  // Operating Hours Logic
  const [isShopOpen, setIsShopOpen] = useState(true);
  
  useEffect(() => {
    if (!systemSettings?.operatingHours?.enabled) {
        setIsShopOpen(true);
        return;
    }

    const checkTime = () => {
        const now = new Date();
        // Get current time in HH:MM format (24h) for easy comparison
        const currentTimeString = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        const { start, end } = systemSettings.operatingHours;
        
        if (currentTimeString >= start && currentTimeString <= end) {
            setIsShopOpen(true);
        } else {
            setIsShopOpen(false);
        }
    };

    checkTime();
    const interval = setInterval(checkTime, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [systemSettings?.operatingHours]);

  // Format time helper (13:00 -> 1:00 PM)
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Cancellation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // Timer ref to manage auto-reset
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const startResetTimer = (duration = 8000) => {
    clearResetTimer();
    // Only auto-reset if NOT in mobile mode (users on phone might want to keep the ticket screen open)
    if (!isMobileMode) {
      resetTimerRef.current = setTimeout(() => {
        resetToStart();
      }, duration);
    }
  };

  const resetToStart = () => {
    clearResetTimer();
    setStep(1);
    setName('');
    setPhone('');
    setSelectedServiceId(null);
    setGeneratedTicket(null);
    setWelcomeMsg('');
    setShowCancelConfirm(false);
    setIsCancelled(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearResetTimer();
  }, []);

  const handleServiceSelect = (id: string) => {
    setSelectedServiceId(id);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId || !name) return;

    const ticket = onJoinQueue(name, selectedServiceId, phone);
    setGeneratedTicket(ticket);
    setStep(3);
    
    // Reset cancellation UI state
    setShowCancelConfirm(false);
    setIsCancelled(false);

    // Generate AI welcome message
    generateWelcomeMessage(ticket).then(setWelcomeMsg);

    // Start auto-reset timer
    startResetTimer();
  };

  const handleInitiateCancel = () => {
    clearResetTimer(); // Stop auto-close while user decides
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    if (generatedTicket) {
      onCancelTicket(generatedTicket.id);
      setIsCancelled(true);
      setShowCancelConfirm(false);
      // Show "Cancelled" message for a moment then reset
      if (!isMobileMode) startResetTimer(3000); 
    }
  };

  const handleAbortCancel = () => {
    setShowCancelConfirm(false);
    startResetTimer(8000); // Restart timer
  };

  // Helper to get color classes
  const getServiceStyles = (themeName: string) => {
    const theme = COLOR_THEMES.find(t => t.value === themeName) || COLOR_THEMES[0];
    return theme;
  };

  // --- Render Views ---

  // 1. Closed Shop View
  if (!isShopOpen && systemSettings?.operatingHours) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
         <div className="flex justify-end p-4 md:p-6">
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {!isMobileMode && (
                <button 
                    onClick={onLogout}
                    className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition-colors ml-2"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            )}
         </div>
         
         <div className="flex-1 flex items-center justify-center p-4 md:p-8">
            <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-lg text-center max-w-md w-full border border-slate-200 dark:border-slate-700">
                <div className="flex justify-center mb-6">
                <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full text-amber-600 dark:text-amber-400">
                    <Clock className="w-12 h-12" />
                </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">We are currently closed</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                The queue system is offline. Please visit us during our operating hours.
                </p>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700 w-full">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Operating Hours</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {formatTime(systemSettings.operatingHours.start)} - {formatTime(systemSettings.operatingHours.end)}
                    </p>
                </div>
            </div>
         </div>
      </div>
    );
  }

  // 2. Ticket Generated View
  if (step === 3 && generatedTicket) {
    if (isCancelled) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-8 bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-lg text-center max-w-md w-full border border-slate-100 dark:border-slate-700">
             <div className="flex justify-center mb-6">
               <XCircle className="w-20 h-20 text-slate-300 dark:text-slate-600" />
             </div>
             <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Ticket Cancelled</h2>
             <p className="text-slate-500 dark:text-slate-400">Your ticket has been removed from the queue.</p>
             {isMobileMode && (
                 <button onClick={resetToStart} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg">Get New Ticket</button>
             )}
           </div>
        </div>
      );
    }

    if (showCancelConfirm) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-8 bg-slate-50 dark:bg-slate-950 animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-red-100 dark:border-red-900/30">
            <div className="flex justify-center mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Cancel Ticket?</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              Are you sure you want to leave the queue? You will lose your spot for ticket <span className="font-bold text-slate-800 dark:text-slate-200">{generatedTicket.number}</span>.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmCancel}
                className="w-full py-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition shadow-lg shadow-red-200 dark:shadow-red-900/20"
              >
                Yes, Cancel Ticket
              </button>
              <button
                onClick={handleAbortCancel}
                className="w-full py-4 rounded-xl bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition"
              >
                No, Keep My Spot
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-500">
        <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-100 dark:border-slate-700 relative">
          <div className="flex justify-center mb-6">
            <CheckCircle className="w-16 h-16 md:w-20 md:h-20 text-emerald-500" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">You are in line!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">No need to print. We'll call you.</p>
          
          <div className="bg-slate-50 dark:bg-slate-700/50 border-2 border-dashed border-slate-300 dark:border-slate-600 p-6 rounded-2xl mb-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Ticket Number</p>
            <span className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
              {generatedTicket.number}
            </span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-blue-800 dark:text-blue-200 text-sm font-medium mb-8">
            {welcomeMsg || "Loading your personalized welcome..."}
          </div>

          <div className="flex flex-col gap-4">
            {!isMobileMode && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                This screen will close automatically in a few seconds.
              </p>
            )}
            <button
              onClick={handleInitiateCancel}
              className="text-red-500 text-sm font-semibold hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 py-2 px-4 rounded-lg transition-colors"
            >
              Cancel Ticket
            </button>
            
            {isMobileMode && (
                <button 
                  onClick={resetToStart}
                  className="mt-4 text-slate-400 hover:text-slate-600 text-sm underline"
                >
                    Start Over
                </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Kiosk View (Step 1 & 2)
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-y-auto transition-colors duration-300">
      <div className="flex justify-between items-center max-w-4xl mx-auto w-full mb-6">
        <div className="flex gap-2 ml-auto">
            <button 
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Toggle Theme"
            >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {!isMobileMode && (
                <button 
                    onClick={onLogout}
                    className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition-colors"
                    title="Logout"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3">Welcome to Nova Services</h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400">Please select a service to join the digital queue</p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {services.map((service) => {
              const theme = getServiceStyles(service.colorTheme);
              // Extract bg and text color for icon
              const iconClass = `${theme.classes.split(' ')[0]} ${theme.classes.split(' ')[1]}`;
              
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className="group relative flex items-center p-6 md:p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl font-bold mr-4 md:mr-6 ${iconClass}`}>
                    {service.prefix}
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{service.name}</h3>
                    <p className="text-slate-400 dark:text-slate-500 mt-1">Tap to join queue</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="max-w-md mx-auto w-full bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 animate-in slide-in-from-right duration-300">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <UserPlus className="w-6 h-6 text-blue-500" />
              Your Details
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Mobile Number <span className="text-slate-400 font-normal">(Optional, for WhatsApp)</span>
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="555-0123"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!name}
                  className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
                >
                  Get Ticket
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
