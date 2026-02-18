
import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { User, ServiceDefinition, UserRole, Ticket, TicketStatus, SystemSettings, CounterState } from '../types';
import { COLOR_THEMES } from '../constants';
import { 
  Users, 
  Layers, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Shield,
  Monitor,
  Smartphone,
  User as UserIcon,
  Moon,
  Sun,
  Clock,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  Activity,
  QrCode,
  MessageSquare,
  Link as LinkIcon,
  Save,
  Download,
  Key,
  BarChart3,
  TrendingUp,
  Menu,
  X,
  Upload,
  Calendar,
  Globe
} from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
  users: User[];
  services: ServiceDefinition[];
  tickets: Ticket[];
  counters: CounterState[];
  systemSettings: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onAddService: (service: Omit<ServiceDefinition, 'id'>) => void;
  onUpdateService: (id: string, updates: Partial<ServiceDefinition>) => void;
  onDeleteService: (id: string) => void;
  onLogout: () => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  users,
  services,
  tickets,
  counters,
  systemSettings,
  onUpdateSettings,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onAddService,
  onUpdateService,
  onDeleteService,
  onLogout,
  toggleTheme,
  isDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'users' | 'integrations' | 'profile'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Dashboard Widget State
  const [statusWidgetView, setStatusWidgetView] = useState<'counters' | 'staff'>('counters');

  // Service Form State
  const [newService, setNewService] = useState({ name: '', prefix: '', colorTheme: 'blue', defaultWaitTime: 5 });
  const [editingService, setEditingService] = useState<ServiceDefinition | null>(null);

  // User Add Form State
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: UserRole.STAFF });
  const [isAddingUser, setIsAddingUser] = useState(false);

  // User Edit State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', username: '', role: UserRole.STAFF, password: '' });

  // Settings Form State
  const [localSettings, setLocalSettings] = useState<SystemSettings>(systemSettings);

  // QR Customization State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrSize, setQrSize] = useState(400);
  const [qrEcc, setQrEcc] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [qrLogo, setQrLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // Profile Edit State
  const [profileFormData, setProfileFormData] = useState({
    name: currentUser.name,
    username: currentUser.username,
    password: ''
  });

  // Sync profile form with current user
  useEffect(() => {
    setProfileFormData({
      name: currentUser.name,
      username: currentUser.username,
      password: ''
    });
  }, [currentUser]);

  // Sync settings form
  useEffect(() => {
    setLocalSettings(systemSettings);
  }, [systemSettings]);

  // Close mobile menu when tab changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  // --- Analytics Logic ---

  const hourlyTraffic = useMemo(() => {
    const buckets = new Array(10).fill(0); // 09:00 to 18:00
    const startHour = 9;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    tickets.forEach(t => {
      const tDate = new Date(t.joinedAt);
      if (tDate >= today) {
        const h = tDate.getHours();
        const index = h - startHour;
        if (index >= 0 && index < 10) {
          buckets[index]++;
        }
      }
    });
    return buckets;
  }, [tickets]);

  const recentActivity = useMemo(() => {
    const events: { id: string, type: 'join'|'serve'|'complete'|'cancel', time: number, title: string, subtitle: string, icon: any, color: string }[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    tickets.forEach(t => {
      if (t.joinedAt < today.getTime()) return;

      events.push({ 
        id: t.id + '_join', 
        type: 'join', 
        time: t.joinedAt, 
        title: `Ticket ${t.number} Joined`, 
        subtitle: `${t.serviceName} • ${t.name}`,
        icon: Plus,
        color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
      });

      if (t.servedAt) {
        events.push({ 
            id: t.id + '_serve', 
            type: 'serve', 
            time: t.servedAt, 
            title: `Serving ${t.number}`, 
            subtitle: `Counter ${t.counter}`,
            icon: Activity,
            color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
        });
      }

      if (t.completedAt && t.status === TicketStatus.COMPLETED) {
        events.push({ 
            id: t.id + '_done', 
            type: 'complete', 
            time: t.completedAt, 
            title: `${t.number} Completed`, 
            subtitle: `Duration: ${Math.round((t.completedAt - (t.servedAt || 0))/60000)}m`,
            icon: CheckCircle2,
            color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
        });
      }
    });

    return events.sort((a, b) => b.time - a.time).slice(0, 7);
  }, [tickets]);

  const totalStaff = users.filter(u => u.role === UserRole.STAFF).length;
  const activeStaff = counters.filter(c => c.assignedStaffId).length;
  const staffMembers = users.filter(u => u.role === UserRole.STAFF);

  // ... (existing helper methods remain the same) ...
  const getServiceStats = (serviceId: string) => {
    const serviceTickets = tickets.filter(t => t.serviceId === serviceId);
    const total = serviceTickets.length;
    const servedCount = serviceTickets.filter(t => t.status === TicketStatus.COMPLETED).length;
    const cancelledCount = serviceTickets.filter(t => t.status === TicketStatus.CANCELLED).length;
    const servedOrServing = serviceTickets.filter(t => t.servedAt);
    let avgWait = 0;
    if (servedOrServing.length > 0) {
      const totalWait = servedOrServing.reduce((acc, t) => acc + ((t.servedAt || 0) - t.joinedAt), 0);
      avgWait = Math.round((totalWait / servedOrServing.length) / 60000); 
    }
    const cancelRate = total > 0 ? Math.round((cancelledCount / total) * 100) : 0;
    return { served: servedCount, avgWait, cancelRate, total };
  };

  const getMobileEntryUrl = () => {
    if (localSettings.mobileEntryUrl) return localSettings.mobileEntryUrl;
    const baseUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : 'http://localhost';
    return `${baseUrl}?mode=mobile_entry`;
  };

  const handleDownloadQR = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `nova-qms-qr-${qrSize}px.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setQrLogo(event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  
  // ... (Effect for QR generation remains the same) ...
  useEffect(() => {
    let isMounted = true;

    const generateQR = async () => {
      if (!canvasRef.current || activeTab !== 'integrations') return;

      setIsGeneratingQR(true);
      const url = getMobileEntryUrl();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        await QRCode.toCanvas(canvas, url, {
          width: qrSize,
          margin: 1,
          errorCorrectionLevel: qrEcc,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        if (!isMounted) return;

        if (qrLogo) {
          const img = new Image();
          img.src = qrLogo;
          await new Promise<void>((resolve, reject) => {
             img.onload = () => resolve();
             img.onerror = (e) => reject(e);
          });

          if (!isMounted) return;

          const coverageRatio = 0.22; 
          const logoSize = qrSize * coverageRatio;
          const x = (qrSize - logoSize) / 2;
          const y = (qrSize - logoSize) / 2;

          const bgPadding = qrSize * 0.01;
          const bgSize = logoSize + (bgPadding * 2);
          const bgX = x - bgPadding;
          const bgY = y - bgPadding;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.rect(bgX, bgY, bgSize, bgSize);
          ctx.fill();
          
          ctx.drawImage(img, x, y, logoSize, logoSize);
        }
      } catch (err) {
        console.error('Error generating QR', err);
      } finally {
        if (isMounted) setIsGeneratingQR(false);
      }
    };

    const timer = setTimeout(generateQR, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, localSettings.mobileEntryUrl, qrSize, qrEcc, qrLogo]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(localSettings);
    alert('Settings saved successfully!');
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (newService.name && newService.prefix) {
      onAddService(newService);
      setNewService({ name: '', prefix: '', colorTheme: 'blue', defaultWaitTime: 5 });
    }
  };

  const handleEditServiceClick = (service: ServiceDefinition) => {
    setEditingService(service);
  };

  const handleUpdateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
        onUpdateService(editingService.id, editingService);
        setEditingService(null);
    }
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.username && newUser.password && newUser.name) {
      onAddUser(newUser);
      setNewUser({ username: '', password: '', name: '', role: UserRole.STAFF });
      setIsAddingUser(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditFormData({
        name: user.name,
        username: user.username,
        role: user.role,
        password: ''
    });
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const updates: Partial<User> = {
        name: editFormData.name,
        username: editFormData.username,
        role: editFormData.role
    };
    if (editFormData.password.trim() !== '') {
        updates.password = editFormData.password;
    }
    onUpdateUser(editingUser.id, updates);
    setEditingUser(null);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<User> = {
      name: profileFormData.name,
      username: profileFormData.username
    };
    if (profileFormData.password.trim() !== '') {
      updates.password = profileFormData.password;
    }
    onUpdateUser(currentUser.id, updates);
    alert('Profile updated successfully');
    setProfileFormData(prev => ({ ...prev, password: '' }));
  };
  
  const onDeleteUserConfirm = (id: string) => {
    if(window.confirm('Are you sure you want to delete this user?')) {
        onDeleteUser(id);
    }
  }

  const onDeleteServiceConfirm = (id: string) => {
     if(window.confirm('Are you sure? This will affect existing tickets.')) {
         onDeleteService(id);
     }
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return <Shield className="w-4 h-4 text-purple-500" />;
      case UserRole.STAFF: return <UserIcon className="w-4 h-4 text-blue-500" />;
      case UserRole.DISPLAY: return <Monitor className="w-4 h-4 text-emerald-500" />;
      case UserRole.KIOSK: return <Smartphone className="w-4 h-4 text-amber-500" />;
    }
  };

  const getMaxTicketCount = () => {
      const counts = services.map(s => getServiceStats(s.id).total);
      return Math.max(...counts, 1);
  };
  
  const renderTrafficChart = () => {
      const maxVal = Math.max(...hourlyTraffic, 5); 
      const height = 60;
      const width = 100;
      
      const points = hourlyTraffic.map((val, idx) => {
         const x = (idx / (hourlyTraffic.length - 1)) * width;
         const y = height - ((val / maxVal) * height);
         return `${x},${y}`;
      });
      
      const pathD = `M0,${height} ` + points.map(p => `L${p}`).join(' ');
      const areaD = `${pathD} L${width},${height} Z`;
  
      return (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible preserve-3d">
              <defs>
                  <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" className="text-blue-500" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-blue-500" />
                  </linearGradient>
              </defs>
              <path d={areaD} fill="url(#trafficGradient)" className="transition-all duration-500 ease-in-out" />
              <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 transition-all duration-500 ease-in-out" />
              {points.map((p, i) => (
                  <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="1.5" className="fill-blue-500 transition-all duration-500" />
              ))}
          </svg>
      );
  };

  // ... (return JSX structure remains mostly same until Integrations section) ...
  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 dark:bg-slate-900 text-white flex flex-col flex-shrink-0 shadow-xl
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Content */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-blue-600 rounded-lg w-8 h-8 flex items-center justify-center">Q</span>
            Admin
          </h2>
           <button 
             onClick={toggleTheme}
             className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
           >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
           </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* ... (Nav buttons remain same) ... */}
           <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutGrid className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('services')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'services' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Layers className="w-5 h-5" />
            Services & Queues
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Users className="w-5 h-5" />
            User Management
          </button>
          <button 
            onClick={() => setActiveTab('integrations')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'integrations' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <QrCode className="w-5 h-5" />
            Integrations
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings className="w-5 h-5" />
            My Account
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold text-xs text-white">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate text-white">{currentUser.name}</p>
              <p className="text-xs text-slate-500 truncate">Administrator</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Header */}
        <div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-30">
            <div className="flex items-center gap-2">
                <span className="bg-blue-600 rounded-md w-6 h-6 flex items-center justify-center text-xs font-bold">Q</span>
                <span className="font-bold">Nova QMS</span>
            </div>
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1 rounded hover:bg-slate-800"
            >
                <Menu className="w-6 h-6" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
            
            {activeTab === 'dashboard' && (
                <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time system performance for today.</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                             </span>
                        </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { title: 'Staff Active', value: `${activeStaff}/${totalStaff}`, icon: UserIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                          { title: 'Waiting Now', value: tickets.filter(t => t.status === TicketStatus.WAITING).length, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                          { title: 'Served Today', value: tickets.filter(t => t.status === TicketStatus.COMPLETED).length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                          { title: 'Avg Wait', value: `${tickets.length > 0 ? '4' : '0'}m`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' }
                        ].map((metric, i) => (
                           <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-32 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
                                   <metric.icon className={`w-16 h-16 ${metric.color}`} />
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{metric.title}</p>
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{metric.value}</h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                   <div className={`w-2 h-2 rounded-full ${metric.color.replace('text-', 'bg-')}`}></div>
                                   <span className="text-xs text-slate-400">Live Metric</span>
                                </div>
                           </div>
                        ))}
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Traffic Trend Chart - Span 2 Cols */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-blue-500" />
                                    Traffic Volume (09:00 - 18:00)
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Tickets Joined</span>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[200px] w-full relative">
                                {renderTrafficChart()}
                                <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                                    <span>09:00</span>
                                    <span>11:00</span>
                                    <span>13:00</span>
                                    <span>15:00</span>
                                    <span>17:00</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col h-[340px]">
                             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-slate-400" />
                                Recent Activity
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {recentActivity.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p className="text-sm">No activity yet today</p>
                                    </div>
                                ) : (
                                    recentActivity.map((event) => (
                                        <div key={event.id} className="flex gap-3 items-start animate-in slide-in-from-right-2 fade-in duration-300">
                                            <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.color}`}>
                                                <event.icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{event.title}</p>
                                                <p className="text-xs text-slate-500 truncate">{event.subtitle}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                {new Date(event.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                     {/* ... (Service Performance & Live Status widgets remain same) ... */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Service Performance */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-slate-400" />
                                Service Performance
                            </h3>
                            <div className="space-y-5">
                                {services.map(service => {
                                    const stats = getServiceStats(service.id);
                                    const max = getMaxTicketCount();
                                    const widthPercentage = Math.max(5, (stats.total / max) * 100);
                                    const theme = COLOR_THEMES.find(t => t.value === service.colorTheme) || COLOR_THEMES[0];
                                    const barColor = theme.classes.split(' ')[0].replace('bg-', 'bg-');
                                    
                                    return (
                                        <div key={service.id} className="relative group">
                                            <div className="flex justify-between items-end mb-2">
                                                <div>
                                                    <span className="font-bold text-sm text-slate-800 dark:text-white block">{service.name}</span>
                                                    <span className="text-[10px] text-slate-500">Avg Wait: {stats.avgWait}m <span className="text-slate-400">(Default: {service.defaultWaitTime || 5}m)</span></span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-sm text-slate-800 dark:text-white">{stats.total}</span>
                                                    <span className="text-[10px] text-slate-500 block">tickets</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}-500`}
                                                    style={{ width: `${widthPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Live Counter & Staff Status Widget */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Monitor className="w-5 h-5 text-slate-400" />
                                    Live Status
                                </h3>
                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                                    <button 
                                        onClick={() => setStatusWidgetView('counters')}
                                        className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${statusWidgetView === 'counters' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Counters
                                    </button>
                                    <button 
                                        onClick={() => setStatusWidgetView('staff')}
                                        className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${statusWidgetView === 'staff' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Staff
                                    </button>
                                </div>
                            </div>
                            
                            {statusWidgetView === 'counters' && (
                                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                                    {counters.map(counter => {
                                        const isStaffed = !!counter.assignedStaffId;
                                        const staffName = users.find(u => u.id === counter.assignedStaffId)?.name || 'Unknown';
                                        
                                        return (
                                            <div key={counter.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${
                                                        counter.isOpen 
                                                            ? isStaffed ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                                                            : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                                    }`}>
                                                        {counter.id}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Counter {counter.id}</p>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                                            {counter.isOpen 
                                                                ? (isStaffed ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {staffName}</> : <><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Unstaffed</>) 
                                                                : <><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Closed</>}
                                                        </p>
                                                    </div>
                                                </div>
                                                {counter.currentTicketId && (
                                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-bold">
                                                        Busy
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {statusWidgetView === 'staff' && (
                                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                                    {staffMembers.map(staff => {
                                        const assignment = counters.find(c => c.assignedStaffId === staff.id);
                                        const isActive = !!assignment;

                                        return (
                                            <div key={staff.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${
                                                        isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                                    }`}>
                                                        {staff.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{staff.name}</p>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                                            {isActive 
                                                                ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online (Counter {assignment.id})</>
                                                                : <><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Offline / Idle</>
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                {isActive && (
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {staffMembers.length === 0 && (
                                        <div className="text-center text-slate-400 text-xs py-4">No staff members found.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* INTEGRATIONS */}
            {activeTab === 'integrations' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations & Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400">Configure external connections, mobile entry, and shop timings.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Shop Timing Config */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:col-span-2">
                         {/* ... (Existing timing config) ... */}
                         <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Operating Hours</h3>
                                <p className="text-xs text-slate-500">Set the time window for queue ticket issuance</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Opening Time</label>
                                <input 
                                    type="time" 
                                    value={localSettings.operatingHours?.start || "09:00"}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings, 
                                        operatingHours: { ...localSettings.operatingHours, start: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Closing Time</label>
                                <input 
                                    type="time" 
                                    value={localSettings.operatingHours?.end || "17:00"}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings, 
                                        operatingHours: { ...localSettings.operatingHours, end: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-3 pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={localSettings.operatingHours?.enabled ?? true}
                                        onChange={(e) => setLocalSettings({
                                            ...localSettings, 
                                            operatingHours: { ...localSettings.operatingHours, enabled: e.target.checked }
                                        })}
                                        className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enforce Hours</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* QR Code Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:col-span-2">
                         {/* ... (Existing QR code section content) ... */}
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Mobile Entry QR Code</h3>
                                <p className="text-xs text-slate-500">Design and download the entry QR code</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           {/* Left: Configuration */}
                           <div className="space-y-6">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Download Resolution (px)</label>
                                <input 
                                  type="range" 
                                  min="200" 
                                  max="2000" 
                                  step="50"
                                  value={qrSize}
                                  onChange={(e) => setQrSize(parseInt(e.target.value))}
                                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-2">
                                  <span>200px</span>
                                  <span className="font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{qrSize}px</span>
                                  <span>2000px</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Error Correction</label>
                                    <select 
                                    value={qrEcc}
                                    onChange={(e) => setQrEcc(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                    >
                                    <option value="L">Low (7%)</option>
                                    <option value="M">Medium (15%)</option>
                                    <option value="Q">Quartile (25%)</option>
                                    <option value="H">High (30%)</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <p className="text-xs text-slate-400 mb-2.5 leading-tight">
                                        Use <strong>High</strong> if embedding a logo to ensure scannability.
                                    </p>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Embed Center Logo</label>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm flex items-center justify-center gap-2 transition"
                                  >
                                    <Upload className="w-4 h-4" /> 
                                    {qrLogo ? 'Change Image' : 'Upload Image'}
                                  </button>
                                  {qrLogo && (
                                    <button 
                                      onClick={() => setQrLogo(null)}
                                      className="px-4 py-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 border border-red-100 dark:border-red-900/20 rounded-xl text-sm transition"
                                      title="Remove Logo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleLogoUpload} 
                                    className="hidden" 
                                    accept="image/*"
                                  />
                                </div>
                              </div>
                              
                              <div className="pt-4 space-y-3">
                                <button 
                                  onClick={handleDownloadQR}
                                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
                                >
                                  <Download className="w-4 h-4" /> Download QR Code ({qrSize}px)
                                </button>
                                
                                <div className="flex gap-2">
                                    <a 
                                        href={getMobileEntryUrl()}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <LinkIcon className="w-4 h-4" /> Open Link
                                    </a>
                                </div>
                              </div>
                           </div>

                           {/* Right: Preview Area */}
                           <div className="flex flex-col gap-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Preview</label>
                                <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden min-h-[350px]">
                                    <div className="relative shadow-xl rounded-lg overflow-hidden bg-white max-w-full">
                                        <canvas 
                                            ref={canvasRef} 
                                            className="block h-auto w-full max-w-[300px] max-h-[300px] object-contain"
                                        />
                                        {isGeneratingQR && (
                                            <div className="absolute inset-0 bg-white/80 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-center text-xs text-slate-400 mt-2">
                                    Preview is scaled to fit. Downloaded file will be {qrSize}x{qrSize}px.
                                </p>
                           </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Custom Mobile Entry URL</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={localSettings.mobileEntryUrl || ''}
                                            onChange={(e) => setLocalSettings({...localSettings, mobileEntryUrl: e.target.value})}
                                            placeholder="https://your-domain.com/queue?mode=mobile_entry"
                                            className="w-full pl-3 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Leave blank to use the default system URL.</p>
                                    </div>
                                </div>

                                <label className="flex items-center justify-between cursor-pointer group p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                    <div>
                                        <span className="block text-sm font-medium text-slate-800 dark:text-white">Enable Mobile Entry</span>
                                        <span className="block text-xs text-slate-500">Allow customers to join queue without kiosk</span>
                                    </div>
                                    <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                        <input 
                                            type="checkbox" 
                                            checked={localSettings.allowMobileEntry}
                                            onChange={(e) => setLocalSettings({...localSettings, allowMobileEntry: e.target.checked})}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-indigo-600 checked:bg-indigo-600 right-4"
                                        />
                                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.allowMobileEntry ? 'bg-indigo-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Config Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:col-span-2">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">WhatsApp & Communication</h3>
                                <p className="text-xs text-slate-500">Configure messaging and region settings</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            {/* New Country Code Input */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Default Country Code</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={localSettings.countryCode}
                                        onChange={(e) => setLocalSettings({...localSettings, countryCode: e.target.value})}
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="+1"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">This code will be pre-filled on the kiosk screen.</p>
                            </div>

                             <div>
                                <label className="flex items-center justify-between cursor-pointer group mb-4">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable WhatsApp Feature</span>
                                    <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                        <input 
                                            type="checkbox" 
                                            checked={localSettings.whatsappEnabled}
                                            onChange={(e) => setLocalSettings({...localSettings, whatsappEnabled: e.target.checked})}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-emerald-500 checked:bg-emerald-500 right-4"
                                        />
                                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.whatsappEnabled ? 'bg-emerald-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                                    </div>
                                </label>
                                
                                <label className="flex items-center justify-between cursor-pointer group mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <div>
                                        <span className="block text-sm font-medium text-slate-800 dark:text-white">Automatic 15-Min Warning</span>
                                        <span className="block text-xs text-slate-500">Automatically send text when estimated wait is ~15m</span>
                                    </div>
                                    <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                        <input 
                                            type="checkbox" 
                                            checked={localSettings.autoNotify15m}
                                            onChange={(e) => setLocalSettings({...localSettings, autoNotify15m: e.target.checked})}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-emerald-500 checked:bg-emerald-500 right-4"
                                        />
                                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${localSettings.autoNotify15m ? 'bg-emerald-200' : 'bg-slate-200 dark:bg-slate-600'}`}></label>
                                    </div>
                                </label>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">WhatsApp API Key</label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input
                                                type="password"
                                                value={localSettings.whatsappApiKey || ''}
                                                onChange={(e) => setLocalSettings({...localSettings, whatsappApiKey: e.target.value})}
                                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="Enter API Key provided by your backend/provider"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Required for automatic notifications.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Message Template</label>
                                        <textarea
                                            value={localSettings.whatsappTemplate}
                                            onChange={(e) => setLocalSettings({...localSettings, whatsappTemplate: e.target.value})}
                                            rows={4}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Enter message..."
                                        />
                                        <p className="text-xs text-slate-400 leading-relaxed mt-1">
                                            Variables: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{name}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{number}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{service}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{counter}`}</code>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-2">Preview:</h4>
                                <p className="text-sm text-emerald-900 dark:text-emerald-100 italic">
                                    "{localSettings.whatsappTemplate
                                        .replace('{name}', 'John Doe')
                                        .replace('{number}', 'A042')
                                        .replace('{service}', 'Bill Payment')
                                        .replace('{counter}', '3')}"
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
                
                {/* Sticky Save Button for Integrations Tab */}
                <div className="flex justify-end pt-4 pb-20 md:pb-0">
                    <button 
                    onClick={handleSaveSettings}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
                    >
                        <Save className="w-5 h-5" /> Save All Settings
                    </button>
                </div>
            </div>
            )}
            
            {/* Services Management */}
            {activeTab === 'services' && (
              // ... (Same as before) ...
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* ... (Same as before) ... */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add New Service
                </h3>
                <form onSubmit={handleCreateService} className="flex flex-col md:flex-row gap-4 md:items-end bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Service Name</label>
                    <input 
                        required
                        value={newService.name}
                        onChange={e => setNewService({...newService, name: e.target.value})}
                        placeholder="e.g. Card Collection" 
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" 
                    />
                    </div>
                    <div className="w-full md:w-24">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Prefix</label>
                    <input 
                        required
                        maxLength={1}
                        value={newService.prefix}
                        onChange={e => setNewService({...newService, prefix: e.target.value.toUpperCase()})}
                        placeholder="X" 
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm uppercase text-center" 
                    />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Default Wait (m)</label>
                        <input 
                            type="number"
                            min="1"
                            value={newService.defaultWaitTime || ''}
                            onChange={e => setNewService({...newService, defaultWaitTime: parseInt(e.target.value) || 5})}
                            placeholder="5" 
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center" 
                        />
                    </div>
                    <div className="w-full md:w-40">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Color Theme</label>
                    <select 
                        value={newService.colorTheme}
                        onChange={e => setNewService({...newService, colorTheme: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    >
                        {COLOR_THEMES.map(theme => (
                        <option key={theme.value} value={theme.value}>{theme.name}</option>
                        ))}
                    </select>
                    </div>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 w-full md:w-auto">
                    Add
                    </button>
                </form>

                <div className="mt-8 space-y-3">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Active Services</h3>
                    {services.map(service => {
                    const theme = COLOR_THEMES.find(t => t.value === service.colorTheme) || COLOR_THEMES[0];
                    const stats = getServiceStats(service.id);
                    return (
                        <div key={service.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition bg-white dark:bg-slate-800 group gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${theme.classes.split(' ')[0]} ${theme.classes.split(' ')[1]}`}>
                            {service.prefix}
                            </div>
                            <div>
                            <h4 className="font-bold text-slate-800 dark:text-white">{service.name}</h4>
                            <p className="text-xs text-slate-400">ID: {service.id}</p>
                            </div>
                        </div>

                        {/* Service Stats Display */}
                        <div className="flex items-center gap-4 md:gap-8 md:px-4 text-xs md:text-sm">
                            <div className="text-center group-hover:scale-105 transition-transform">
                                <div className="flex items-center gap-1 justify-center text-slate-400 mb-0.5">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] uppercase tracking-wider">Wait</span>
                                </div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">{stats.avgWait}m <span className="text-slate-400 text-[10px] font-normal">(Def: {service.defaultWaitTime || 5}m)</span></p>
                            </div>
                            <div className="text-center group-hover:scale-105 transition-transform">
                                <div className="flex items-center gap-1 justify-center text-slate-400 mb-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px] uppercase tracking-wider">Served</span>
                                </div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">{stats.served}</p>
                            </div>
                            <div className="text-center group-hover:scale-105 transition-transform">
                                <div className="flex items-center gap-1 justify-center text-slate-400 mb-0.5">
                                <XCircle className="w-3 h-3" />
                                <span className="text-[10px] uppercase tracking-wider">Cancel</span>
                                </div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">{stats.cancelRate}%</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                            <button 
                                onClick={() => handleEditServiceClick(service)}
                                className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                title="Edit Service"
                            >
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => onDeleteServiceConfirm(service.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Delete Service"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                        </div>
                    );
                    })}
                </div>
                </div>
              </div>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
             // ... (Same as before) ...
             <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* ... (Same as before) ... */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Registered Accounts</h3>
                    <button 
                        onClick={() => setIsAddingUser(!isAddingUser)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" /> Add User
                    </button>
                    </div>
                    
                    {isAddingUser && (
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20 animate-in slide-in-from-top-2">
                        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Display Name</label>
                            <input required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" placeholder="e.g. Front Desk 1" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Username / ID</label>
                            <input required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" placeholder="e.g. staff01" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Password</label>
                            <input required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} type="text" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" placeholder="Password" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Role</label>
                            <select 
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                            >
                            <option value={UserRole.STAFF}>Counter Staff</option>
                            <option value={UserRole.KIOSK}>Kiosk Screen</option>
                            <option value={UserRole.DISPLAY}>TV Display</option>
                            <option value={UserRole.ADMIN}>Administrator</option>
                            </select>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Create Account</button>
                        </div>
                        </form>
                    </div>
                    )}

                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {users.map(user => (
                        <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            {getRoleIcon(user.role)}
                            </div>
                            <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{user.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">@{user.username} • {user.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleEditClick(user)}
                                className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                title="Edit User"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            {user.id !== currentUser.id && (
                            <button 
                                onClick={() => onDeleteUserConfirm(user.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Delete User"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            )}
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
             </div>
            )}

            {/* Profile */}
            {activeTab === 'profile' && (
             // ... (Same as before) ...
             <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* ... (Same as before) ... */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xl font-bold">
                        {currentUser.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{currentUser.name}</h3>
                        <p className="text-slate-500 dark:text-slate-400">Role: {currentUser.role}</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                        <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
                        <input 
                            type="text"
                            value={profileFormData.name}
                            onChange={e => setProfileFormData({...profileFormData, name: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username / ID</label>
                        <input 
                            type="text"
                            value={profileFormData.username}
                            onChange={e => setProfileFormData({...profileFormData, username: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                        <input 
                            type="password"
                            value={profileFormData.password}
                            onChange={e => setProfileFormData({...profileFormData, password: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            placeholder="Leave blank to keep current"
                        />
                        </div>
                        <button 
                        type="submit" 
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                        >
                        Save Changes
                        </button>
                    </form>
                </div>
             </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-100 dark:border-slate-700">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-700 dark:text-white">Edit User</h3>
                    <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSaveEditUser} className="p-6 space-y-4">
                    {/* ... (Same as before) ... */}
                    <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Display Name</label>
                    <input 
                        required 
                        value={editFormData.name} 
                        onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" 
                    />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Username / ID</label>
                        <input 
                        required 
                        value={editFormData.username} 
                        onChange={e => setEditFormData({...editFormData, username: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
                        <input 
                        type="text"
                        value={editFormData.password} 
                        onChange={e => setEditFormData({...editFormData, password: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" 
                        placeholder="Leave blank to keep current"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Role</label>
                        <select 
                            value={editFormData.role}
                            onChange={e => setEditFormData({...editFormData, role: e.target.value as UserRole})}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                        >
                            <option value={UserRole.STAFF}>Counter Staff</option>
                            <option value={UserRole.KIOSK}>Kiosk Screen</option>
                            <option value={UserRole.DISPLAY}>TV Display</option>
                            <option value={UserRole.ADMIN}>Administrator</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
                </div>
            </div>
            )}

            {/* Edit Service Modal */}
            {editingService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-100 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-700 dark:text-white">Edit Service</h3>
                            <button onClick={() => setEditingService(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateService} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Service Name</label>
                                <input 
                                    required
                                    value={editingService.name}
                                    onChange={e => setEditingService({...editingService, name: e.target.value})}
                                    placeholder="e.g. Card Collection" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Prefix</label>
                                <input 
                                    required
                                    maxLength={1}
                                    value={editingService.prefix}
                                    onChange={e => setEditingService({...editingService, prefix: e.target.value.toUpperCase()})}
                                    placeholder="X" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm uppercase text-center" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Default Wait (m)</label>
                                <input 
                                    type="number"
                                    min="1"
                                    value={editingService.defaultWaitTime || ''}
                                    onChange={e => setEditingService({...editingService, defaultWaitTime: parseInt(e.target.value) || 5})}
                                    placeholder="5" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm text-center" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Color Theme</label>
                                <select 
                                    value={editingService.colorTheme}
                                    onChange={e => setEditingService({...editingService, colorTheme: e.target.value})}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                >
                                    {COLOR_THEMES.map(theme => (
                                    <option key={theme.value} value={theme.value}>{theme.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setEditingService(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
