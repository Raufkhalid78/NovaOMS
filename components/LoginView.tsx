
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Lock, ArrowRight, ShieldCheck, Moon, Sun, KeyRound, ArrowLeft } from 'lucide-react';

interface LoginViewProps {
  onLogin: (username: string, pass: string, rememberMe: boolean) => Promise<boolean>;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, toggleTheme, isDarkMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New state for reset password view
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetSubmitted, setResetSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await onLogin(username, password, rememberMe);
      if (!success) {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
        setLoading(false);
        setResetSubmitted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-blue-600/20 blur-[100px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-400/20 dark:bg-purple-600/20 blur-[80px]"></div>
      </div>

      <div className="absolute top-4 right-4 z-20">
         <button 
           onClick={toggleTheme}
           className="p-3 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-slate-700 dark:text-white backdrop-blur-md transition-all border border-slate-200 dark:border-white/10"
         >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
         </button>
      </div>

      <div className="z-10 w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl dark:shadow-black/50 overflow-hidden transition-colors duration-300 border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 text-center border-b border-slate-100 dark:border-slate-700">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Nova QMS</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {isResetMode ? 'Account Recovery' : 'Secure Access Portal'}
          </p>
        </div>

        {isResetMode ? (
            /* Reset Password Form */
            <div className="p-6 md:p-8 space-y-6 animate-in slide-in-from-right duration-300">
                {resetSubmitted ? (
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Request Sent</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            If an account exists for <span className="font-semibold text-slate-700 dark:text-slate-300">{resetUsername}</span>, your administrator has been notified to reset your credentials.
                        </p>
                        <button 
                            onClick={() => { setIsResetMode(false); setResetSubmitted(false); setResetUsername(''); }}
                            className="w-full mt-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold py-3 rounded-xl transition-all"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleResetSubmit} className="space-y-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            Enter your username or ID. We will notify the system administrator to reset your password.
                        </p>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username / ID</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="text"
                                    value={resetUsername}
                                    onChange={(e) => setResetUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Enter your ID"
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Send Reset Request'}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setIsResetMode(false)}
                            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </button>
                    </form>
                )}
            </div>
        ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 animate-in slide-in-from-left duration-300">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 text-sm rounded-lg text-center font-medium animate-in fade-in">
                {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username / ID</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Enter your ID"
                    required
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="••••••••"
                    required
                    />
                </div>
                </div>
                
                <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400">
                    Keep me signed in
                    </label>
                </div>
                <button 
                    type="button"
                    onClick={() => setIsResetMode(true)}
                    className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                    Forgot Password?
                </button>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                <>
                    Sign In <ArrowRight className="w-5 h-5" />
                </>
                )}
            </button>
            </form>
        )}
      </div>
    </div>
  );
};
