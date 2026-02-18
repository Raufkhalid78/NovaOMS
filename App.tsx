
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Ticket, TicketStatus, CounterState, ServiceDefinition, User, UserRole, SystemSettings } from './types';
import { INITIAL_SERVICES, INITIAL_USERS, TOTAL_COUNTERS } from './constants';
import { KioskView } from './components/KioskView';
import { DisplayView } from './components/DisplayView';
import { CounterView } from './components/CounterView';
import { LoginView } from './components/LoginView';
import { AdminView } from './components/AdminView';
import { LogOut, Monitor, Sun, Moon, Loader2 } from 'lucide-react';

const SESSION_KEY = 'nova_session';
const THEME_KEY = 'nova_theme';
const RESET_KEY = 'nova_last_reset';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours in ms

const DEFAULT_SETTINGS: SystemSettings = {
  whatsappEnabled: true,
  whatsappTemplate: "Hello {name}, your turn for {service} is coming up! Your ticket number is {number}. Please proceed to Counter {counter}.",
  allowMobileEntry: true,
  whatsappApiKey: "",
  mobileEntryUrl: "",
  operatingHours: {
    enabled: true,
    start: "09:00",
    end: "17:00"
  }
};

const App: React.FC = () => {
  // Global Data State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counters, setCounters] = useState<CounterState[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  
  const [isLoading, setIsLoading] = useState(true);

  // Mobile Entry Mode State
  const [isMobileEntryMode, setIsMobileEntryMode] = useState(false);
  
  // Staff Specific State
  const [staffCounterId, setStaffCounterId] = useState<number | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // --- Helpers for Data Mapping (DB <-> App) ---
  const mapDbTicketToApp = (t: any): Ticket => ({
    id: t.id,
    number: t.number,
    name: t.customer_name,
    phone: t.phone,
    serviceId: t.service_id,
    serviceName: t.service_name,
    status: t.status as TicketStatus,
    joinedAt: new Date(t.joined_at).getTime(),
    servedAt: t.served_at ? new Date(t.served_at).getTime() : undefined,
    completedAt: t.completed_at ? new Date(t.completed_at).getTime() : undefined,
    counter: t.counter_id
  });

  const mapDbCounterToApp = (c: any): CounterState => ({
    id: c.id,
    isOpen: c.is_open,
    assignedStaffId: c.assigned_staff_id,
    currentTicketId: c.current_ticket_id
  });

  const mapDbServiceToApp = (s: any): ServiceDefinition => ({
    id: s.id,
    name: s.name,
    prefix: s.prefix,
    colorTheme: s.color_theme
  });

  const mapDbUserToApp = (u: any): User => ({
    id: u.id,
    username: u.username,
    password: u.password,
    role: u.role as UserRole,
    name: u.name
  });

  // --- INITIAL DATA FETCH & REALTIME ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Users
        const { data: usersData, error: usersError } = await supabase.from('app_users').select('*');
        if (usersData && usersData.length > 0) {
            setUsers(usersData.map(mapDbUserToApp));
        } else {
            // Fallback for demo mode if DB is empty or fails
            console.warn("Using mock users due to DB error or empty table");
            setUsers(INITIAL_USERS);
        }

        // 2. Fetch Services
        const { data: servicesData } = await supabase.from('services').select('*');
        if (servicesData && servicesData.length > 0) {
            setServices(servicesData.map(mapDbServiceToApp));
        } else {
            setServices(INITIAL_SERVICES);
        }

        // 3. Fetch Counters
        const { data: countersData } = await supabase.from('counters').select('*').order('id');
        if (countersData && countersData.length > 0) {
            setCounters(countersData.map(mapDbCounterToApp));
        } else {
            // Generate mock counters
            const mocks: CounterState[] = [];
            for(let i=1; i<=TOTAL_COUNTERS; i++) {
                mocks.push({ id: i, isOpen: true, currentTicketId: null });
            }
            setCounters(mocks);
        }

        // 4. Fetch Tickets
        const { data: ticketsData } = await supabase.from('tickets').select('*').order('joined_at');
        if (ticketsData) setTickets(ticketsData.map(mapDbTicketToApp));

        // 5. Fetch Settings
        const { data: settingsData } = await supabase.from('system_settings').select('*').single();
        if (settingsData) {
            setSystemSettings({
                whatsappEnabled: settingsData.whatsapp_enabled,
                whatsappTemplate: settingsData.whatsapp_template,
                whatsappApiKey: settingsData.whatsapp_api_key,
                allowMobileEntry: settingsData.allow_mobile_entry,
                mobileEntryUrl: settingsData.mobile_entry_url,
                operatingHours: settingsData.operating_hours
            });
        }
      } catch (e) {
        console.error("Error fetching data:", e);
        // Ensure app works even if everything fails
        setUsers(INITIAL_USERS);
        setServices(INITIAL_SERVICES);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // --- REALTIME SUBSCRIPTIONS ---
    
    // Tickets Channel
    const ticketSub = supabase.channel('tickets-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTickets(prev => [...prev, mapDbTicketToApp(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          setTickets(prev => prev.map(t => t.id === payload.new.id ? mapDbTicketToApp(payload.new) : t));
        } else if (payload.eventType === 'DELETE') {
          setTickets(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    // Counters Channel
    const counterSub = supabase.channel('counters-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'counters' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
           setCounters(prev => prev.map(c => c.id === payload.new.id ? mapDbCounterToApp(payload.new) : c));
        }
      })
      .subscribe();

    // Services Channel
    const serviceSub = supabase.channel('services-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
          if(payload.eventType === 'INSERT') {
              setServices(prev => [...prev, mapDbServiceToApp(payload.new)]);
          } else if(payload.eventType === 'UPDATE') {
              setServices(prev => prev.map(s => s.id === payload.new.id ? mapDbServiceToApp(payload.new) : s));
          } else if(payload.eventType === 'DELETE') {
              setServices(prev => prev.filter(s => s.id !== payload.old.id));
          }
      })
      .subscribe();
    
    // Settings Channel
    const settingsSub = supabase.channel('settings-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, (payload) => {
         const s = payload.new;
         setSystemSettings({
             whatsappEnabled: s.whatsapp_enabled,
             whatsappTemplate: s.whatsapp_template,
             whatsappApiKey: s.whatsapp_api_key,
             allowMobileEntry: s.allow_mobile_entry,
             mobileEntryUrl: s.mobile_entry_url,
             operatingHours: s.operating_hours
         });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketSub);
      supabase.removeChannel(counterSub);
      supabase.removeChannel(serviceSub);
      supabase.removeChannel(settingsSub);
    };
  }, []);

  // --- AUTOMATED DAILY RESET LOGIC ---
  useEffect(() => {
    const checkAndPerformReset = async () => {
      const today = new Date().toDateString();
      const lastResetDate = localStorage.getItem(RESET_KEY);

      if (lastResetDate !== today) {
        console.log("Date change detected. Performing daily system reset...", today);
        
        try {
            const { error } = await supabase.rpc('reset_daily_queue');
            if (error) {
                console.error("Failed to reset daily queue:", error);
            } else {
                localStorage.setItem(RESET_KEY, today);
                console.log("Daily reset successful");
            }
        } catch (e) {
            console.error("Error executing reset RPC:", e);
        }
      }
    };

    checkAndPerformReset();
    const intervalId = setInterval(checkAndPerformReset, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'mobile_entry') {
      setIsMobileEntryMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_KEY, 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  // Session Restoration
  useEffect(() => {
    const restoreSession = async () => {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
        try {
            const { userId, expiry } = JSON.parse(savedSession);
            if (!expiry || Date.now() < expiry) {
                // We need to wait for users to be loaded, or fetch this specific user
                // Try from local state first if populated
                let foundUser = users.find(u => u.id === userId);
                
                if (!foundUser) {
                   const { data } = await supabase.from('app_users').select('*').eq('id', userId).single();
                   if (data) foundUser = mapDbUserToApp(data);
                }

                if (foundUser) {
                    setCurrentUser(foundUser);
                    
                    const savedCounterId = localStorage.getItem(`nova_staff_counter_${foundUser.id}`);
                    if (savedCounterId) {
                        setStaffCounterId(parseInt(savedCounterId));
                    }
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
            }
        } catch (e) {
            localStorage.removeItem(SESSION_KEY);
        }
        }
    };
    // Only run when users are loaded to prevent race conditions
    if (users.length > 0) restoreSession();
  }, [users]);

  // --- Theme Handlers ---
  const handleToggleTheme = () => {
      setIsDarkMode(prev => !prev);
  };

  // --- Auth Handlers ---
  const handleLogin = async (username: string, pass: string, rememberMe: boolean): Promise<boolean> => {
    // 1. Try Local Mock Users First (if in offline mode)
    const localUser = users.find(u => u.username === username && u.password === pass);
    
    if (localUser) {
        setCurrentUser(localUser);
        const expiry = rememberMe ? null : Date.now() + SESSION_DURATION;
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: localUser.id, expiry }));
        return true;
    }

    // 2. Fallback to DB query
    const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password', pass)
        .single();
    
    if (data && !error) {
      const user = mapDbUserToApp(data);
      setCurrentUser(user);
      const expiry = rememberMe ? null : Date.now() + SESSION_DURATION;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expiry }));
      
      const savedCounterId = localStorage.getItem(`nova_staff_counter_${user.id}`);
      if (savedCounterId) {
          setStaffCounterId(parseInt(savedCounterId));
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    if (currentUser?.role === UserRole.STAFF && staffCounterId !== null) {
        // Release counter in DB
        supabase.from('counters').update({ assigned_staff_id: null }).eq('id', staffCounterId).then();
        setStaffCounterId(null);
    }
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  // --- Admin Handlers ---
  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    const { error } = await supabase.from('system_settings').update({
        whatsapp_enabled: newSettings.whatsappEnabled,
        whatsapp_template: newSettings.whatsappTemplate,
        whatsapp_api_key: newSettings.whatsappApiKey,
        allow_mobile_entry: newSettings.allowMobileEntry,
        mobile_entry_url: newSettings.mobileEntryUrl,
        operating_hours: newSettings.operatingHours
    }).eq('id', 1); // Assuming single row with ID 1

    if (error) console.error("Error updating settings:", error);
    // State update happens via realtime subscription
  };

  const handleAddUser = async (newUserData: Omit<User, 'id'>) => {
     // Generate local ID for immediate UI update in demo mode
     const tempId = `user_${Date.now()}`;
     const { error } = await supabase.from('app_users').insert({
         username: newUserData.username,
         password: newUserData.password,
         name: newUserData.name,
         role: newUserData.role
     });
     
     if (error) {
         console.error("Error adding user (DB):", error);
         // Fallback for demo
         setUsers(prev => [...prev, { ...newUserData, id: tempId }]);
     }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.password) dbUpdates.password = updates.password;

    const { error } = await supabase.from('app_users').update(dbUpdates).eq('id', id);
    if (error) {
        console.error("Error updating user:", error);
        // Fallback
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    }
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) {
        console.error("Error deleting user:", error);
        setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleAddService = async (newServiceData: Omit<ServiceDefinition, 'id'>) => {
    const tempId = `srv_${Date.now()}`;
    const { error } = await supabase.from('services').insert({
        name: newServiceData.name,
        prefix: newServiceData.prefix,
        color_theme: newServiceData.colorTheme
    });
    if (error) {
        console.error("Error adding service:", error);
        setServices(prev => [...prev, { ...newServiceData, id: tempId }]);
    }
  };

  const handleUpdateService = async (id: string, updates: Partial<ServiceDefinition>) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.prefix) dbUpdates.prefix = updates.prefix;
      if (updates.colorTheme) dbUpdates.color_theme = updates.colorTheme;

      const { error } = await supabase.from('services').update(dbUpdates).eq('id', id);
      if (error) {
          console.error("Error updating service:", error);
          setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      }
  };

  const handleDeleteService = async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) {
          console.error("Error deleting service:", error);
          setServices(prev => prev.filter(s => s.id !== id));
      }
  };

  // --- Queue Logic Handlers ---
  const handleJoinQueue = async (name: string, serviceId: string, phone: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) throw new Error("Service not found");

    // Client-side count for simple sequence generation (Race condition acceptable for MVP, or use SERIAL in DB)
    const count = tickets.filter(t => t.serviceId === serviceId).length;
    const seq = count + 1;
    const number = `${service.prefix}${seq.toString().padStart(3, '0')}`;

    const { data, error } = await supabase.from('tickets').insert({
        number: number,
        customer_name: name,
        phone: phone,
        service_id: serviceId,
        service_name: service.name,
        status: TicketStatus.WAITING,
        joined_at: new Date().toISOString()
    }).select().single();

    if (error) {
        console.error("Error joining queue (DB), falling back to local:", error);
        // Fallback ticket
        const newTicket: Ticket = {
            id: `temp_${Date.now()}`,
            number,
            name,
            phone,
            serviceId,
            serviceName: service.name,
            status: TicketStatus.WAITING,
            joinedAt: Date.now()
        };
        setTickets(prev => [...prev, newTicket]);
        return newTicket;
    }
    
    return mapDbTicketToApp(data);
  };

  const handleCancelTicket = async (ticketId: string) => {
    const { error } = await supabase.from('tickets')
        .update({ status: TicketStatus.CANCELLED })
        .eq('id', ticketId);
    if (error) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: TicketStatus.CANCELLED } : t));
    }
  };

  const handleCallNext = async (counterId: number) => {
    // 1. Find next ticket logic (Client side for candidate)
    const nextTicket = tickets
      .filter(t => t.status === TicketStatus.WAITING)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];

    if (!nextTicket) return;

    // 2. Perform transactional update (Check if still waiting)
    // Update Ticket
    const { data: updatedTicket, error: ticketError } = await supabase
        .from('tickets')
        .update({ 
            status: TicketStatus.SERVING, 
            counter_id: counterId, 
            served_at: new Date().toISOString() 
        })
        .eq('id', nextTicket.id)
        .eq('status', TicketStatus.WAITING) // Optimistic Lock
        .select()
        .single();
    
    // Fallback if DB fails
    if (ticketError) {
        console.warn("DB Update failed, forcing local update for demo");
        setTickets(prev => prev.map(t => t.id === nextTicket.id ? { ...t, status: TicketStatus.SERVING, counter: counterId, servedAt: Date.now() } : t));
        
        // Update Counter Local
        setCounters(prev => prev.map(c => c.id === counterId ? { ...c, currentTicketId: nextTicket.id } : c));
        return;
    }

    // Update Counter
    await supabase.from('counters')
        .update({ current_ticket_id: nextTicket.id })
        .eq('id', counterId);
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    const updatePayload: any = { status };
    if (status === TicketStatus.COMPLETED) {
        updatePayload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('tickets').update(updatePayload).eq('id', ticketId);
    
    if (error) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status, completedAt: status === TicketStatus.COMPLETED ? Date.now() : undefined } : t));
    }
    
    // Release counter
    // Find which counter has this ticket
    const counter = counters.find(c => c.currentTicketId === ticketId);
    if (counter) {
        const { error: cError } = await supabase.from('counters')
            .update({ current_ticket_id: null })
            .eq('id', counter.id);
        
        if (cError) {
             setCounters(prev => prev.map(c => c.id === counter.id ? { ...c, currentTicketId: null } : c));
        }
    }
  };

  const handleToggleCounter = async (counterId: number) => {
    const counter = counters.find(c => c.id === counterId);
    if (counter) {
        const { error } = await supabase.from('counters')
            .update({ is_open: !counter.isOpen })
            .eq('id', counterId);
        
        if (error) {
             setCounters(prev => prev.map(c => c.id === counterId ? { ...c, isOpen: !c.isOpen } : c));
        }
    }
  };

  // --- Staff Specific Handlers ---
  const handleStaffSelectCounter = async (counterId: number) => {
      setStaffCounterId(counterId);
      if (currentUser) {
          localStorage.setItem(`nova_staff_counter_${currentUser.id}`, counterId.toString());
          const { error } = await supabase.from('counters')
            .update({ assigned_staff_id: currentUser.id })
            .eq('id', counterId);
          
          if (error) {
             setCounters(prev => prev.map(c => c.id === counterId ? { ...c, assignedStaffId: currentUser.id } : c));
          }
      }
  };

  const handleStaffLeaveCounter = async () => {
      if (staffCounterId !== null) {
          const { error } = await supabase.from('counters')
            .update({ assigned_staff_id: null })
            .eq('id', staffCounterId);

          if (error) {
             setCounters(prev => prev.map(c => c.id === staffCounterId ? { ...c, assignedStaffId: undefined } : c));
          }

          setStaffCounterId(null);
          if (currentUser) {
              localStorage.removeItem(`nova_staff_counter_${currentUser.id}`);
          }
      }
  };

  // --- Rendering ---
  if (isLoading) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Connecting to Nova Cloud...</p>
          </div>
      )
  }

  if (isMobileEntryMode) {
      if (!systemSettings.allowMobileEntry) {
          return (
              <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Mobile Entry Disabled</h1>
                    <p className="text-slate-500">Please visit the kiosk to get a ticket.</p>
                  </div>
              </div>
          )
      }
      return (
        <KioskView 
          services={services}
          onJoinQueue={(n, s, p) => handleJoinQueue(n, s, p) as any} // Cast promise
          onCancelTicket={handleCancelTicket} 
          onLogout={() => {}} 
          toggleTheme={handleToggleTheme}
          isDarkMode={isDarkMode}
          isMobileMode={true}
          systemSettings={systemSettings}
        />
      );
  }

  if (!currentUser) {
    return (
        <LoginView 
            onLogin={handleLogin} 
            toggleTheme={handleToggleTheme} 
            isDarkMode={isDarkMode} 
        />
    );
  }

  switch (currentUser.role) {
    case UserRole.ADMIN:
      return (
        <AdminView 
          currentUser={currentUser}
          users={users}
          services={services}
          tickets={tickets}
          counters={counters}
          systemSettings={systemSettings}
          onUpdateSettings={handleUpdateSettings}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onAddService={handleAddService}
          onUpdateService={handleUpdateService}
          onDeleteService={handleDeleteService}
          onLogout={handleLogout}
          toggleTheme={handleToggleTheme}
          isDarkMode={isDarkMode}
        />
      );

    case UserRole.KIOSK:
      return (
        <KioskView 
          services={services}
          onJoinQueue={(n, s, p) => handleJoinQueue(n, s, p) as any}
          onCancelTicket={handleCancelTicket} 
          onLogout={handleLogout}
          toggleTheme={handleToggleTheme}
          isDarkMode={isDarkMode}
          systemSettings={systemSettings}
        />
      );

    case UserRole.DISPLAY:
      return (
        <DisplayView 
          tickets={tickets} 
          counters={counters} 
          services={services}
          onLogout={handleLogout}
          toggleTheme={handleToggleTheme}
          isDarkMode={isDarkMode}
        />
      );

    case UserRole.STAFF:
      if (staffCounterId === null) {
          return (
             <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300 relative">
                 <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                        onClick={handleToggleTheme}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Toggle Theme"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                 </div>
                 
                 <div className="max-w-2xl w-full text-center">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Select Your Counter</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-10">Choose an available station to start serving customers.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {counters.map(c => {
                            const isOccupied = c.assignedStaffId && c.assignedStaffId !== currentUser.id;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => handleStaffSelectCounter(c.id)}
                                    disabled={!!isOccupied}
                                    className={`
                                        p-6 rounded-xl border-2 transition-all duration-200 relative overflow-hidden group
                                        ${isOccupied 
                                            ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed' 
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:-translate-y-1'
                                        }
                                    `}
                                >
                                    <div className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
                                        {c.id}
                                    </div>
                                    <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Counter
                                    </div>
                                    {isOccupied ? (
                                        <div className="absolute inset-x-0 bottom-0 bg-slate-200 dark:bg-slate-800 py-1 text-[10px] font-bold text-slate-500">
                                            OCCUPIED
                                        </div>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 bg-emerald-500 py-1 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            SELECT
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                 </div>
             </div>
          );
      }

      return (
        <CounterView 
          tickets={tickets} 
          counters={counters}
          services={services}
          currentUser={currentUser}
          currentCounterId={staffCounterId}
          systemSettings={systemSettings}
          onCallNext={handleCallNext}
          onUpdateStatus={handleUpdateTicketStatus}
          onToggleCounter={handleToggleCounter}
          onChangeCounter={handleStaffLeaveCounter}
          onLogout={handleLogout}
          toggleTheme={handleToggleTheme}
          isDarkMode={isDarkMode}
        />
      );
      
    default:
      return <div>Unknown Role</div>;
  }
};

export default App;
