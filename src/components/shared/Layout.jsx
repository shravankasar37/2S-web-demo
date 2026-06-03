import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/databaseService';
import { 
  LogOut, PlusCircle, Gem, Calendar, ShieldCheck, 
  BookOpen, BarChart3, Package, Coins, Search, UserCheck
} from 'lucide-react';

export default function Layout({ children }) {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [rates, setRates] = useState({ rate24k: 76500, rate22k: 70150, rate18k: 57380, rate_silver: 920 });
  const [showEditRates, setShowEditRates] = useState(false);
  
  // Rate edit fields
  const [temp24k, setTemp24k] = useState('');
  const [temp22k, setTemp22k] = useState('');
  const [temp18k, setTemp18k] = useState('');
  const [tempSilver, setTempSilver] = useState('');

  const fetchRates = async () => {
    const { data } = await db.getLatestRates();
    if (data) {
      setRates(data);
      setTemp24k(data.rate24k.toString());
      setTemp22k(data.rate22k.toString());
      setTemp18k(data.rate18k.toString());
      setTempSilver(data.rate_silver.toString());
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRates();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSaveRates = async (e) => {
    e.preventDefault();
    const r24 = parseFloat(temp24k);
    const r22 = parseFloat(temp22k);
    const r18 = parseFloat(temp18k);
    const rSil = parseFloat(tempSilver);

    if (isNaN(r24) || isNaN(r22) || isNaN(r18) || isNaN(rSil)) {
      alert('Please enter valid numeric rates.');
      return;
    }

    const { error } = await db.saveRates(r24, r22, r18, rSil);
    if (!error) {
      setRates({ rate24k: r24, rate22k: r22, rate18k: r18, rate_silver: rSil });
      setShowEditRates(false);
      // Trigger a page refresh to update bill items calculations if on billing page
      window.dispatchEvent(new CustomEvent('rates-updated', { detail: { rate24k: r24, rate22k: r22, rate18k: r18, rate_silver: rSil } }));
    } else {
      alert('Failed to save rates: ' + error.message);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to secure and lock the ledger and log out?")) {
      signOut();
      navigate('/');
    }
  };

  const activeDateString = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Gem },
    { name: 'Sales Ledger', path: '/billing', icon: BookOpen },
    { name: 'Showroom Stock', path: '/stock', icon: Package },
    { name: 'Saving Schemes', path: '/savings', icon: UserCheck },
    { name: 'Gold Loans', path: '/loans', icon: Coins },
    { name: 'Audit Reports', path: '/reports', icon: BarChart3 },
    { name: 'Customer Search', path: '/search', icon: Search }
  ];

  return (
    <div className="min-h-screen bg-[#fcf9f8] pb-12 font-sans relative">
      {/* Top Brand Banner Header */}
      <header className="bg-[#570000] border-b-2 border-[#735c00]/40 text-[#fcf9f8] px-4 py-3 md:px-6 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo brand text */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="h-9 w-9 rounded-full bg-[#735c00]/30 border border-[#fed65b]/40 flex flex-col items-center justify-center">
              <span className="font-serif text-[7px] text-[#fed65b] font-bold leading-none">S</span>
              <Gem className="h-3 w-3 text-[#fed65b] my-0.5" />
              <span className="font-serif text-[7px] text-[#fed65b] font-bold leading-none">G</span>
            </div>
            <div>
              <h1 className="font-serif text-sm md:text-base font-black text-[#fed65b] tracking-wider uppercase leading-none">
                SHREE GANESH JEWELLERS
              </h1>
              <p className="font-serif text-[7px] text-[#fcf9f8]/60 tracking-[0.2em] uppercase mt-0.5">
                Heritage Shop Ledger
              </p>
            </div>
          </div>

          {/* Active stats and trigger actions */}
          <div className="flex items-center gap-2 text-xs font-sans">
            <button
              onClick={() => navigate('/billing')}
              className="px-3 py-1.5 bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] font-bold uppercase tracking-wider text-[9px] rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Bill
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-950/40 text-[#fcf9f8]/80 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition-all flex items-center justify-center cursor-pointer"
              title="Lock Ledger"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Real-time Ticker Banner */}
      <section className="bg-white border-b border-[#735c00]/10 py-2.5 px-4 shadow-sm z-20 sticky top-[58px]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="h-3.5 w-3.5 text-[#735c00]" />
              <span className="font-bold text-[#570000]">{activeDateString}</span>
            </div>
            <div className="hidden sm:block h-3.5 w-[1px] bg-gray-200" />
            
            {/* Live rates values */}
            <div className="flex items-center gap-4 text-[11px] font-bold text-gray-700">
              <span className="flex items-center gap-1">
                Gold 24K (10g): <strong className="text-[#570000]">₹{rates.rate24k.toLocaleString('en-IN')}</strong>
              </span>
              <span className="flex items-center gap-1">
                Gold 22K (10g): <strong className="text-[#570000]">₹{rates.rate22k.toLocaleString('en-IN')}</strong>
              </span>
              <span className="flex items-center gap-1">
                Gold 18K (10g): <strong className="text-[#570000]">₹{rates.rate18k.toLocaleString('en-IN')}</strong>
              </span>
              <span className="flex items-center gap-1">
                Silver (1kg): <strong className="text-gray-500">₹{(rates.rate_silver * 1000).toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditRates(true)}
              className="px-2.5 py-1 text-[9px] bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/20 rounded-md font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Update Bazar Rates
            </button>
            <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold text-[8px] uppercase tracking-wider border border-green-200 flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" />
              Connected
            </span>
          </div>

        </div>
      </section>

      {/* Sidebar + Main Grid Layout */}
      <div className="max-w-7xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-6 gap-6">
        
        {/* Navigation Sidebar Panel (desktop only) */}
        <aside className="lg:col-span-1 hidden lg:block space-y-2">
          <div className="bg-white border border-[#735c00]/15 rounded-3xl p-4 shadow-sm space-y-1">
            <h4 className="text-[10px] uppercase font-black tracking-widest text-[#735c00] px-3 mb-3">
              Core Registry
            </h4>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    isActive 
                      ? 'bg-[#570000] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-[#fed65b]' : 'text-gray-400'}`} />
                  {item.name}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Navigation tabs layout (tablet & mobile view top header) */}
        <div className="lg:hidden flex bg-white border border-[#735c00]/10 rounded-2xl p-1 shadow-sm text-[10px] font-bold uppercase tracking-wider overflow-x-auto gap-1 no-print">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-[#570000] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#fed65b]' : 'text-gray-400'}`} />
                {item.name}
              </button>
            );
          })}
        </div>

        {/* Content Box */}
        <main className="lg:col-span-5 space-y-6">
          {children}
        </main>

      </div>

      {/* Edit Rates Modal Sheet */}
      {showEditRates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#570000] px-5 py-3 border-b border-[#735c00]/30 text-white flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-[#fed65b] tracking-wider flex items-center gap-2">
                <Gem className="h-4.5 w-4.5 animate-pulse text-[#fed65b]" />
                Update Bazar Rates
              </h3>
              <button 
                type="button" 
                onClick={() => setShowEditRates(false)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRates} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Gold 24K Rate (Per 10 Grams)
                </label>
                <input
                  type="number"
                  required
                  value={temp24k}
                  onChange={(e) => setTemp24k(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#570000] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Gold 22K Rate (Per 10 Grams)
                </label>
                <input
                  type="number"
                  required
                  value={temp22k}
                  onChange={(e) => setTemp22k(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#570000] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Gold 18K Rate (Per 10 Grams)
                </label>
                <input
                  type="number"
                  required
                  value={temp18k}
                  onChange={(e) => setTemp18k(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#570000] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Silver Rate (Per 1 Gram)
                </label>
                <input
                  type="number"
                  required
                  value={tempSilver}
                  onChange={(e) => setTempSilver(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#570000] font-mono font-bold"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditRates(false)}
                  className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Save Updates
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
