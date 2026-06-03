import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { Plus, MessageSquare, Award, Sparkles, User, Calendar, CreditCard, ChevronRight, Printer, Gem, Phone } from 'lucide-react';
import QRCode from 'qrcode';

export default function SavingSchemePage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'detail' | 'print_maturity'
  const [selectedScheme, setSelectedScheme] = useState(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('1000');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderDay, setReminderDay] = useState('5');

  // Month payment modal
  const [payMonth, setPayMonth] = useState(null); // month row info
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');

  // Maturity processing modal
  const [showMaturityModal, setShowMaturityModal] = useState(false);
  const [maturityInterest, setMaturityInterest] = useState('1000');

  // UPI QR states
  const [qrUrl, setQrUrl] = useState('');

  const fetchSchemesList = async () => {
    setLoading(true);
    const { data } = await db.getSavingSchemes();
    if (data) setSchemes(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSchemesList();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Autocomplete auto-fill phone details
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '');
    if (clean.length === 10) {
      db.searchCustomerByPhone(clean).then(({ data }) => {
        if (data) {
          setCustomerName(data.name);
          setCustomerAddress(data.address || '');
        }
      });
    }
  }, [customerPhone]);

  const handleOpenDetail = async (scheme) => {
    setSelectedScheme(scheme);
    setView('detail');

    // Generate UPI QR Code for standard scanning (Shree Ganesh UPI link)
    // Merchant VPA example: shreeganesh@upi
    const upiLink = `upi://pay?pa=9930897237@okbizaxis&pn=SHREE%20GANESH%20JEWELLERS&am=${scheme.monthly_amount}&cu=INR&tn=Scheme%20Deposit%20${scheme.account_number}`;
    try {
      const url = await QRCode.toDataURL(upiLink);
      setQrUrl(url);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !monthlyAmount) {
      return alert('Fill Name, Phone, and Monthly Installment Amount.');
    }

    const { error } = await db.saveSavingScheme(
      customerName,
      customerPhone,
      customerAddress,
      parseFloat(monthlyAmount),
      startDate,
      parseInt(reminderDay)
    );

    if (!error) {
      alert('Saving Scheme Created Successfully!');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setMonthlyAmount('1000');
      fetchSchemesList();
      setView('list');
    } else {
      alert('Scheme creation failed: ' + error.message);
    }
  };

  const handlePayInstallment = (monthRow) => {
    setPayMonth(monthRow);
    setPayAmount(selectedScheme.monthly_amount.toString());
    setPayMode('cash');
  };

  const submitInstallment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter valid amount.');

    const { error } = await db.recordSchemePayment(
      selectedScheme.id,
      payMonth.id,
      amt,
      payMode,
      new Date().toISOString().split('T')[0]
    );

    if (!error) {
      alert('Installment recorded successfully!');
      setPayMonth(null);
      // Reload details
      const { data } = await db.getSavingSchemes();
      if (data) {
        setSchemes(data);
        const updated = data.find(s => s.id === selectedScheme.id);
        setSelectedScheme(updated);
      }
    } else {
      alert('Failed to save deposit: ' + error.message);
    }
  };

  const submitMaturity = async (e) => {
    e.preventDefault();
    const bonus = parseFloat(maturityInterest) || 0;
    const { error } = await db.processSchemeMaturity(selectedScheme.id, bonus);
    if (!error) {
      alert('Maturity Processed Successfully!');
      setShowMaturityModal(false);
      // Reload
      const { data } = await db.getSavingSchemes();
      if (data) {
        setSchemes(data);
        const updated = data.find(s => s.id === selectedScheme.id);
        setSelectedScheme(updated);
      }
    } else {
      alert('Maturity processing failed: ' + error.message);
    }
  };

  const handleCloseScheme = async () => {
    if (confirm('Are you sure you want to close this saving scheme?')) {
      const { error } = await db.closeSavingScheme(selectedScheme.id);
      if (!error) {
        alert('Scheme closed successfully.');
        const { data } = await db.getSavingSchemes();
        if (data) {
          setSchemes(data);
          const updated = data.find(s => s.id === selectedScheme.id);
          setSelectedScheme(updated);
        }
      }
    }
  };

  const triggerWhatsAppReminder = () => {
    const customerName = selectedScheme?.customers?.name || 'Customer';
    const customerPhone = selectedScheme?.customers?.phone || '';
    const msg = `Dear *${customerName}*,\n\nYour monthly saving scheme installment of ₹*${selectedScheme.monthly_amount.toLocaleString('en-IN')}* for Account *${selectedScheme.account_number}* is due at *SHREE GANESH JEWELLERS*.\n\nTotal Saved So Far: ₹${selectedScheme.total_saved.toLocaleString('en-IN')}.\n\nKindly scan the shop UPI code or visit our Kamothe showroom to pay. Thank you!`;
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';
    if (cleanPhone) {
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert('No phone number registered for this customer.');
    }
  };

  const triggerWhatsAppMaturity = () => {
    const totalPayable = selectedScheme.total_saved + (selectedScheme.maturity_interest || 0);
    const customerName = selectedScheme?.customers?.name || 'Customer';
    const customerPhone = selectedScheme?.customers?.phone || '';
    const msg = `Dear *${customerName}*,\n\nCongratulations! 🌟 Your saving scheme account *${selectedScheme.account_number}* has MATURED!\n\nTotal Principal: ₹${selectedScheme.total_saved.toLocaleString('en-IN')}\nMaturity Bonus: ₹${selectedScheme.maturity_interest.toLocaleString('en-IN')}\nTotal Receivable: ₹*${totalPayable.toLocaleString('en-IN')}*\n\nKindly visit our showroom with your certificate to claim. Thank you!`;
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';
    if (cleanPhone) {
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert('No phone number registered for this customer.');
    }
  };

  const isAllMonthsPaid = selectedScheme?.scheme_payments?.every(p => p.is_paid);

  return (
    <Layout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4 no-print">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              {view === 'list' 
                ? 'Customer Saving Schemes' 
                : view === 'add' 
                  ? 'New Saving Scheme Enrolment' 
                  : view === 'print_maturity'
                    ? 'Saving Scheme Maturity Certificate'
                    : `Account detail: ${selectedScheme?.account_number}`}
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              {view === 'list' 
                ? 'Manage 12-month customer savings cards' 
                : view === 'print_maturity'
                  ? 'Official matured savings payout receipt'
                  : 'Fill details below to open recurring savings account'}
            </p>
          </div>
          {view === 'list' ? (
            <button
              onClick={() => setView('add')}
              className="px-3.5 py-2 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Scheme
            </button>
          ) : (
            <button
              onClick={() => {
                if (view === 'print_maturity') {
                  setView('detail');
                } else {
                  setView('list');
                }
              }}
              className="px-3.5 py-2 bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              {view === 'print_maturity' ? 'Back to Details' : 'Back to List'}
            </button>
          )}
        </div>

        {/* 1. SCHEMES LIST VIEW */}
        {view === 'list' && (
          <div className="bg-white border border-[#735c00]/15 rounded-3xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center space-y-2">
                <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Syncing Schemes...</p>
              </div>
            ) : schemes.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 italic">
                No active savings schemes logged in the database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/25 uppercase font-bold tracking-widest text-[9px]">
                      <th className="py-3 px-4">Account No</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4 text-right">Monthly Installment</th>
                      <th className="py-3 px-4 text-right">Total Deposited</th>
                      <th className="py-3 px-4 text-center">Start Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans font-bold">
                    {schemes.map((scheme) => (
                      <tr key={scheme.id} className="hover:bg-gray-50/70 transition-all">
                        <td className="py-3.5 px-4 font-mono text-[#570000]">{scheme.account_number}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-serif text-[#1c1b1b]">{scheme.customers?.name || 'Unknown Customer'}</div>
                          <div className="text-[10px] text-gray-400 font-mono font-medium">{scheme.customers?.phone || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-800">₹{scheme.monthly_amount.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-right text-[#735c00]">₹{scheme.total_saved.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-center text-gray-500">
                          {new Date(scheme.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${
                            scheme.status === 'active' 
                              ? 'bg-blue-100 text-blue-700' 
                              : (scheme.status === 'matured' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-gray-100 text-gray-600')
                          }`}>
                            {scheme.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleOpenDetail(scheme)}
                            className="px-2.5 py-1 rounded bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/20 text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            Open Ledger
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. CREATE SCHEME FORM */}
        {view === 'add' && (
          <div className="bg-white border border-[#735c00]/10 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-4 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#fed65b]" />
              Scheme Registration Portal
            </h3>

            <form onSubmit={handleCreateScheme} className="space-y-4 font-bold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Customer Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono"
                    />
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Customer Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Enter Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000]"
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Full Customer Address (Optional)
                </label>
                <textarea
                  placeholder="Street details, Kamothe"
                  rows={2}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#570000]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Monthly Investment Amount (₹)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="e.g. 2000"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono text-right"
                    />
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Scheme Start Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono"
                    />
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    WhatsApp Reminder Day (1-28)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={reminderDay}
                    onChange={(e) => setReminderDay(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none text-center font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3.5 bg-[#570000] hover:bg-[#735c00] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer animate-pulse"
              >
                Establish Savings Scheme Account
              </button>
            </form>
          </div>
        )}

        {/* 3. SCHEME DETAILS WORKSPACE */}
        {view === 'detail' && selectedScheme && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 12-month installments checker table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00]">
                    12-Month Payment installment Card
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold ${
                    selectedScheme.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedScheme.status}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 uppercase text-[8px] font-bold text-gray-500 tracking-wider">
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-3 text-right">Deposited</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Pay Date</th>
                        <th className="py-2.5 px-3 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold">
                      {selectedScheme.scheme_payments
                        ?.sort((a, b) => a.month_number - b.month_number)
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-[#570000]">
                              Month {p.month_number} — <span className="font-serif text-[#1c1b1b]">{p.month_label}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {p.is_paid ? `₹${p.amount_paid.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-gray-500 font-mono text-[9px]">
                              {p.is_paid ? p.payment_mode : 'Pending'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 font-mono">
                              {p.is_paid ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {p.is_paid ? (
                                <span className="text-green-600 font-extrabold text-[10px]">✓ Settled</span>
                              ) : (
                                selectedScheme.status === 'active' && (
                                  <button
                                    onClick={() => handlePayInstallment(p)}
                                    className="px-2 py-1 bg-[#fed65b] text-[#570000] border border-[#735c00]/40 rounded-lg text-[9px] uppercase font-bold tracking-wider hover:bg-[#fed65b]/90 transition-all cursor-pointer"
                                  >
                                    Pay Now
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-gray-800 border-t border-gray-100 pt-3 flex-wrap gap-2">
                  <span>Total Saved So Far: <strong className="text-[#570000] font-mono">₹{selectedScheme.total_saved.toLocaleString('en-IN')}</strong></span>
                  <span>Month Progress: <strong className="text-blue-700 font-mono">{selectedScheme.scheme_payments?.filter(p => p.is_paid).length} / 12</strong></span>
                </div>
              </div>
            </div>

            {/* Side tools panel */}
            <div className="space-y-6">
              
              {/* Account summary cards */}
              <div className="bg-white border border-[#735c00]/15 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-1.5">
                  Savings Card Dossier
                </h4>
                
                <div className="space-y-2 text-xs font-bold">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account No:</span>
                    <span className="text-[#570000] font-mono">{selectedScheme.account_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Customer:</span>
                    <span className="text-gray-800 font-serif">{selectedScheme.customers?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-gray-800 font-mono">{selectedScheme.customers?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Installment:</span>
                    <span className="text-gray-800 font-mono">₹{selectedScheme.monthly_amount}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reminder Day:</span>
                    <span className="text-gray-800">Every {selectedScheme.reminder_day}th</span>
                  </div>
                  
                  {selectedScheme.status === 'matured' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1 mt-2 text-[11px]">
                      <div className="flex justify-between font-black">
                        <span>Scheme Matured!</span>
                        <Award className="h-4 w-4 text-amber-600 animate-pulse" />
                      </div>
                      <div className="flex justify-between">
                        <span>Principal Saved:</span>
                        <span className="font-mono">₹{selectedScheme.total_saved.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interest Bonus Added:</span>
                        <span className="font-mono">₹{selectedScheme.maturity_interest.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-200 pt-1 font-black">
                        <span>Grand Maturity Pay:</span>
                        <span className="font-mono">₹{(selectedScheme.total_saved + selectedScheme.maturity_interest).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions toggler */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {selectedScheme.status === 'active' && (
                    <>
                      <button
                        onClick={triggerWhatsAppReminder}
                        className="w-full py-2.5 bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/25 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send Deposit Reminder
                      </button>

                      {isAllMonthsPaid && (
                        <button
                          onClick={() => setShowMaturityModal(true)}
                          className="w-full py-2.5 bg-[#fed65b] border border-[#735c00]/40 text-[#570000] rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all animate-bounce"
                        >
                          <Award className="h-4 w-4 text-[#570000]" />
                          Process Maturity Payout
                        </button>
                      )}
                    </>
                  )}

                  {selectedScheme.status === 'matured' && (
                    <>
                      <button
                        onClick={() => setView('print_maturity')}
                        className="w-full py-2.5 bg-[#fed65b] border border-[#735c00]/40 text-[#570000] rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:bg-[#fed65b]/90"
                      >
                        <Printer className="h-4 w-4 text-[#570000]" />
                        Print Maturity Receipt
                      </button>
                      <button
                        onClick={triggerWhatsAppMaturity}
                        className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Share Maturity Notice
                      </button>
                      <button
                        onClick={handleCloseScheme}
                        className="w-full py-2.5 bg-[#570000] hover:bg-[#735c00] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                      >
                        Claim & Close Account
                      </button>
                    </>
                  )}
                  
                  {selectedScheme.status === 'closed' && (
                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl text-center text-xs italic font-bold">
                      Account settled and closed.
                    </div>
                  )}
                </div>
              </div>

              {/* UPI QR Display Card */}
              {selectedScheme.status === 'active' && qrUrl && (
                <div className="bg-white border border-[#735c00]/15 rounded-3xl p-5 shadow-sm flex flex-col items-center justify-center text-center space-y-2.5">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-[#735c00]">
                    In-Store Quick UPI Scan
                  </h4>
                  <img src={qrUrl} alt="UPI Payment QR" className="h-32 w-32 border border-gray-100 rounded-xl p-1" />
                  <p className="text-[9px] text-gray-400 italic font-bold leading-normal">
                    Let the customer scan the QR to pay exactly ₹{selectedScheme.monthly_amount.toLocaleString('en-IN')} instantly!
                  </p>
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* Pay Installment Modal */}
      {payMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#570000] px-5 py-3 text-[#fed65b] font-bold flex items-center justify-between border-b border-[#735c00]/30">
              <h3 className="font-serif text-sm tracking-wider uppercase">Record Scheme Deposit</h3>
              <button onClick={() => setPayMonth(null)} className="text-white">✕</button>
            </div>
            
            <form onSubmit={submitInstallment} className="p-5 space-y-4 font-bold">
              <div className="text-xs text-gray-600">
                Month Slot: <span className="text-[#570000] font-serif">{payMonth.month_label}</span> (Installment {payMonth.month_number})
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
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
                  onClick={() => setPayMonth(null)}
                  className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Maturity Modal */}
      {showMaturityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#570000] px-5 py-3 text-[#fed65b] font-bold flex items-center justify-between border-b border-[#735c00]/30">
              <h3 className="font-serif text-sm tracking-wider uppercase">Process Maturity Bonus</h3>
              <button onClick={() => setShowMaturityModal(false)} className="text-white">✕</button>
            </div>
            
            <form onSubmit={submitMaturity} className="p-5 space-y-4 font-bold">
              <div className="text-xs text-gray-600 space-y-1">
                <div>Account: <span className="text-gray-900 font-mono">{selectedScheme.account_number}</span></div>
                <div>Principal Saved: <span className="text-gray-900 font-mono">₹{selectedScheme.total_saved.toLocaleString('en-IN')}</span></div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Maturity Bonus Interest (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="Interest amount to add"
                  value={maturityInterest}
                  onChange={(e) => setMaturityInterest(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaturityModal(false)}
                  className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {view === 'print_maturity' && selectedScheme && (
        <PrintMaturityLayout 
          scheme={selectedScheme}
          onClose={() => setView('detail')}
        />
      )}
    </Layout>
  );
}

// Saving Scheme Maturity Payout Certificate component
function PrintMaturityLayout({ scheme, onClose }) {
  useEffect(() => {
    document.body.classList.add('print-mode-active');
    return () => document.body.classList.remove('print-mode-active');
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const principal = scheme.total_saved || 0;
  const interest = scheme.maturity_interest || 0;
  const totalPayout = principal + interest;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Convert numbers into Indian Rupee words helper (local replica to avoid export dependency)
  function numToWordsLocal(num) {
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function helper(n) {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + helper(n % 100) : '');
      if (n < 100000) return helper(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + helper(n % 1000) : '');
      if (n < 10000000) return helper(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + helper(n % 100000) : '');
      return helper(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + helper(n % 10000000) : '');
    }

    const rounded = Math.floor(num);
    if (rounded === 0) return 'Zero';
    return helper(rounded).trim() + ' Rupees Only';
  }

  return (
    <div className="bg-[#fcf9f8] min-h-screen p-0 md:p-6 flex flex-col items-center">
      
      {/* Action panel no-print */}
      <div className="w-full max-w-3xl no-print bg-[#570000] border-b border-[#735c00]/30 text-white px-5 py-3 rounded-2xl flex items-center justify-between mb-6 shadow-md font-sans">
        <span className="font-serif text-xs font-bold text-[#fed65b] tracking-wider uppercase">Maturity Certificate Receipt Sheet</span>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Certificate
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
          >
            Back to Details
          </button>
        </div>
      </div>

      {/* Certificate layout sheet */}
      <div 
        id="maturity-certificate-sheet"
        className="w-full max-w-3xl bg-white p-8 md:p-12 shadow-xl border-8 border-double border-[#735c00]/50 relative print:shadow-none print:border-8 print:p-8 font-sans"
        style={{ minHeight: '297mm' }}
      >
        {/* Decorative corner borders */}
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-[#735c00]/30 pointer-events-none" />

        {/* Traditional mantra */}
        <div className="text-center font-bold text-gray-500 text-[10px] tracking-widest uppercase mb-1">
          ।। श्री गणेशाय नमः ।।
        </div>

        {/* Brand Header block */}
        <div className="text-center pb-4 mb-6 border-b border-gray-250">
          <div className="flex justify-center items-center gap-2.5 mb-1.5">
            <Gem className="h-6 w-6 text-[#570000]" />
            <h1 className="font-serif text-2xl font-black text-[#570000] tracking-widest uppercase leading-none">
              SHREE GANESH JEWELLERS
            </h1>
          </div>
          <p className="font-serif text-[10px] text-[#735c00] font-black tracking-widest uppercase mb-1">
            Shop No. 01, Tirupati Garden, Plot No. 44, Sector 20, Kamothe, Navi Mumbai
          </p>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            SAVING SCHEME MATURITY CERTIFICATE (सुवर्ण ठेव योजना पूर्तता प्रमाणपत्र)
          </p>
        </div>

        {/* Certificate Dossier */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs text-gray-700 font-bold border border-gray-200 rounded-xl p-4 bg-gray-50/50">
          <div className="space-y-1.5">
            <div>Virtual Account No: <span className="font-mono text-[#570000] font-black">{scheme.account_number}</span></div>
            <div>Customer Name: <span className="font-serif text-gray-900 font-black">{scheme.customers?.name}</span></div>
            <div>Phone Number: <span className="font-mono text-gray-950">{scheme.customers?.phone}</span></div>
            <div>Address: <span className="font-medium text-gray-700">{scheme.customers?.address || 'Kamothe, Navi Mumbai'}</span></div>
          </div>
          <div className="space-y-1.5 pl-4 border-l border-gray-250">
            <div>Scheme Start Date: <span className="font-mono">{new Date(scheme.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <div>Monthly Installment: <span className="font-mono text-gray-900 font-black">₹{scheme.monthly_amount.toLocaleString('en-IN')}</span></div>
            <div>Interest Bonus Added: <span className="font-mono text-amber-700 font-black">₹{interest.toLocaleString('en-IN')}</span></div>
            <div>Maturity Date: <span className="font-mono">{formattedDate}</span></div>
          </div>
        </div>

        {/* 12-Month Payment Ledger Card */}
        <div className="mb-6">
          <h3 className="text-[10px] uppercase font-black tracking-widest text-[#735c00] mb-2.5 text-center">
            ★ 12-MONTH INSTALLMENT LEDGER CARD (१२ महिन्यांचे पेमेंट कार्ड) ★
          </h3>
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[10px] font-bold">
              <thead>
                <tr className="bg-gray-150 text-gray-700 uppercase tracking-wider text-[8px] border-b border-gray-300">
                  <th className="py-2 px-3 border-r border-gray-300 text-center font-bold">Month</th>
                  <th className="py-2 px-3 border-r border-gray-300 font-bold">Description</th>
                  <th className="py-2 px-3 border-r border-gray-300 text-right font-bold">Amount Paid</th>
                  <th className="py-2 px-3 border-r border-gray-300 font-bold">Payment Mode</th>
                  <th className="py-2 px-3 text-center font-bold">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {scheme.scheme_payments
                  ?.sort((a, b) => a.month_number - b.month_number)
                  .map((p) => (
                    <tr key={p.id} className="text-gray-800">
                      <td className="py-2 px-3 border-r border-gray-300 text-center font-mono text-[#570000]">M{p.month_number}</td>
                      <td className="py-2 px-3 border-r border-gray-300 font-serif">{p.month_label}</td>
                      <td className="py-2 px-3 border-r border-gray-300 text-right font-mono font-medium">
                        {p.is_paid ? `₹${p.amount_paid.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-gray-300 uppercase text-gray-500 font-mono text-[9px] font-medium">
                        {p.is_paid ? p.payment_mode : 'Pending'}
                      </td>
                      <td className="py-2 px-3 text-center text-gray-500 font-mono font-medium">
                        {p.is_paid ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maturity calculations summary */}
        <div className="flex justify-between items-center bg-[#570000]/5 border-2 border-dashed border-[#735c00]/30 rounded-2xl p-5 mb-8">
          <div className="space-y-1 font-bold text-xs text-gray-600">
            <div>Principal Deposited (बचत ठेव): <span className="font-mono text-gray-900 font-black">₹{principal.toLocaleString('en-IN')}</span></div>
            <div>Maturity Bonus Interest (व्याज/बोनस): <span className="font-mono text-amber-700 font-black">₹{interest.toLocaleString('en-IN')}</span></div>
          </div>
          <div className="text-right font-bold">
            <p className="text-[10px] uppercase font-black tracking-widest text-[#735c00]">Total Maturity Payout</p>
            <h2 className="font-mono text-xl font-black text-[#570000] mt-1">₹{totalPayout.toLocaleString('en-IN')}</h2>
          </div>
        </div>

        <div className="text-xs font-bold text-gray-500 mb-6 font-serif">
          Amount in words: <span className="font-sans font-bold not-italic text-gray-800">{numToWordsLocal(totalPayout)}</span>
        </div>

        {/* Marathi rules / Greetings */}
        <div className="text-center font-serif text-[11px] text-gray-500 italic leading-relaxed border-t border-gray-150 pt-4 mt-6">
          "ग्राहक देवो भव! सुवर्ण योजना यशस्वीरित्या पूर्ण केल्याबद्दल आपले हार्दिक अभिनंदन. श्री गणेश ज्वेलर्स वर आपला विश्वास सदैव असाच कायम राहो हीच सदिच्छा."
        </div>

        {/* Signatures block */}
        <div className="grid grid-cols-2 gap-4 mt-12 pt-6 text-center text-[10px] font-black text-gray-700 tracking-wider">
          <div className="flex flex-col items-center justify-between h-14">
            <div className="w-40 border-b border-gray-300" />
            <span>ग्राहक सही (CUSTOMER SIGNATURE)</span>
          </div>
          <div className="flex flex-col items-center justify-between h-14">
            <div className="w-40 border-b border-gray-300" />
            <span>अधिकृत सही (AUTHORISED SIGNATURE)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
