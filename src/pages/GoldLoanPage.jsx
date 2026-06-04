import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { Plus, MessageSquare, ShieldCheck, Percent, Coins, ChevronRight, Phone, User } from 'lucide-react';

// ==========================================
// LOAN REPAYMENT METHOD MATH HELPERS
// ==========================================

const getElapsedMonths = (startDateStr, endDate = new Date()) => {
  const start = new Date(startDateStr);
  const diffTime = endDate - start;
  const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
  return diffDays / 30; // 30-day standard month representation
};

const getLoanTenureMonths = (loan) => {
  if (!loan) return 12;
  const start = new Date(loan.loan_date);
  const due = new Date(loan.due_date);
  const diffMonths = (due.getFullYear() - start.getFullYear()) * 12 + due.getMonth() - start.getMonth();
  return Math.max(1, diffMonths);
};

const calculateEMI = (principal, monthlyRate, tenureMonths) => {
  if (monthlyRate === 0) return principal / tenureMonths;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
};

const calculateLoanBreakdown = (loan, targetDate = new Date()) => {
  if (!loan) {
    return {
      accruedInterest: 0,
      remainingPrincipal: 0,
      pendingInterest: 0,
      totalDue: 0,
      totalInterestPaid: 0,
      repaymentMethod: 'bullet',
      tenureMonths: 12,
      emiAmount: 0
    };
  }
  const principal = parseFloat(loan.loan_amount) || 0;
  const annualRate = parseFloat(loan.interest_rate) || 12.00;
  const monthlyRate = (annualRate / 100) / 12;
  const method = loan.repayment_method || 'bullet';
  const start = new Date(loan.loan_date);
  const due = new Date(loan.due_date);
  
  // Calculate tenure months
  const diffMonths = (due.getFullYear() - start.getFullYear()) * 12 + due.getMonth() - start.getMonth();
  const tenureMonths = Math.max(1, diffMonths);

  const repayments = [...(loan.loan_repayments || [])].sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
  const totalRepaid = repayments.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  if (loan.status === 'closed') {
    return {
      accruedInterest: 0,
      remainingPrincipal: 0,
      pendingInterest: 0,
      totalDue: 0,
      totalInterestPaid: 0,
      repaymentMethod: method,
      tenureMonths,
      emiAmount: calculateEMI(principal, monthlyRate, tenureMonths)
    };
  }

  if (method === 'bullet') {
    // 1. Bullet Repayment
    const elapsedMonths = getElapsedMonths(loan.loan_date, targetDate);
    const accruedInterest = Math.round(principal * monthlyRate * elapsedMonths);
    const totalDue = Math.max(0, principal + accruedInterest - totalRepaid);
    
    return {
      accruedInterest,
      remainingPrincipal: principal,
      pendingInterest: accruedInterest,
      totalDue,
      totalInterestPaid: 0,
      repaymentMethod: method,
      tenureMonths,
      emiAmount: 0
    };
  } else if (method === 'emi') {
    // 2. Monthly EMI Amortization Schedule
    const emi = calculateEMI(principal, monthlyRate, tenureMonths);
    const elapsedMonths = getElapsedMonths(loan.loan_date, targetDate);
    
    const schedule = [];
    let currentPrincipal = principal;
    
    for (let i = 1; i <= tenureMonths; i++) {
      const monthInterest = Math.round(currentPrincipal * monthlyRate);
      let principalPaid = emi - monthInterest;
      if (i === tenureMonths || principalPaid > currentPrincipal) {
        principalPaid = currentPrincipal;
      }
      currentPrincipal = Math.max(0, currentPrincipal - principalPaid);
      
      schedule.push({
        month: i,
        interest: monthInterest,
        principalPaid,
        remainingPrincipal: currentPrincipal
      });
    }

    const completedMonths = Math.min(tenureMonths, Math.floor(elapsedMonths));
    let accruedInterest = 0;
    for (let i = 0; i < completedMonths; i++) {
      accruedInterest += schedule[i].interest;
    }
    if (completedMonths < tenureMonths) {
      const currentPrincipalForMonth = completedMonths === 0 ? principal : schedule[completedMonths - 1].remainingPrincipal;
      const fractionalMonth = elapsedMonths - completedMonths;
      accruedInterest += Math.round(currentPrincipalForMonth * monthlyRate * fractionalMonth);
    }
    
    const totalDue = Math.max(0, principal + accruedInterest - totalRepaid);
    
    return {
      accruedInterest,
      remainingPrincipal: Math.max(0, principal + accruedInterest - totalRepaid),
      pendingInterest: Math.max(0, accruedInterest - totalRepaid),
      totalDue,
      emiAmount: emi,
      amortizationSchedule: schedule,
      repaymentMethod: method,
      tenureMonths
    };
  } else {
    // 3. Partial Payment Chronological Interest Reduction
    let outstandingPrincipal = principal;
    let pendingInterest = 0;
    let totalInterestAccrued = 0;
    let lastDate = start;

    for (const repayment of repayments) {
      const repDate = new Date(repayment.payment_date);
      if (repDate > lastDate) {
        const diffTime = repDate - lastDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const elapsedMonths = diffDays / 30;
        const interestAccrued = outstandingPrincipal * monthlyRate * elapsedMonths;
        
        pendingInterest += interestAccrued;
        totalInterestAccrued += interestAccrued;
      }
      
      const paymentAmount = parseFloat(repayment.amount);
      const clearedInterest = Math.min(paymentAmount, pendingInterest);
      pendingInterest -= clearedInterest;
      
      const principalReduction = paymentAmount - clearedInterest;
      outstandingPrincipal = Math.max(0, outstandingPrincipal - principalReduction);
      
      lastDate = repDate;
    }

    const today = new Date(targetDate);
    if (today > lastDate && outstandingPrincipal > 0) {
      const diffTime = today - lastDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const elapsedMonths = diffDays / 30;
      const interestAccrued = outstandingPrincipal * monthlyRate * elapsedMonths;
      
      pendingInterest += interestAccrued;
      totalInterestAccrued += interestAccrued;
    }

    pendingInterest = Math.round(pendingInterest);
    totalInterestAccrued = Math.round(totalInterestAccrued);
    const totalDue = Math.max(0, outstandingPrincipal + pendingInterest);

    return {
      accruedInterest: totalInterestAccrued,
      remainingPrincipal: Math.round(outstandingPrincipal),
      pendingInterest: Math.round(pendingInterest),
      totalDue: Math.round(totalDue),
      repaymentMethod: method,
      tenureMonths,
      emiAmount: 0
    };
  }
};

const generateComparisonSummary = (principal, monthlyRate, tenureMonths) => {
  const emi = calculateEMI(principal, monthlyRate, tenureMonths);
  const emiOutflow = emi * tenureMonths;
  const emiInterest = emiOutflow - principal;

  const bulletInterest = principal * monthlyRate * tenureMonths;
  const bulletOutflow = principal + bulletInterest;

  const t1 = Math.round(tenureMonths / 3);
  const t2 = Math.round(2 * tenureMonths / 3);
  
  let outstandingPrincipal = principal;
  
  // Simulated Month t1
  const interest = outstandingPrincipal * monthlyRate * t1;
  const pay1 = Math.round(principal * 0.3);
  const clearInt1 = Math.min(pay1, interest);
  const outstandingInterestLeft = interest - clearInt1;
  outstandingPrincipal -= (pay1 - clearInt1);

  // Simulated Month t2
  const interest2 = outstandingPrincipal * monthlyRate * (t2 - t1);
  const currentPendingInterest = outstandingInterestLeft + interest2;
  const pay2 = Math.round(principal * 0.4);
  const clearInt2 = Math.min(pay2, currentPendingInterest);
  outstandingPrincipal -= (pay2 - clearInt2);

  // Simulated End
  const interest3 = outstandingPrincipal * monthlyRate * (tenureMonths - t2);
  const totalInterestAccrued = interest + interest2 + interest3;
  
  const partialInterest = Math.round(totalInterestAccrued);
  const partialOutflow = principal + partialInterest;

  return [
    {
      type: 'Monthly EMI',
      interest: emiInterest,
      outflow: emiOutflow,
      bestFor: 'Individuals with a steady monthly salary.'
    },
    {
      type: 'Partial Payments',
      interest: partialInterest,
      outflow: partialOutflow,
      bestFor: 'Traders and shop owners with fluctuating cash flows.'
    },
    {
      type: 'Bullet Repayment',
      interest: bulletInterest,
      outflow: bulletOutflow,
      bestFor: 'Short-term emergency funding with a guaranteed future payout.'
    }
  ];
};

export default function GoldLoanPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'detail'
  const [selectedLoan, setSelectedLoan] = useState(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [goldWeight, setGoldWeight] = useState('');
  const [goldPurity, setGoldPurity] = useState('22KT');
  const [appraisedValue, setAppraisedValue] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [monthlyInterestRate, setMonthlyInterestRate] = useState('1.00'); // 1% default
  const interestRate = (parseFloat(monthlyInterestRate || 0) * 12).toFixed(2);
  const [repaymentMethod, setRepaymentMethod] = useState('bullet');
  const [tenureMonths, setTenureMonths] = useState('6'); // Default 6 months
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');

  // Repayment modal
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMode, setRepayMode] = useState('cash');
  const [repayNotes, setRepayNotes] = useState('');

  // Sync Daily Rates on app load to auto-appraise gold
  const [goldRates, setGoldRates] = useState({ rate24k: 76500, rate22k: 70150, rate18k: 57380 });

  const fetchLoansList = async () => {
    const { data: rates } = await db.getLatestRates();
    if (rates) setGoldRates(rates);
    const { data } = await db.getGoldLoans();
    if (data) setLoans(data);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLoansList();
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

  // Auto-appraise gold weight based on today's rate
  useEffect(() => {
    let active = true;
    const wt = parseFloat(goldWeight) || 0;
    if (wt > 0) {
      let rate = goldRates.rate22k / 10;
      if (goldPurity === '24KT') rate = goldRates.rate24k / 10;
      if (goldPurity === '18KT') rate = goldRates.rate18k / 10;
      const appraisal = wt * rate;
      setTimeout(() => {
        if (active) {
          setAppraisedValue(Math.round(appraisal).toString());
          setLoanAmount(Math.round(appraisal * 0.75).toString());
        }
      }, 0);
    }
    return () => { active = false; };
  }, [goldWeight, goldPurity, goldRates]);

  // Set due date automatically based on loan date and tenure months
  useEffect(() => {
    let active = true;
    if (loanDate) {
      const base = new Date(loanDate);
      const months = parseInt(tenureMonths) || 12;
      base.setMonth(base.getMonth() + months);
      setTimeout(() => {
        if (active) setDueDate(base.toISOString().split('T')[0]);
      }, 0);
    }
    return () => { active = false; };
  }, [loanDate, tenureMonths]);

  const handleOpenDetail = (loan) => {
    setSelectedLoan(loan);
    setView('detail');
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !goldWeight || !loanAmount) {
      return alert('Fill Name, Phone, Gold Weight, and Loan Amount.');
    }

    const { error } = await db.saveGoldLoan(
      customerName,
      customerPhone,
      customerAddress,
      parseFloat(goldWeight),
      goldPurity,
      parseFloat(appraisedValue),
      parseFloat(loanAmount),
      parseFloat(interestRate),
      loanDate,
      dueDate,
      repaymentMethod
    );

    if (!error) {
      alert('Gold Loan Logged Successfully!');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setGoldWeight('');
      fetchLoansList();
      setView('list');
    } else {
      alert('Gold loan log failed: ' + error.message);
    }
  };

  const handleRepaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter valid payment amount.');

    const { error } = await db.recordLoanRepayment(
      selectedLoan.id,
      amt,
      repayMode,
      repayNotes
    );

    if (!error) {
      alert('Repayment Recorded Successfully!');
      setShowRepayModal(false);
      setRepayAmount('');
      setRepayNotes('');
      // Reload details
      const { data } = await db.getGoldLoans();
      if (data) {
        setLoans(data);
        const updated = data.find(l => l.id === selectedLoan.id);
        setSelectedLoan(updated);
      }
    } else {
      alert('Failed to record repayment: ' + error.message);
    }
  };

  const handleCloseLoan = async () => {
    if (confirm('Verify release of pledged ornaments. Has the loan + interest been fully settled?')) {
      const { error } = await db.closeGoldLoan(selectedLoan.id);
      if (!error) {
        alert('Loan closed and Pledged Gold released to customer successfully!');
        const { data } = await db.getGoldLoans();
        if (data) {
          setLoans(data);
          const updated = data.find(l => l.id === selectedLoan.id);
          setSelectedLoan(updated);
        }
      }
    }
  };

  const handleWhatsAppReminder = (loan) => {
    const due = Math.max(0, loan.loan_amount - loan.total_repaid);
    const formattedDate = new Date(loan.due_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const customerName = loan.customers?.name || 'Customer';
    const customerPhone = loan.customers?.phone || '';
    const msg = `Dear *${customerName}*,\n\nFriendly reminder regarding your Gold Mortgage Loan *${loan.loan_number}* at *SHREE GANESH JEWELLERS*.\n\nDue Date: *${formattedDate}*\nOutstanding Principal: ₹*${due.toLocaleString('en-IN')}*.\n\nKindly visit our showroom to settle repayments and release your pledged ornaments. Thank you!`;
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : '';
    if (cleanPhone) {
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert('No phone number registered for this customer.');
    }
  };



  return (
    <Layout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              {view === 'list' ? 'Gold Mortgage Loans' : (view === 'add' ? 'Open Gold Loan mortgage' : `Loan details: ${selectedLoan?.loan_number}`)}
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              {view === 'list' ? 'Appraise pledged gold and log mortgage ledgers' : 'Provide collateral weight and interest parameters below'}
            </p>
          </div>
          {view === 'list' ? (
            <button
              onClick={() => setView('add')}
              className="px-3.5 py-2 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Loan Pledging
            </button>
          ) : (
            <button
              onClick={() => setView('list')}
              className="px-3.5 py-2 bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Back to Loans List
            </button>
          )}
        </div>

        {/* 1. LOANS LIST VIEW */}
        {view === 'list' && (
          <div className="bg-white border border-[#735c00]/15 rounded-3xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center space-y-2">
                <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Syncing Loans...</p>
              </div>
            ) : loans.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 italic">
                No mortgage loans registered in the database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/25 uppercase font-bold tracking-widest text-[9px]">
                      <th className="py-3 px-4">Loan No</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Collateral Pledged</th>
                      <th className="py-3 px-4 text-right">Sanctioned Loan</th>
                      <th className="py-3 px-4 text-right">Repaid</th>
                      <th className="py-3 px-4 text-center">Due Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans font-bold">
                    {loans.map((loan) => {
                      const isOverdue = loan.status === 'active' && new Date(loan.due_date) < new Date();
                      
                      return (
                        <tr key={loan.id} className="hover:bg-gray-50/70 transition-all">
                          <td className="py-3.5 px-4 font-mono text-[#570000]">{loan.loan_number}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-serif text-[#1c1b1b]">{loan.customers?.name || 'Unknown Borrower'}</div>
                            <div className="text-[10px] text-gray-400 font-mono font-medium">{loan.customers?.phone || 'N/A'}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-gray-600">
                            {loan.gold_weight.toFixed(3)}g ({loan.gold_purity})
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-850">₹{loan.loan_amount.toLocaleString('en-IN')}</td>
                          <td className="py-3.5 px-4 text-right text-green-700">₹{loan.total_repaid.toLocaleString('en-IN')}</td>
                          <td className="py-3.5 px-4 text-center text-gray-500 font-mono">
                            {new Date(loan.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${
                              loan.status === 'closed' 
                                ? 'bg-gray-100 text-gray-500' 
                                : (isOverdue ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-blue-100 text-blue-700')
                            }`}>
                              {isOverdue ? 'Overdue' : loan.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDetail(loan)}
                              className="px-2.5 py-1 rounded bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/20 text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              Details
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. CREATE LOAN MORTGAGE FORM */}
        {view === 'add' && (
          <div className="bg-white border border-[#735c00]/10 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-4 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-[#fed65b]" />
              Open Gold Loan Mortgage
            </h3>

            <form onSubmit={handleCreateLoan} className="space-y-4 font-bold">
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
                      placeholder="Enter customer name"
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
                  Full Customer Address
                </label>
                <textarea
                  placeholder="Street / Flat details, Kamothe"
                  rows={1}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Pledged Gold Weight (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.000"
                    value={goldWeight}
                    onChange={(e) => setGoldWeight(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Pledged Purity Value
                  </label>
                  <select
                    value={goldPurity}
                    onChange={(e) => setGoldPurity(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="22KT">22KT Gold</option>
                    <option value="18KT">18KT Gold</option>
                    <option value="14KT">14KT Gold</option>
                    <option value="24KT">24KT Fine Gold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Monthly Interest Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={monthlyInterestRate}
                      onChange={(e) => setMonthlyInterestRate(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-center"
                    />
                    <Percent className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                  <span className="text-[9px] text-[#735c00] font-sans block mt-0.5 font-bold">
                    = {interestRate}% Annual (p.a.)
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#735c00] uppercase mb-1">
                    Automated Appraised Value (Today's rates)
                  </label>
                  <div className="w-full bg-[#735c00]/5 text-[#735c00] border border-[#735c00]/25 rounded-xl px-4 py-2 text-xs font-mono font-bold text-right">
                    ₹{parseFloat(appraisedValue || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Sanctioned Loan Principal (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Repayment Method Option
                  </label>
                  <select
                    value={repaymentMethod}
                    onChange={(e) => setRepaymentMethod(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="bullet">Bullet Repayment Method</option>
                    <option value="emi">Regular Monthly EMI (Reducing Balance)</option>
                    <option value="partial">Partial Payment Method</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Mortgage Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Repayment Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              {parseFloat(loanAmount) > 0 && (
                <div className="p-4 bg-[#735c00]/5 border border-[#735c00]/25 rounded-2xl space-y-2">
                  <div className="text-[10px] uppercase font-bold text-[#735c00] tracking-wider border-b border-[#735c00]/20 pb-1">
                    Loan Repayment Estimate Preview
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold font-mono">
                    <div>
                      <span className="text-gray-400 block uppercase text-[9px]">Repayment Method:</span>
                      <span className="text-[#570000] uppercase font-serif text-[11px] font-bold">
                        {repaymentMethod === 'bullet' ? 'Bullet Repayment' : repaymentMethod === 'emi' ? 'Regular Monthly EMI' : 'Partial Payments'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase text-[9px]">
                        {repaymentMethod === 'emi' ? 'Expected Monthly EMI:' : 'Estimated Total Interest:'}
                      </span>
                      <span className="text-[#570000] text-xs font-bold">
                        {repaymentMethod === 'emi' ? (
                          `₹${calculateEMI(parseFloat(loanAmount) || 0, (parseFloat(monthlyInterestRate) || 0) / 100, parseInt(tenureMonths) || 12).toLocaleString('en-IN')}/mo`
                        ) : (
                          `₹${(Math.round((parseFloat(loanAmount) || 0) * ((parseFloat(monthlyInterestRate) || 0) / 100) * (parseInt(tenureMonths) || 12))).toLocaleString('en-IN')}`
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase text-[9px]">Total Repayment Outflow:</span>
                      <span className="text-gray-800 text-xs font-bold">
                        ₹{(
                          repaymentMethod === 'emi' ? (
                            calculateEMI(parseFloat(loanAmount) || 0, (parseFloat(monthlyInterestRate) || 0) / 100, parseInt(tenureMonths) || 12) * (parseInt(tenureMonths) || 12)
                          ) : (
                            (parseFloat(loanAmount) || 0) + (parseFloat(loanAmount) || 0) * ((parseFloat(monthlyInterestRate) || 0) / 100) * (parseInt(tenureMonths) || 12)
                          )
                        ).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-4 py-3.5 bg-[#570000] hover:bg-[#735c00] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                Log Gold Loan & Issue Pledge Receipt
              </button>
            </form>
          </div>
        )}

        {/* 3. DETAILS WORKSPACE VIEW */}
        {view === 'detail' && selectedLoan && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            
            {/* Repayments tracker log */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00]">
                    Repayment Transaction Journal
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold ${
                    selectedLoan.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-700'
                  }`}>
                    {selectedLoan.status}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 uppercase text-[8px] font-bold text-gray-500 tracking-wider">
                        <th className="py-2.5 px-3">Repayment Date</th>
                        <th className="py-2.5 px-3 text-right">Repaid Value</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Memo Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold">
                      {selectedLoan.loan_repayments && selectedLoan.loan_repayments.length > 0 ? (
                        selectedLoan.loan_repayments.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-gray-500 font-mono">
                              {new Date(r.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-green-700">
                              ₹{r.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-gray-500 font-mono text-[9px]">{r.payment_mode}</td>
                            <td className="py-2.5 px-3 text-gray-600 font-serif font-medium">{r.notes || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-gray-400 italic">
                            No repayments logged for this loan yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-gray-800 border-t border-gray-100 pt-3 flex-wrap gap-2">
                  <span>Sanctioned Principal: <strong className="font-mono">₹{selectedLoan.loan_amount.toLocaleString('en-IN')}</strong></span>
                  <span>Total Repaid: <strong className="text-green-700 font-mono">₹{selectedLoan.total_repaid.toLocaleString('en-IN')}</strong></span>
                </div>
              </div>

              {/* Expected EMI Amortization Schedule (Only for EMI Loans) */}
              {selectedLoan.repayment_method === 'emi' && (() => {
                const breakdown = calculateLoanBreakdown(selectedLoan);
                return (
                  <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2">
                      Expected Monthly EMI Amortization Schedule
                    </h3>
                    <div className="overflow-x-auto max-h-52 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 uppercase text-[8px] font-bold text-gray-500 tracking-wider">
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3 text-right">Interest Portion</th>
                            <th className="py-2 px-3 text-right">Principal Portion</th>
                            <th className="py-2 px-3 text-right">Outstanding Principal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-sans font-bold">
                          {breakdown.amortizationSchedule?.map((sch) => (
                            <tr key={sch.month} className="hover:bg-gray-50/50">
                              <td className="py-2 px-3 font-mono text-gray-500">Month {sch.month}</td>
                              <td className="py-2 px-3 text-right font-mono text-[#570000]">₹{sch.interest.toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right font-mono text-green-700">₹{sch.principalPaid.toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right font-mono text-gray-700">₹{sch.remainingPrincipal.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Repayment Comparison Summary Card */}
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2">
                  Repayment Option Comparison Summary
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 uppercase text-[8px] font-bold text-gray-500 tracking-wider">
                        <th className="py-2.5 px-3">Repayment Type</th>
                        <th className="py-2.5 px-3 text-right">Total Interest</th>
                        <th className="py-2.5 px-3 text-right">Total Outflow</th>
                        <th className="py-2.5 px-3">Best Used For</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans font-bold">
                      {generateComparisonSummary(
                        selectedLoan.loan_amount,
                        (selectedLoan.interest_rate / 12) / 100,
                        getLoanTenureMonths(selectedLoan)
                      ).map((summary, idx) => {
                        const loanMethod = selectedLoan.repayment_method || 'bullet';
                        const isCurrent = loanMethod === (summary.type === 'Monthly EMI' ? 'emi' : summary.type === 'Partial Payments' ? 'partial' : 'bullet');
                        return (
                          <tr key={idx} className={`${isCurrent ? 'bg-[#735c00]/5 text-[#570000]' : 'hover:bg-gray-50/50'}`}>
                            <td className="py-2.5 px-3 font-serif flex items-center gap-1.5">
                              {summary.type}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 bg-[#570000] text-[#fed65b] rounded text-[8px] uppercase tracking-wider font-extrabold">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#570000]">
                              ₹{summary.interest.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              ₹{summary.outflow.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 font-sans font-medium text-[10px]">
                              {summary.bestFor}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Side summary panel */}
            <div className="space-y-6">
              
              <div className="bg-white border border-[#735c00]/15 rounded-3xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-1.5">
                  Mortgage Account Summary
                </h4>
                
                <div className="space-y-2 text-xs font-bold">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loan Number:</span>
                    <span className="text-[#570000] font-mono">{selectedLoan.loan_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Borrower:</span>
                    <span className="text-gray-800 font-serif">{selectedLoan.customers?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-gray-800 font-mono">{selectedLoan.customers?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Collateral Gold:</span>
                    <span className="text-gray-800 font-mono">{selectedLoan.gold_weight.toFixed(3)}g ({selectedLoan.gold_purity})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Appraised Value:</span>
                    <span className="text-gray-800 font-mono">₹{selectedLoan.appraised_value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Interest Rate:</span>
                    <span className="text-gray-800 font-mono">{selectedLoan.interest_rate}% p.a.</span>
                  </div>
                  
                  {selectedLoan.status === 'active' && (() => {
                    const breakdown = calculateLoanBreakdown(selectedLoan);
                    return (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 space-y-1 mt-2 text-[11px]">
                        <div className="flex justify-between font-black border-b border-red-200/50 pb-1 mb-1">
                          <span>Pledge Accruals Tally</span>
                          <Coins className="h-4 w-4 text-[#570000]" />
                        </div>
                        <div className="flex justify-between text-gray-500 font-sans text-[10px] uppercase">
                          <span>Repayment Type:</span>
                          <span className="font-serif font-bold text-[#570000]">{selectedLoan.repayment_method === 'emi' ? 'EMI Reducing' : selectedLoan.repayment_method === 'partial' ? 'Partial' : 'Bullet'}</span>
                        </div>
                        {selectedLoan.repayment_method === 'emi' && (
                          <div className="flex justify-between font-black text-[#570000] mb-0.5">
                            <span>Monthly EMI:</span>
                            <span className="font-mono">₹{breakdown.emiAmount.toLocaleString('en-IN')}/mo</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Sanctioned Principal:</span>
                          <span className="font-mono font-bold">₹{selectedLoan.loan_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accrued Interest:</span>
                          <span className="font-mono text-[#570000]">₹{breakdown.accruedInterest.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between border-t border-red-200 pt-1 font-black">
                          <span>Total Due Balance:</span>
                          <span className="font-mono">₹{breakdown.totalDue.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 font-bold">
                  {selectedLoan.status === 'active' && (
                    <>
                      <button
                        onClick={() => setShowRepayModal(true)}
                        className="w-full py-2.5 bg-[#fed65b] border border-[#735c00]/40 text-[#570000] rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                      >
                        Record Repayment
                      </button>
                      <button
                        onClick={() => handleWhatsAppReminder(selectedLoan)}
                        className="w-full py-2.5 bg-[#570000]/10 hover:bg-[#570000] text-[#570000] hover:text-white border border-[#570000]/25 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send Repayment Reminder
                      </button>
                      
                      {selectedLoan.total_repaid >= selectedLoan.loan_amount && (
                        <button
                          onClick={handleCloseLoan}
                          className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all animate-bounce"
                        >
                          <ShieldCheck className="h-4 w-4 text-[#fed65b]" />
                          Close Loan & Release Gold
                        </button>
                      )}
                    </>
                  )}

                  {selectedLoan.status === 'closed' && (
                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl text-center text-xs italic font-bold">
                      collateral ornaments returned to customer. Account closed.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Record Repayment Modal */}
      {showRepayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#570000] px-5 py-3 text-[#fed65b] font-bold flex items-center justify-between border-b border-[#735c00]/30">
              <h3 className="font-serif text-sm tracking-wider uppercase">Record Repayment</h3>
              <button onClick={() => setShowRepayModal(false)} className="text-white">✕</button>
            </div>
            
            <form onSubmit={handleRepaymentSubmit} className="p-5 space-y-4 font-bold">
              <div className="text-xs text-gray-600">
                Loan Ref: <span className="text-gray-900 font-mono">{selectedLoan.loan_number}</span>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Repayment Amount Paid (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="Enter repayment amount"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Payment Mode
                </label>
                <select
                  value={repayMode}
                  onChange={(e) => setRepayMode(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2.5 py-2 text-xs"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="card">Card Payment</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Principal instalment"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="w-full bg-white border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm"
                >
                  Log Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
