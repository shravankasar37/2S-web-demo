import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { 
  PlusCircle, BookOpen, Package, UserCheck, Coins, 
  BarChart3, Search, TrendingUp, DollarSign, RefreshCcw,
  MessageSquare, CheckCircle2, Bell, ExternalLink
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [financials, setFinancials] = useState({
    cash: 0,
    upi: 0,
    card: 0,
    netbanking: 0,
    buybackOutflow: 0,
    totalInflow: 0,
    netCashDrawer: 0
  });
  const [loading, setLoading] = useState(true);
  const [pendingSchemes, setPendingSchemes] = useState([]);
  const [loadingSchemes, setLoadingSchemes] = useState(true);

  async function fetchTodayFinancials() {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: invoices } = await db.getInvoices();
      const { data: buybacks } = await db.getUrdTransactions();

      let cash = 0;
      let upi = 0;
      let card = 0;
      let netbanking = 0;
      let buybackOutflow = 0;

      // Aggregates split payments from today's invoices
      if (invoices && Array.isArray(invoices)) {
        invoices.forEach(inv => {
          if (inv.payments && Array.isArray(inv.payments)) {
            inv.payments.forEach(p => {
              const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
              if (pDate === todayStr) {
                const amt = Number(p.amount) || 0;
                const mode = p.payment_mode ? p.payment_mode.toLowerCase() : '';
                if (mode === 'cash') cash += amt;
                else if (mode === 'upi') upi += amt;
                else if (mode === 'card') card += amt;
                else if (mode === 'netbanking') netbanking += amt;
              }
            });
          }
        });
      }

      // Aggregates buyback outlays from today's URD transactions
      if (buybacks && Array.isArray(buybacks)) {
        buybacks.forEach(bb => {
          const bbDate = bb.transaction_date ? bb.transaction_date.split('T')[0] : '';
          if (bbDate === todayStr && bb.transaction_type === 'buyback') {
            buybackOutflow += Number(bb.total_value) || 0;
          }
        });
      }

      const totalInflow = cash + upi + card + netbanking;
      const netCashDrawer = Math.max(0, cash - buybackOutflow);

      setFinancials({
        cash,
        upi,
        card,
        netbanking,
        buybackOutflow,
        totalInflow,
        netCashDrawer
      });
    } catch (e) {
      console.error('Error fetching today financials:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingSchemes() {
    setLoadingSchemes(true);
    try {
      const { data } = await db.getSavingSchemes();
      if (data && Array.isArray(data)) {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const unpaidList = data.filter(scheme => {
          if (scheme.status !== 'active') return false;
          
          const hasUnpaid = scheme.scheme_payments?.some(p => {
            if (p.is_paid) return false;
            
            const baseDate = new Date(scheme.start_date);
            const paymentMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + p.month_number - 1, 1);
            return paymentMonthDate <= currentMonthStart;
          });

          return hasUnpaid;
        }).map(scheme => {
          const unpaidMonths = scheme.scheme_payments
            ?.filter(p => {
              if (p.is_paid) return false;
              const baseDate = new Date(scheme.start_date);
              const paymentMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + p.month_number - 1, 1);
              return paymentMonthDate <= currentMonthStart;
            })
            .sort((a, b) => a.month_number - b.month_number);

          const oldestUnpaid = unpaidMonths && unpaidMonths.length > 0 ? unpaidMonths[0] : null;

          return {
            ...scheme,
            oldestUnpaid
          };
        });

        setPendingSchemes(unpaidList);
      }
    } catch (err) {
      console.error('Error fetching pending schemes:', err);
    } finally {
      setLoadingSchemes(false);
    }
  }

  useEffect(() => {
    // Seed initial sandbox data if empty
    db.seedInitialSandboxData().then(() => {
      fetchTodayFinancials();
      fetchPendingSchemes();
    });
  }, []);

  const triggerWhatsAppReminder = (scheme) => {
    const oldestLabel = scheme.oldestUnpaid ? scheme.oldestUnpaid.month_label : 'this month';
    const amountStr = (scheme.monthly_amount || 0).toLocaleString('en-IN');
    const totalSavedStr = (scheme.total_saved || 0).toLocaleString('en-IN');
    
    const customerName = scheme.customers?.name || 'Valued Customer';
    const customerPhone = scheme.customers?.phone || '';
    
    const msg = `Dear *${customerName}*,\n\nYour monthly saving scheme installment of ₹*${amountStr}* for Account *${scheme.account_number}* (${oldestLabel}) is due at *SHREE GANESH JEWELLERS*.\n\nTotal Saved So Far: ₹${totalSavedStr}.\n\nTo pay programmatically or instantly, click this link to pay: upi://pay?pa=9930897237@okbizaxis&pn=SHREE%20GANESH%20JEWELLERS&am=${scheme.monthly_amount}&cu=INR&tn=Scheme%20Deposit%20${scheme.account_number}\n\nKindly complete your payment. Thank you!`;
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';
    if (cleanPhone) {
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert('No phone number registered for this customer.');
    }
  };

  const cards = [
    {
      name: 'Create New Bill',
      description: 'Generate gold or silver sales invoices, exchanges, and tax breakdowns.',
      path: '/billing',
      icon: BookOpen,
      color: 'from-amber-500/10 to-[#fed65b]/5 border-amber-500/20 text-[#570000]'
    },
    {
      name: 'Showroom Stock',
      description: 'Manage inventory items, check metal weights, and print label tags.',
      path: '/stock',
      icon: Package,
      color: 'from-blue-500/10 to-indigo-500/5 border-blue-500/20 text-blue-900'
    },
    {
      name: 'Saving Schemes',
      description: 'Enrol customers in 12-month savings accounts and record monthly cash cards.',
      path: '/savings',
      icon: UserCheck,
      color: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20 text-emerald-900'
    },
    {
      name: 'Gold Loans',
      description: 'Track gold mortages, collateral appraisals, simple interest, and returns.',
      path: '/loans',
      icon: Coins,
      color: 'from-yellow-500/10 to-orange-500/5 border-yellow-500/20 text-yellow-900'
    },
    {
      name: 'Audit Reports',
      description: 'View daily ledger tallies, metal totals, payment summaries, and download reports.',
      path: '/reports',
      icon: BarChart3,
      color: 'from-purple-500/10 to-fuchsia-500/5 border-purple-500/20 text-purple-900'
    },
    {
      name: 'Customer Directory',
      description: 'Search customer phone records to see full history of bills, loans, and savings.',
      path: '/search',
      icon: Search,
      color: 'from-cyan-500/10 to-sky-500/5 border-cyan-500/20 text-cyan-900'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        
        {/* Quick Analytics & Today's Cash Counter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main live cash drawer block */}
          <div className="md:col-span-2 bg-[#570000] border-2 border-[#735c00]/40 rounded-3xl p-6 text-[#fcf9f8] shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-0 bottom-0 opacity-[0.03] transform translate-x-4 translate-y-4">
              <Coins className="h-40 w-40" />
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h3 className="font-serif text-sm md:text-base font-bold text-[#fed65b] tracking-wider uppercase flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-[#fed65b]" />
                  Today's Live Cash Drawer Tally
                </h3>
                <button 
                  onClick={fetchTodayFinancials}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                  title="Refresh counts"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="py-6 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-t-[#fed65b] border-r-transparent border-b-[#fed65b] border-l-transparent animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <p className="text-[9px] uppercase tracking-widest text-[#fcf9f8]/60 font-bold">Cash Inflow</p>
                    <h4 className="text-base font-bold text-[#fed65b] mt-1">₹{financials.cash.toLocaleString('en-IN')}</h4>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <p className="text-[9px] uppercase tracking-widest text-[#fcf9f8]/60 font-bold">UPI Payments</p>
                    <h4 className="text-base font-bold text-[#fed65b] mt-1">₹{financials.upi.toLocaleString('en-IN')}</h4>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <p className="text-[9px] uppercase tracking-widest text-[#fcf9f8]/60 font-bold">Card & NetBank</p>
                    <h4 className="text-base font-bold text-[#fed65b] mt-1">₹{(financials.card + financials.netbanking).toLocaleString('en-IN')}</h4>
                  </div>
                  <div className="bg-[#735c00]/30 rounded-2xl p-3 border border-[#fed65b]/20">
                    <p className="text-[9px] uppercase tracking-widest text-[#fed65b]/80 font-bold">URD Buybacks</p>
                    <h4 className="text-base font-bold text-red-300 mt-1">₹{financials.buybackOutflow.toLocaleString('en-IN')}</h4>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#fcf9f8]/90 flex-wrap gap-2">
              <span>Total Received Revenue Today: <strong className="text-[#fed65b]">₹{financials.totalInflow.toLocaleString('en-IN')}</strong></span>
              <span className="px-3 py-1 rounded bg-[#fed65b] text-[#570000] font-black uppercase text-[9px] tracking-wider">
                Net Cash Drawer: ₹{financials.netCashDrawer.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Setup checklist / info block */}
          <div className="bg-white border border-[#735c00]/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-3 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Quick Operations
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed italic mb-4">
                This system runs directly connected to your Supabase project. Make sure to back up ledger entries and print invoices on sales.
              </p>
            </div>
            
            <button
              onClick={() => navigate('/billing')}
              className="w-full py-3 bg-[#570000] hover:bg-[#735c00] text-white font-bold uppercase tracking-wider text-[10px] rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-[#fed65b]" />
              Start New Billing Row
            </button>
          </div>

        </div>

        {/* Unpaid Collections Due Widget */}
        <div className="bg-white border border-[#735c00]/15 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#570000]/10 rounded-lg text-[#570000]">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00]">
                  Unpaid Collections Due (Saving Schemes)
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Customers with pending monthly installments
                </p>
              </div>
            </div>
            <button
              onClick={fetchPendingSchemes}
              className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all text-gray-500 cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loadingSchemes ? (
            <div className="py-8 text-center space-y-2">
              <div className="h-5 w-5 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Scanning savings ledgers...</p>
            </div>
          ) : pendingSchemes.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-800">All Collections Clear!</h4>
                <p className="text-[10px] text-gray-400 italic">No pending scheme payments found up to this month.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/15 uppercase font-bold tracking-widest text-[8px]">
                    <th className="py-2.5 px-3">Account No</th>
                    <th className="py-2.5 px-3">Customer Details</th>
                    <th className="py-2.5 px-3">Installment Month</th>
                    <th className="py-2.5 px-3 text-right">Amount Due</th>
                    <th className="py-2.5 px-3 text-center">Rem. Day</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans font-bold">
                  {pendingSchemes.map((scheme) => (
                    <tr key={scheme.id} className="hover:bg-gray-50/50 transition-all">
                      <td className="py-2.5 px-3 font-mono text-[#570000]">{scheme.account_number}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-serif text-gray-800">{scheme.customers?.name || 'Unknown Customer'}</div>
                        <div className="text-[10px] text-gray-400 font-mono font-medium">{scheme.customers?.phone || 'N/A'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#735c00] text-[9px] uppercase tracking-wider">
                          {scheme.oldestUnpaid ? scheme.oldestUnpaid.month_label : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-800">₹{(scheme.monthly_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-center text-gray-500 font-mono">
                        {scheme.reminder_day}th
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => triggerWhatsAppReminder(scheme)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Remind
                          </button>
                          <button
                            onClick={() => navigate('/savings')}
                            className="px-2.5 py-1 rounded-lg bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/20 text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Feature Cards Grid (3 Columns) */}
        <div>
          <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] mb-4">
            Management Directory
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.name}
                  onClick={() => navigate(card.path)}
                  className={`bg-gradient-to-br ${card.color} border-2 rounded-3xl p-6 cursor-pointer transform hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between gap-4`}
                >
                  <div className="h-10 w-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-serif text-base font-bold mb-1 tracking-wide">
                      {card.name}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
