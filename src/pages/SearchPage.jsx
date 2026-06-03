import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { 
  Search, User, FileText, UserCheck, Coins, 
  ArrowRight, MessageSquare 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  // History aggregates
  const [history, setHistory] = useState({
    profile: null,
    invoices: [],
    schemes: [],
    loans: [],
    buybacks: []
  });
  
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(true);

  // Modal for inline dues settlement
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState('cash');

  async function fetchCustomersList() {
    setSearchLoading(true);
    // Fetch unique customers list using Supabase
    const { data: invs } = await db.getInvoices();
    const list = [];
    invs?.forEach(inv => {
      if (inv.customers && !list.find(c => c.id === inv.customer_id)) {
        list.push(inv.customers);
      }
    });
    setCustomersList(list);
    setSearchLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomersList();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomerId(cust.id);
    setLoading(true);
    const { data } = await db.getCustomerFullHistory(cust.id);
    if (data) {
      setHistory({
        profile: cust,
        invoices: data.invoices || [],
        schemes: data.schemes || [],
        loans: data.loans || [],
        buybacks: data.buybacks || []
      });
    }
    setLoading(false);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter valid payment amount.');
    if (amt > selectedInvoice.balance_due) return alert('Amount exceeds outstanding balance.');

    const { error } = await db.recordPayment(selectedInvoice.id, amt, settleMode, 'Dues Settlement');
    if (!error) {
      alert('Payment Recorded Successfully!');
      setShowSettleModal(false);
      setSettleAmount('');
      // Reload customer history
      const cust = history.profile;
      handleSelectCustomer(cust);
    } else {
      alert('Repayment failed: ' + error.message);
    }
  };

  const triggerWhatsAppReminder = (inv) => {
    const formattedDate = new Date(inv.bill_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const msg = `Dear *${history.profile.name}*,\n\nFriendly reminder from *SHREE GANESH JEWELLERS* 🙏\n\nRegarding outstanding balance on Invoice *${inv.bill_number}* (Date: *${formattedDate}*):\n\nOutstanding Dues: ₹*${(inv.balance_due || 0).toLocaleString('en-IN')}*.\n\nKindly settle via UPI, card, or cash at your convenience. Thank you!`;
    const cleanPhone = history.profile.phone.replace(/\D/g, '').slice(-10);
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Compile lifetime spendings
  const lifetimePurchase = history.invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
  const outstandingDues = history.invoices.reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0);

  const filteredCustomers = customersList.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.phone.includes(query)
  );

  return (
    <Layout>
      <div className="space-y-6 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              Global Customer Directory
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Search by phone to review transaction history across all sheets
            </p>
          </div>
        </div>

        {/* Directory Search & List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Customers Left List Panel */}
          <div className="lg:col-span-1 bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search phone or name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
            </div>

            {searchLoading ? (
              <div className="text-center py-6">
                <div className="h-5 w-5 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 italic">
                No matching customer files found.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredCustomers.map(cust => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedCustomerId === cust.id 
                        ? 'bg-[#570000] border-[#735c00]/40 text-white'
                        : 'bg-[#fcf9f8] border-gray-100 hover:bg-gray-50 text-[#1c1b1b]'
                    }`}
                  >
                    <div>
                      <h4 className="font-serif text-xs font-bold">{cust.name}</h4>
                      <p className={`text-[10px] font-mono mt-0.5 ${selectedCustomerId === cust.id ? 'text-[#fed65b]' : 'text-gray-400'}`}>{cust.phone}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-50" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer History details Panel */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedCustomerId ? (
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-12 text-center text-xs text-gray-400 italic shadow-sm">
                Select a customer from the left directory to check files.
              </div>
            ) : loading ? (
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-12 text-center shadow-sm space-y-2">
                <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                <p className="text-xs text-gray-400 italic">Fetching full history...</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. Customer profile and spend metrics */}
                <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <div className="h-10 w-10 rounded-2xl bg-[#570000]/5 flex items-center justify-center">
                      <User className="h-5 w-5 text-[#570000]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm font-bold">{history.profile.name}</h3>
                      <p className="text-[10px] font-mono text-gray-400">{history.profile.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold">
                    <div className="bg-gray-50 rounded-2xl p-3">
                      <p className="text-[9px] text-gray-400 uppercase">Lifetime Purchases</p>
                      <h4 className="text-sm font-black text-gray-800 mt-1">₹{lifetimePurchase.toLocaleString('en-IN')}</h4>
                    </div>

                    <div className="bg-red-50 rounded-2xl p-3">
                      <p className="text-[9px] text-red-500/80 uppercase">Outstanding Balance</p>
                      <h4 className="text-sm font-black text-red-600 mt-1">₹{outstandingDues.toLocaleString('en-IN')}</h4>
                    </div>

                    <div className="bg-[#735c00]/5 rounded-2xl p-3 col-span-2 sm:col-span-1">
                      <p className="text-[9px] text-gray-400 uppercase">Address File</p>
                      <p className="text-[10px] text-gray-700 mt-1 font-serif leading-normal truncate">{history.profile.address || 'Not Provided'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Customer Invoices list */}
                <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-[#735c00]" />
                    Sales Invoices History ({history.invoices.length})
                  </h3>

                  {history.invoices.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No sales invoices logged for this customer.</p>
                  ) : (
                    <div className="space-y-3 font-bold">
                      {history.invoices.map(inv => (
                        <div key={inv.id} className="p-3 bg-[#fcf9f8] border border-gray-100 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[#570000]">{inv.bill_number}</span>
                              <span className="text-[10px] text-gray-400 font-mono font-medium">
                                {new Date(inv.bill_date).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              Payable: ₹{(inv.total_amount || 0).toLocaleString('en-IN')} | Outstanding Dues: <span className="text-red-600">₹{(inv.balance_due || 0).toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate('/billing')}
                              className="px-2 py-1.5 bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer"
                            >
                              Open Billing Screen
                            </button>
                            {(inv.balance_due || 0) > 0 && (
                              <button
                                onClick={() => { setSelectedInvoice(inv); setShowSettleModal(true); }}
                                className="px-2 py-1.5 bg-[#fed65b] border border-[#735c00]/40 text-[#570000] rounded-lg text-[9px] uppercase tracking-wider font-bold hover:bg-[#fed65b]/90 transition-all cursor-pointer"
                              >
                                Settle
                              </button>
                            )}
                            {(inv.balance_due || 0) > 0 && (
                              <button
                                onClick={() => triggerWhatsAppReminder(inv)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg cursor-pointer"
                                title="Send WhatsApp Reminder"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Saving Schemes list */}
                <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-[#735c00]" />
                    Saving Schemes Accounts ({history.schemes.length})
                  </h3>

                  {history.schemes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No savings scheme cards opened for this customer.</p>
                  ) : (
                    <div className="space-y-3 font-bold text-xs">
                      {history.schemes.map(sch => (
                        <div key={sch.id} className="p-3 bg-[#fcf9f8] border border-gray-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 font-mono text-[#570000]">
                              <span>{sch.account_number}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-sans font-extrabold ${
                                sch.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}>{sch.status}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              Installment: ₹{(sch.monthly_amount || 0).toLocaleString('en-IN')}/month | Total Saved: ₹{(sch.total_saved || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => navigate('/savings')}
                            className="px-2 py-1.5 bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Open Scheme details
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Gold loans list */}
                <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-[#735c00]" />
                    Mortgage Gold Loans ({history.loans.length})
                  </h3>

                  {history.loans.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No mortgage loans opened for this customer.</p>
                  ) : (
                    <div className="space-y-3 font-bold text-xs">
                      {history.loans.map(loan => (
                        <div key={loan.id} className="p-3 bg-[#fcf9f8] border border-gray-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 font-mono text-[#570000]">
                              <span>{loan.loan_number}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-sans font-extrabold ${
                                loan.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                              }`}>{loan.status}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">
                              Pledge Weight: {(loan.gold_weight || 0).toFixed(3)}g | Loan: ₹{(loan.loan_amount || 0).toLocaleString('en-IN')} | Repaid: ₹{(loan.total_repaid || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => navigate('/loans')}
                            className="px-2 py-1.5 bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Open Loan details
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>

      </div>

      {/* Settle modal */}
      {showSettleModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#570000] px-5 py-3 text-[#fed65b] font-bold flex items-center justify-between border-b border-[#735c00]/30">
              <h3 className="font-serif text-sm tracking-wider uppercase">Settle Dues Installment</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-white">✕</button>
            </div>
            
            <form onSubmit={handleSettleSubmit} className="p-5 space-y-4 font-bold">
              <div className="text-xs space-y-1">
                <div className="text-gray-500">Invoice: <span className="text-gray-800 font-mono">{selectedInvoice.bill_number}</span></div>
                <div className="text-red-600 font-black">Outstanding Dues: <span>₹{(selectedInvoice.balance_due || 0).toLocaleString('en-IN')}</span></div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Payment Amount Received (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Payment Mode
                </label>
                <select
                  value={settleMode}
                  onChange={(e) => setSettleMode(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2.5 py-2 text-xs"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="card">Card Payment</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
