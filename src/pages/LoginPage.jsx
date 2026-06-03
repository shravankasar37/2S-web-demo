import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Gem } from 'lucide-react';
import { supabase, setSessionPersistence } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      triggerShake("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Configure dynamic storage persistence before calling signIn
      setSessionPersistence(keepLoggedIn);

      // Perform auth sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        let msg = authError.message;
        if (msg.includes("Invalid login credentials")) {
          msg = "Invalid credentials. If this is a new Supabase project, make sure to add this merchant user in your Supabase Dashboard -> Authentication -> Users (store@ganesh.com / Ganesh2026!).";
        }
        triggerShake(msg);
      }
    } catch (err) {
      triggerShake(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = (msg) => {
    setError(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleQuickFill = () => {
    setEmail('store@ganesh.com');
    setPassword('Ganesh2026!');
    setError('');
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#fcf9f8]"
      style={{
        backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"800\" viewBox=\"0 0 100 100\" opacity=\"0.02\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"none\" stroke=\"%23735c00\" stroke-width=\"0.5\"/><path d=\"M50 10 L50 90 M10 50 L90 50\" stroke=\"%23735c00\" stroke-width=\"0.3\"/></svg>')",
        backgroundPosition: 'center',
        backgroundSize: '800px',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-[#570000]/3 opacity-[0.02] pointer-events-none" />

      {/* Main Glassmorphic Card Container */}
      <div 
        className={`w-full max-w-md bg-[#570000] border-2 border-[#735c00]/40 rounded-3xl p-8 md:p-10 shadow-2xl text-[#fcf9f8] relative z-10 transition-all duration-300 ${
          isShaking ? 'animate-bounce' : ''
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(87, 0, 0, 0.4), 0 0 40px rgba(115, 92, 0, 0.15)',
        }}
      >
        {/* Shree Ganesh circular logo badge */}
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-[#735c00]/25 border-2 border-[#fed65b]/60 flex flex-col items-center justify-center animate-pulse">
            <span className="font-serif text-[10px] text-[#fed65b] font-bold leading-none">SHREE</span>
            <Gem className="h-5 w-5 text-[#fed65b] my-0.5" />
            <span className="font-serif text-[9px] text-[#fed65b] font-bold leading-none">GANESH</span>
          </div>
        </div>

        {/* Brand Typography */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-xl md:text-2xl text-[#fed65b] tracking-wider font-bold mb-1 uppercase">
            SHREE GANESH JEWELLERS
          </h1>
          <p className="text-[9px] text-[#fcf9f8]/60 tracking-wider font-bold uppercase">
            Shop No. 01, Tirupati Garden, Sector 20, Kamothe
          </p>
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#fed65b]/40 to-transparent mx-auto mt-3" />
        </div>

        {/* Sandbox quick testing panel */}
        <div className="mb-6 p-4 rounded-2xl bg-[#735c00]/20 border border-[#fed65b]/30 text-center">
          <p className="text-xs text-[#fed65b] font-medium uppercase tracking-wider mb-1">
            ✨ Merchant Portal Access ✨
          </p>
          <p className="text-[10px] text-[#fcf9f8]/80 mb-3 leading-relaxed">
            Quick-fill credentials below to authenticate. Make sure user exists in Supabase.
          </p>
          <button
            type="button"
            onClick={handleQuickFill}
            className="px-3 py-1.5 rounded-lg bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] text-xs font-bold transition-all transform active:scale-95 cursor-pointer"
          >
            Quick-Fill Credentials
          </button>
        </div>

        {/* Credential Entry Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#fed65b]/80 mb-1">
              Merchant Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="store@ganesh.com"
              className="w-full bg-[#370000]/40 border border-[#735c00]/30 rounded-xl px-4 py-2.5 text-sm text-[#fcf9f8] placeholder-[#fcf9f8]/30 focus:outline-none focus:border-[#fed65b] transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#fed65b]/80 mb-1">
              Secure Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#370000]/40 border border-[#735c00]/30 rounded-xl px-4 py-2.5 text-sm text-[#fcf9f8] placeholder-[#fcf9f8]/30 focus:outline-none focus:border-[#fed65b] pr-10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#fed65b]/60 hover:text-[#fed65b] transition-all"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Keep me logged in checkbox */}
          <div className="flex items-center gap-2 py-1 select-none">
            <input
              type="checkbox"
              id="keep_logged_in"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              className="accent-[#fed65b] h-4 w-4 cursor-pointer"
            />
            <label htmlFor="keep_logged_in" className="text-xs text-[#fcf9f8]/80 cursor-pointer hover:text-white">
              Keep me logged in
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30">
              <p className="text-[11px] text-red-300 leading-relaxed text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] font-bold text-sm tracking-widest uppercase transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#570000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Decrypting...
              </>
            ) : (
              <>
                Open Sacred Ledger
                <Lock className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-[#735c00]/30 flex items-center justify-center gap-2 text-[#fcf9f8]/60 text-[9px] uppercase tracking-widest">
          <ShieldCheck className="h-3.5 w-3.5 text-[#fed65b]" />
          <span>AES-256 Encrypted Session Access</span>
        </div>
      </div>
    </div>
  );
}
