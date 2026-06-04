import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Download, TrendingUp, Layers, Coins, UserPlus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [buybacks, setBuybacks] = useState([]);

  // Date filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Report statistics
  const [stats, setStats] = useState({
    totalBills: 0,
    totalRevenue: 0,
    goldWeight: 0,
    silverWeight: 0,
    oldGoldExchanged: 0,
    oldSilverExchanged: 0,
    outstandingDues: 0,
    makingCharges: 0,
    newCustomersCount: 0
  });

  const [chartData, setChartData] = useState([]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: invs } = await db.getInvoices();
      const { data: urd } = await db.getUrdTransactions();
      
      const { data: custs } = await supabase
        .from('customers')
        .select('*');

      const filteredInvs = invs ? invs.filter(inv => {
        const d = inv.bill_date;
        return d >= startDate && d <= endDate;
      }) : [];

      const filteredUrd = urd ? urd.filter(t => {
        const d = t.transaction_date.split('T')[0];
        return d >= startDate && d <= endDate;
      }) : [];

      // Calculate totals
      let totalRevenue = 0;
      let goldWeight = 0;
      let silverWeight = 0;
      let oldGold = 0;
      let oldSilver = 0;
      let outstanding = 0;
      let making = 0;

      // Sum payments inside these invoices
      filteredInvs.forEach(inv => {
        outstanding += parseFloat(inv.balance_due) || 0;
        
        if (inv.payments) {
          inv.payments.forEach(p => {
            const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
            if (pDate >= startDate && pDate <= endDate) {
              totalRevenue += parseFloat(p.amount) || 0;
            }
          });
        }

        if (inv.bill_items) {
          inv.bill_items.forEach(item => {
            const net = parseFloat(item.net_weight) || 0;
            const rate = parseFloat(item.per_gram_rate) || 0;
            if (item.metal_type === 'gold') {
              goldWeight += net;
              making += (net * rate) * (parseFloat(item.making_charges_percent) / 100);
            } else {
              silverWeight += net;
              making += net * (parseFloat(item.labour_per_gram) || 0);
            }
          });
        }
      });

      // Sum URD transactions
      filteredUrd.forEach(t => {
        const wt = parseFloat(t.weight) || 0;
        if (t.metal_type === 'gold') {
          oldGold += wt;
        } else {
          oldSilver += wt;
        }
      });

      // Calculate new customers created in date range
      const newCusts = custs ? custs.filter(c => {
        const d = c.created_at ? c.created_at.split('T')[0] : '';
        return d >= startDate && d <= endDate;
      }).length : 0;

      setStats({
        totalBills: filteredInvs.length,
        totalRevenue,
        goldWeight,
        silverWeight,
        oldGoldExchanged: oldGold,
        oldSilverExchanged: oldSilver,
        outstandingDues: outstanding,
        makingCharges: Math.round(making),
        newCustomersCount: newCusts
      });

      // Format chart modes
      let c = 0, u = 0, cr = 0, n = 0;
      filteredInvs.forEach(inv => {
        if (inv.payments) {
          inv.payments.forEach(p => {
            const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
            if (pDate >= startDate && pDate <= endDate) {
              const amt = parseFloat(p.amount) || 0;
              const mode = p.payment_mode.toLowerCase();
              if (mode === 'cash') c += amt;
              if (mode === 'upi') u += amt;
              if (mode === 'card') cr += amt;
              if (mode === 'netbanking') n += amt;
            }
          });
        }
      });

      setChartData([
        { name: 'CASH', Amount: c, fill: '#570000' },
        { name: 'UPI', Amount: u, fill: '#fed65b' },
        { name: 'CARD', Amount: cr, fill: '#735c00' },
        { name: 'NET BANK', Amount: n, fill: '#1c1b1b' }
      ]);

      setInvoices(filteredInvs);
      setBuybacks(filteredUrd);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(87, 0, 0);
    doc.text('SHREE GANESH JEWELLERS', 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('times', 'normal');
    doc.text(`Shop Audit Journal: ${startDate} to ${endDate}`, 14, 24);
    doc.line(14, 27, 196, 27);

    // Stats Grid table
    const statData = [
      ['Bills Generated', stats.totalBills, 'Gold Metal Sold', `${stats.goldWeight.toFixed(3)}g`],
      ['Total Cash Inflows', `Rs ${stats.totalRevenue.toLocaleString('en-IN')}`, 'Silver Metal Sold', `${stats.silverWeight.toFixed(3)}g`],
      ['Outstanding Balances', `Rs ${stats.outstandingDues.toLocaleString('en-IN')}`, 'Old Gold Exchanged', `${stats.oldGoldExchanged.toFixed(3)}g`],
      ['Making Charges Accrued', `Rs ${stats.makingCharges.toLocaleString('en-IN')}`, 'New Customers Added', stats.newCustomersCount]
    ];

    autoTable(doc, {
      startY: 32,
      head: [['Metric', 'Summary Value', 'Metal Metric', 'Total Weight']],
      body: statData,
      theme: 'grid',
      headStyles: { fillColor: [87, 0, 0], textColor: [254, 214, 91] },
      styles: { font: 'times', fontStyle: 'bold' }
    });

    // Invoices list table
    const billsRows = invoices.map(inv => [
      inv.bill_number,
      inv.customers?.name || 'Walk-in Customer',
      inv.customers?.phone || 'N/A',
      `Rs ${inv.total_amount.toLocaleString('en-IN')}`,
      `Rs ${inv.amount_paid.toLocaleString('en-IN')}`,
      (inv.payment_status || '').toUpperCase()
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Bill Number', 'Customer Name', 'Contact Phone', 'Total Payable', 'Amount Paid', 'Status']],
      body: billsRows,
      theme: 'striped',
      headStyles: { fillColor: [115, 92, 0] }
    });

    doc.save(`SGJ_Audit_Report_${startDate}_${endDate}.pdf`);
  };

  const handleExportTodayPDF = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: invs } = await db.getInvoices();
      
      const todayInvs = invs ? invs.filter(inv => inv.bill_date === todayStr) : [];
      
      // Calculate today's stats
      let todaySalesAmount = 0;
      let todayReceivedAmount = 0;
      let todayItemsCount = 0;
      
      todayInvs.forEach(inv => {
        todaySalesAmount += parseFloat(inv.total_amount) || 0;
        
        if (inv.payments) {
          inv.payments.forEach(p => {
            const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
            if (pDate === todayStr) {
              todayReceivedAmount += parseFloat(p.amount) || 0;
            }
          });
        }
        
        if (inv.bill_items) {
          todayItemsCount += inv.bill_items.length;
        }
      });
      
      const doc = new jsPDF();
      
      // Header
      doc.setFont('times', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(87, 0, 0);
      doc.text('SHREE GANESH JEWELLERS', 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.setFont('times', 'normal');
      doc.text(`Daily Activity Report - Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 14, 26);
      doc.line(14, 29, 196, 29);
      
      // Stats Summary
      const summaryData = [
        ['Total Bills Created Today', todayInvs.length.toString()],
        ['Total Revenue Generated Today (Sales)', `Rs ${todaySalesAmount.toLocaleString('en-IN')}`],
        ['Total Cash/Inflow Received Today', `Rs ${todayReceivedAmount.toLocaleString('en-IN')}`],
        ['Total Stock Items Sold Today', todayItemsCount.toString()]
      ];
      
      autoTable(doc, {
        startY: 34,
        head: [['Today\'s Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [87, 0, 0], textColor: [254, 214, 91] },
        styles: { font: 'times', fontStyle: 'bold', fontSize: 10 }
      });
      
      // List of Bills Today
      const todayBillsRows = todayInvs.map(inv => [
        inv.bill_number,
        inv.customers?.name || 'Walk-in Customer',
        inv.customers?.phone || 'N/A',
        `Rs ${inv.total_amount.toLocaleString('en-IN')}`,
        `Rs ${inv.amount_paid.toLocaleString('en-IN')}`,
        (inv.payment_status || '').toUpperCase()
      ]);
      
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(87, 0, 0);
      doc.text("Today's Transaction Invoices Ledger", 14, doc.lastAutoTable.finalY + 10);
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [['Bill Number', 'Customer Name', 'Contact Phone', 'Total Payable', 'Amount Paid', 'Status']],
        body: todayBillsRows.length > 0 ? todayBillsRows : [['-', 'No transactions logged today', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [115, 92, 0], textColor: [255, 255, 255] },
        styles: { font: 'times', fontSize: 9 }
      });
      
      doc.save(`SGJ_Today_Report_${todayStr}.pdf`);
    } catch (error) {
      console.error('Error generating today\'s report:', error);
      alert('Failed to download today\'s report: ' + error.message);
    }
  };

  const handleSetQuickRange = (range) => {
    const today = new Date();
    if (range === 'today') {
      const t = today.toISOString().split('T')[0];
      setStartDate(t);
      setEndDate(t);
    } else if (range === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (range === 'year') {
      const start = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 no-print">
        
        {/* Module Header */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              Daily & Monthly Audit
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Monitor inflows, metals weights, and download PDF audits
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportTodayPDF}
              className="px-3.5 py-2 bg-[#fed65b] border border-[#735c00]/40 text-[#570000] hover:bg-[#fed65b]/80 font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download Today's Report
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export PDF Report
            </button>
          </div>
        </div>

        {/* Date Filters Card */}
        <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Audit Range Parameters
            </h3>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleSetQuickRange('today')}
                className="px-2.5 py-1 text-[9px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => handleSetQuickRange('month')}
                className="px-2.5 py-1 text-[9px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md cursor-pointer"
              >
                This Month
              </button>
              <button
                onClick={() => handleSetQuickRange('year')}
                className="px-2.5 py-1 text-[9px] font-bold uppercase bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md cursor-pointer"
              >
                This Year
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 font-bold text-xs">
            <div>
              <label className="block text-[9px] text-gray-400 uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 font-mono text-center focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 uppercase mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 font-mono text-center focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Audit Stats Grid */}
        {loading ? (
          <div className="p-12 text-center bg-white border border-[#735c00]/10 rounded-3xl">
            <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400 italic">Recalculating statistics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Row 1 Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-bold">
              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Revenue Collections</span>
                  <TrendingUp className="h-4 w-4 text-[#570000]/30" />
                </div>
                <h3 className="text-base font-black text-[#570000] mt-2">₹{stats.totalRevenue.toLocaleString('en-IN')}</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Gold Ornaments Sold</span>
                  <Layers className="h-4 w-4 text-[#735c00]/30" />
                </div>
                <h3 className="text-base font-black text-yellow-800 mt-2">{stats.goldWeight.toFixed(3)} g</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Silver Ornaments Sold</span>
                  <Layers className="h-4 w-4 text-gray-400" />
                </div>
                <h3 className="text-base font-black text-gray-600 mt-2">{stats.silverWeight.toFixed(3)} g</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Old Gold Exchange</span>
                  <Coins className="h-4 w-4 text-emerald-600/30" />
                </div>
                <h3 className="text-base font-black text-emerald-700 mt-2">{stats.oldGoldExchanged.toFixed(3)} g</h3>
              </div>
            </div>

            {/* Row 2 Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-bold">
              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Outstanding Dues Ledger</div>
                <h3 className="text-base font-black text-red-600 mt-2">₹{stats.outstandingDues.toLocaleString('en-IN')}</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest">Labour Making Charges</div>
                <h3 className="text-base font-black text-[#735c00] mt-2">₹{stats.makingCharges.toLocaleString('en-IN')}</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Invoice count</div>
                <h3 className="text-base font-black text-gray-800 mt-2">{stats.totalBills} Bills</h3>
              </div>

              <div className="bg-white border border-[#735c00]/10 rounded-2xl p-4 flex flex-col justify-between h-24">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest flex items-center justify-between">
                  <span>New Customer Added</span>
                  <UserPlus className="h-4 w-4 text-gray-300" />
                </div>
                <h3 className="text-base font-black text-blue-700 mt-2">{stats.newCustomersCount} Registries</h3>
              </div>
            </div>

            {/* Inflows Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Payment Mode breakdown chart */}
              <div className="lg:col-span-2 bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2">
                  Revenue Collection by Payment Modes
                </h3>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" stroke="#735c00" fontSize={10} fontWeight="bold" />
                      <YAxis fontSize={9} fontWeight="bold" />
                      <Tooltip formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']} />
                      <Bar dataKey="Amount" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transactions journal brief */}
              <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-3">
                    Bazar Exchange summary
                  </h3>
                  <div className="text-xs font-bold space-y-2 mt-2">
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-gray-400">Old Gold Received:</span>
                      <span className="text-gray-800 font-mono">{stats.oldGoldExchanged.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-gray-400">Old Silver Received:</span>
                      <span className="text-gray-800 font-mono">{stats.oldSilverExchanged.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Old Gold Direct buybacks:</span>
                      <span className="text-red-600 font-mono">
                        {buybacks.filter(t => t.transaction_type === 'buyback').reduce((sum, t) => sum + t.weight, 0).toFixed(3)} g
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl mt-4">
                  <p className="text-[10px] text-yellow-900 leading-relaxed font-bold italic">
                    💡 This report calculates data inside the selected date range. Click "Export PDF Report" to download a clean paper ledger copy for your records.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </Layout>
  );
}
