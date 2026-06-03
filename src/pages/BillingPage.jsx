import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { 
  Plus, Trash2, Save, Sparkles, User, MapPin, Phone, 
  CreditCard, Edit, Printer, Share2, Search, ArrowRightLeft, Gem
} from 'lucide-react';
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const PARTICULARS_SUGGESTIONS = [
  'Ring', 'Necklace', 'Gold Bar', 'Gold Coin',
  'Earrings', 'Bangles', 'Bangle Set', 'Chain',
  'Bracelet', 'Pendant', 'Mangalsutra', 'Anklet',
  'Nose Ring', 'Tikka', 'Mangalsutra Pendant'
];

export default function BillingPage() {
  // Navigation states
  const [view, setView] = useState('ledger'); // 'ledger' | 'form' | 'print' | 'urd_form' | 'print_urd'
  const [ledgerTab, setLedgerTab] = useState('sales'); // 'sales' | 'urd'
  
  // Data lists
  const [invoices, setInvoices] = useState([]);
  const [urdTransactions, setUrdTransactions] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Search/Filters in Ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dynamic rates (synced from DB)
  const [goldRates, setGoldRates] = useState({ rate24k: 76500, rate22k: 70150, rate18k: 57380, rate_silver: 920 });

  // Selected invoice for Printing / Dues settlement
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedUrd, setSelectedUrd] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState('cash');

  // URD Payout / Standalone form states
  const [urdCustomerName, setUrdCustomerName] = useState('');
  const [urdCustomerPhone, setUrdCustomerPhone] = useState('');
  const [urdCustomerAddress, setUrdCustomerAddress] = useState('');
  const [urdMetalType, setUrdMetalType] = useState('gold');
  const [urdPurity, setUrdPurity] = useState('22KT');
  const [urdWeight, setUrdWeight] = useState('');
  const [urdRatePerGram, setUrdRatePerGram] = useState('');
  const [urdNarration, setUrdNarration] = useState('');
  const [urdPaymentMode, setUrdPaymentMode] = useState('cash');
  const [urdDate, setUrdDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states (Creating / Editing)
  const [editingId, setEditingId] = useState(null); // Null if new bill
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [cityPin, setCityPin] = useState('Kamothe, NAVI MUMBAI - 410209');
  const [panNumber, setPanNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [printGst, setPrintGst] = useState(true);
  
  const [items, setItems] = useState([
    {
      id: generateUUID(),
      stock_id: '',
      item_number: '',
      ornament_name: '',
      metal_type: 'gold',
      gross_weight: '',
      stone_weight: '0',
      net_weight: '',
      purity: '22KT',
      per_gram_rate: '',
      making_charges_percent: '11',
      other_charges: '0',
      labour_per_gram: '0',
      hsn_code: '7113'
    }
  ]);

  // Old Gold Exchange States
  const [hasExchange, setHasExchange] = useState(false);
  const [exchangeMetal, setExchangeMetal] = useState('gold');
  const [exchangePurity, setExchangePurity] = useState('22KT');
  const [exchangeWeight, setExchangeWeight] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');

  // Payment splits
  const [cashPaid, setCashPaid] = useState('');
  const [upiPaid, setUpiPaid] = useState('');
  const [cardPaid, setCardPaid] = useState('');
  const [netBankingPaid, setNetBankingPaid] = useState('');
  const [paymentCategory, setPaymentCategory] = useState('full'); // 'full' | 'partial' | 'unpaid'

  // Autocomplete UI triggers
  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState(null);
  const [activeItemNoSuggestionRowId, setActiveItemNoSuggestionRowId] = useState(null);

  async function fetchRatesAndLedger() {
    setLoadingLedger(true);
    const { data: currentRates } = await db.getLatestRates();
    if (currentRates) {
      setGoldRates(currentRates);
    }
    const { data: invs } = await db.getInvoices();
    if (invs) setInvoices(invs);
    const { data: urds } = await db.getUrdTransactions();
    if (urds) setUrdTransactions(urds.filter(t => t.transaction_type === 'buyback'));
    const { data: stockItems } = await db.getStock();
    if (stockItems) setStockList(stockItems.filter(s => s.status === 'available'));
    setLoadingLedger(false);
  }

  // Sync Daily Rates on start
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRatesAndLedger();
    }, 0);
    const handleRatesUpdate = (e) => {
      setGoldRates(e.detail);
    };
    window.addEventListener('rates-updated', handleRatesUpdate);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('rates-updated', handleRatesUpdate);
    };
  }, []);

  // Autocomplete auto-fill phone details
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '');
    if (clean.length === 10) {
      db.searchCustomerByPhone(clean).then(({ data }) => {
        if (data) {
          setCustomerName(data.name);
          setCustomerAddress(data.address || '');
          setPanNumber(data.pan_number || '');
          setGstNumber(data.gst_number || '');
        }
      });
    }
  }, [customerPhone]);

  // Autocomplete auto-fill URD phone details
  useEffect(() => {
    const clean = urdCustomerPhone.replace(/\D/g, '');
    if (clean.length === 10) {
      db.searchCustomerByPhone(clean).then(({ data }) => {
        if (data) {
          setUrdCustomerName(data.name);
          setUrdCustomerAddress(data.address || '');
        }
      });
    }
  }, [urdCustomerPhone]);

  // Trigger loading gold rate per gram
  const getRatePerGram = (metal, purity) => {
    if (!goldRates) return 0;
    if (metal === 'silver') return parseFloat(goldRates.rate_silver) || 0;
    if (purity === '24KT') return (parseFloat(goldRates.rate24k) || 0) / 10;
    if (purity === '22KT') return (parseFloat(goldRates.rate22k) || 0) / 10;
    if (purity === '18KT') return (parseFloat(goldRates.rate18k) || 0) / 10;
    return 0;
  };

  // Form math calculators
  const calculateRowAmount = (row) => {
    const gross = parseFloat(row.gross_weight) || 0;
    const stone = parseFloat(row.stone_weight) || 0;
    const net = Math.max(0, gross - stone);
    const rate = parseFloat(row.per_gram_rate) || 0;
    const making = parseFloat(row.making_charges_percent) || 0;
    const other = parseFloat(row.other_charges) || 0;
    const labour = parseFloat(row.labour_per_gram) || 0;

    const base = row.metal_type === 'gold'
      ? (net * rate) + (net * rate * (making / 100)) + other
      : (net * rate) + (net * labour) + other;

    const gstRate = row.metal_type === 'gold' ? 3.00 : 0.00;
    const total = base * (1 + gstRate / 100);
    return Math.round(total);
  };

  const computedRowAmounts = items.map(calculateRowAmount);
  
  const subtotal = items.reduce((sum, item) => {
    const gross = parseFloat(item.gross_weight) || 0;
    const stone = parseFloat(item.stone_weight) || 0;
    const net = Math.max(0, gross - stone);
    const rate = parseFloat(item.per_gram_rate) || 0;
    const making = parseFloat(item.making_charges_percent) || 0;
    const other = parseFloat(item.other_charges) || 0;
    const labour = parseFloat(item.labour_per_gram) || 0;

    const base = item.metal_type === 'gold'
      ? (net * rate) + (net * rate * (making / 100)) + other
      : (net * rate) + (net * labour) + other;
    return sum + base;
  }, 0);

  const gstAmount = items.reduce((sum, item) => {
    if (item.metal_type === 'silver') return sum;
    const gross = parseFloat(item.gross_weight) || 0;
    const stone = parseFloat(item.stone_weight) || 0;
    const net = Math.max(0, gross - stone);
    const rate = parseFloat(item.per_gram_rate) || 0;
    const making = parseFloat(item.making_charges_percent) || 0;
    const other = parseFloat(item.other_charges) || 0;

    const base = (net * rate) + ((net * rate) * (making / 100)) + other;
    return sum + (base * 0.03);
  }, 0);

  const exchangeWeightVal = parseFloat(exchangeWeight) || 0;
  const exchangeRateVal = parseFloat(exchangeRate) || 0;
  
  const exchangeAmt = (() => {
    if (!hasExchange) return 0;
    if (exchangeMetal === 'gold') {
      let purityNum = 22;
      if (exchangePurity.includes('18')) purityNum = 18;
      else if (exchangePurity.includes('14')) purityNum = 14;
      else if (exchangePurity.includes('24')) purityNum = 24;
      return Math.round(exchangeWeightVal * exchangeRateVal * (purityNum / 24));
    }
    return Math.round(exchangeWeightVal * exchangeRateVal);
  })();

  const totalBeforeRound = subtotal + gstAmount - exchangeAmt;
  const netPayable = Math.max(0, Math.round(totalBeforeRound));
  const roundOff = parseFloat((netPayable - totalBeforeRound).toFixed(2));

  // Payment totals logic
  const tCash = paymentCategory === 'unpaid' ? 0 : (parseFloat(cashPaid) || 0);
  const tUpi = paymentCategory === 'unpaid' ? 0 : (parseFloat(upiPaid) || 0);
  const tCard = paymentCategory === 'unpaid' ? 0 : (parseFloat(cardPaid) || 0);
  const tNet = paymentCategory === 'unpaid' ? 0 : (parseFloat(netBankingPaid) || 0);
  const amountPaid = tCash + tUpi + tCard + tNet;
  const balanceDue = Math.max(0, netPayable - amountPaid);
  const paymentStatus = paymentCategory === 'unpaid' ? 'unpaid' : (balanceDue === 0 ? 'paid' : 'partial');

  // Auto-fill or adjust cash paid to ensure full payment tallies
  useEffect(() => {
    const timer = setTimeout(() => {
      if (paymentCategory === 'full') {
        const otherPaid = tUpi + tCard + tNet;
        const diff = Math.max(0, netPayable - otherPaid);
        setCashPaid(diff > 0 ? diff.toString() : '0');
      } else if (paymentCategory === 'unpaid') {
        setCashPaid('');
        setUpiPaid('');
        setCardPaid('');
        setNetBankingPaid('');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [netPayable, tUpi, tCard, tNet, paymentCategory]);

  const handlePaymentCategoryChange = (cat) => {
    setPaymentCategory(cat);
    if (cat === 'full') {
      setCashPaid(netPayable.toString());
      setUpiPaid('');
      setCardPaid('');
      setNetBankingPaid('');
    } else if (cat === 'partial') {
      setCashPaid(Math.round(netPayable * 0.5).toString());
      setUpiPaid('');
      setCardPaid('');
      setNetBankingPaid('');
    } else {
      setCashPaid('');
      setUpiPaid('');
      setCardPaid('');
      setNetBankingPaid('');
    }
  };

  const handleUpdateItem = (id, field, val) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      
      // Auto gross to net
      if (field === 'gross_weight') {
        const stone = parseFloat(item.stone_weight) || 0;
        updated.net_weight = (parseFloat(val) - stone).toFixed(3);
      }
      if (field === 'stone_weight') {
        const gross = parseFloat(item.gross_weight) || 0;
        updated.net_weight = (gross - parseFloat(val)).toFixed(3);
      }
      
      // Auto rates setting on metal/purity change
      if (field === 'metal_type') {
        updated.purity = val === 'gold' ? '22KT' : '925 silver';
        updated.per_gram_rate = getRatePerGram(val, updated.purity).toFixed(2);
        updated.hsn_code = val === 'gold' ? '7113' : '7114';
      }
      if (field === 'purity') {
        updated.per_gram_rate = getRatePerGram(item.metal_type, val).toFixed(2);
      }

      return updated;
    }));
  };

  const handleSelectItemNo = (rowId, stockItem) => {
    setItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return {
        ...item,
        stock_id: stockItem.id,
        item_number: stockItem.item_number,
        ornament_name: stockItem.ornament_name,
        metal_type: stockItem.metal_type,
        purity: stockItem.purity,
        gross_weight: stockItem.weight.toString(),
        net_weight: stockItem.weight.toString(),
        stone_weight: '0',
        per_gram_rate: getRatePerGram(stockItem.metal_type, stockItem.purity).toFixed(2),
        hsn_code: stockItem.hsn_code || (stockItem.metal_type === 'gold' ? '7113' : '7114')
      };
    }));
    setActiveItemNoSuggestionRowId(null);
  };

  const handleAddRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: generateUUID(),
        stock_id: '',
        item_number: '',
        ornament_name: '',
        metal_type: 'gold',
        gross_weight: '',
        stone_weight: '0',
        net_weight: '',
        purity: '22KT',
        per_gram_rate: ((goldRates?.rate22k || 0) / 10).toFixed(2),
        making_charges_percent: '11',
        other_charges: '0',
        labour_per_gram: '0',
        hsn_code: '7113'
      }
    ]);
  };

  const handleRemoveRow = (id) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleOpenNewBill = () => {
    setEditingId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPanNumber('');
    setGstNumber('');
    setBillDate(new Date().toISOString().split('T')[0]);
    setPrintGst(true);
    setHasExchange(false);
    setExchangeWeight('');
    setExchangeRate('');
    setCashPaid('');
    setUpiPaid('');
    setCardPaid('');
    setNetBankingPaid('');
    setPaymentCategory('full');
    setItems([
      {
        id: generateUUID(),
        stock_id: '',
        item_number: '',
        ornament_name: '',
        metal_type: 'gold',
        gross_weight: '',
        stone_weight: '0',
        net_weight: '',
        purity: '22KT',
        per_gram_rate: ((goldRates?.rate22k || 0) / 10).toFixed(2),
        making_charges_percent: '11',
        other_charges: '0',
        labour_per_gram: '0',
        hsn_code: '7113'
      }
    ]);
    setView('form');
  };

  const handleOpenNewUrd = () => {
    setUrdCustomerName('');
    setUrdCustomerPhone('');
    setUrdCustomerAddress('');
    setUrdMetalType('gold');
    setUrdPurity('22KT');
    setUrdWeight('');
    setUrdRatePerGram(((goldRates?.rate22k || 0) / 10).toFixed(2));
    setUrdNarration('');
    setUrdPaymentMode('cash');
    setUrdDate(new Date().toISOString().split('T')[0]);
    setView('urd_form');
  };

  const handleSaveUrd = async (e) => {
    e.preventDefault();
    if (!urdCustomerName.trim()) return alert('Please enter Customer Name');
    if (!urdCustomerPhone.trim() || urdCustomerPhone.replace(/\D/g, '').length !== 10) {
      return alert('Please enter a valid 10-digit Phone Number');
    }
    const wt = parseFloat(urdWeight) || 0;
    const rate = parseFloat(urdRatePerGram) || 0;
    if (wt <= 0 || rate <= 0) return alert('Please enter valid weight and rate per gram.');

    const totalVal = Math.round(wt * rate);

    const res = await db.saveDirectUrdBuyback(
      urdCustomerName,
      urdCustomerPhone,
      urdCustomerAddress,
      urdMetalType,
      urdPurity,
      wt,
      rate,
      totalVal,
      urdPaymentMode,
      urdNarration
    );

    if (!res.error) {
      alert('URD Standalone Buyback Logged Successfully!');
      fetchRatesAndLedger();
      setLedgerTab('urd');
      setView('ledger');
    } else {
      alert('URD transaction saving failed: ' + res.error.message);
    }
  };

  const handleOpenEditBill = (inv) => {
    setEditingId(inv.id);
    setCustomerName(inv.customers?.name || '');
    setCustomerPhone(inv.customers?.phone || '');
    setCustomerAddress(inv.customers?.address || '');
    setPanNumber(inv.customers?.pan_number || '');
    setGstNumber(inv.customers?.gst_number || '');
    setBillDate(inv.bill_date);
    setPrintGst(inv.print_gst);
    
    // Set exchange if exists
    const internalExchange = inv.urd_transactions?.find(t => t.transaction_type === 'exchange');
    if (internalExchange) {
      setHasExchange(true);
      setExchangeMetal(internalExchange.metal_type);
      setExchangePurity(internalExchange.purity);
      setExchangeWeight(internalExchange.weight.toString());
      setExchangeRate(internalExchange.rate_per_gram.toString());
    } else {
      setHasExchange(false);
    }

    // Set items mapping
    const mappedItems = (inv.bill_items || []).map(item => ({
      id: generateUUID(),
      stock_id: item.stock_id || '',
      item_number: item.item_number || '',
      ornament_name: item.ornament_name,
      metal_type: item.metal_type,
      gross_weight: (item.gross_weight ?? 0).toString(),
      stone_weight: (item.stone_weight ?? 0).toString(),
      net_weight: (item.net_weight ?? 0).toString(),
      purity: item.purity,
      per_gram_rate: (item.per_gram_rate ?? 0).toString(),
      making_charges_percent: (item.making_charges_percent ?? 0).toString(),
      other_charges: (item.other_charges ?? 0).toString(),
      labour_per_gram: (item.labour_per_gram ?? 0).toString(),
      hsn_code: item.hsn_code
    }));
    setItems(mappedItems);

    // Payments setup
    let c = 0, u = 0, cr = 0, n = 0;
    (inv.payments || []).forEach(p => {
      const mode = (p.payment_mode || '').toLowerCase();
      if (mode === 'cash') c += parseFloat(p.amount || 0);
      if (mode === 'upi') u += parseFloat(p.amount || 0);
      if (mode === 'card') cr += parseFloat(p.amount || 0);
      if (mode === 'netbanking') n += parseFloat(p.amount || 0);
    });
    setCashPaid(c > 0 ? c.toString() : '');
    setUpiPaid(u > 0 ? u.toString() : '');
    setCardPaid(cr > 0 ? cr.toString() : '');
    setNetBankingPaid(n > 0 ? n.toString() : '');

    setView('form');
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) return alert('Please enter Customer Name');
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length !== 10) {
      return alert('Please enter a valid 10-digit Phone Number');
    }

    const invalid = items.some(item => !item.ornament_name || !item.gross_weight || !item.per_gram_rate);
    if (invalid) return alert('Please fill ornament particulars, gross weight, and rate per gram.');

    // Payment validations
    if (paymentCategory === 'full' && amountPaid !== netPayable) {
      return alert(`For Full Payment, the total amount paid (₹${amountPaid.toLocaleString('en-IN')}) must equal the Net Grand Total (₹${netPayable.toLocaleString('en-IN')}). Please adjust payment splits.`);
    }
    if (paymentCategory === 'partial' && (amountPaid <= 0 || amountPaid >= netPayable)) {
      return alert(`For Partial Payment, the total amount paid (₹${amountPaid.toLocaleString('en-IN')}) must be greater than 0 and less than the Net Grand Total (₹${netPayable.toLocaleString('en-IN')}).`);
    }
    if (paymentCategory === 'unpaid' && amountPaid > 0) {
      return alert('For Unpaid bills, please clear all split payment input values.');
    }

    const invoiceHeader = {
      customer_id: invoices.find(i => i.id === editingId)?.customer_id || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      pan_number: panNumber,
      gst_number: gstNumber,
      bill_date: billDate,
      print_gst: printGst,
      subtotal: parseFloat(subtotal.toFixed(2)),
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      exchange_deduction: exchangeAmt,
      total_amount: netPayable,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      balance_due: balanceDue
    };

    const invoiceItems = items.map((item, idx) => ({
      stock_id: item.stock_id || null,
      item_number: item.item_number || null,
      ornament_name: item.ornament_name,
      metal_type: item.metal_type,
      gross_weight: parseFloat(item.gross_weight),
      stone_weight: parseFloat(item.stone_weight) || 0,
      net_weight: parseFloat(item.net_weight),
      hsn_code: item.hsn_code,
      per_gram_rate: parseFloat(item.per_gram_rate),
      making_charges_percent: parseFloat(item.making_charges_percent) || 0,
      other_charges: parseFloat(item.other_charges) || 0,
      labour_per_gram: parseFloat(item.labour_per_gram) || 0,
      item_total: computedRowAmounts[idx],
      gst_rate: item.metal_type === 'gold' ? 3.00 : 0.00
    }));

    const paymentsList = [];
    if (tCash > 0) paymentsList.push({ amount: tCash, payment_mode: 'cash' });
    if (tUpi > 0) paymentsList.push({ amount: tUpi, payment_mode: 'upi' });
    if (tCard > 0) paymentsList.push({ amount: tCard, payment_mode: 'card' });
    if (tNet > 0) paymentsList.push({ amount: tNet, payment_mode: 'netbanking' });

    const exchangeGold = hasExchange ? {
      metal_type: exchangeMetal,
      purity: exchangePurity,
      weight: parseFloat(exchangeWeight),
      rate_per_gram: parseFloat(exchangeRate),
      total_value: exchangeAmt
    } : null;

    let res;
    if (editingId) {
      res = await db.updateInvoice(editingId, invoiceHeader, invoiceItems, paymentsList, exchangeGold);
    } else {
      res = await db.saveInvoice(invoiceHeader, invoiceItems, paymentsList, exchangeGold);
    }

    if (!res.error) {
      alert(editingId ? 'Bill Updated Successfully!' : 'Bill Generated Successfully!');
      fetchRatesAndLedger();
      setView('ledger');
    } else {
      alert('Transaction saving failed: ' + res.error.message);
    }
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter valid payment amount.');
    if (amt > selectedInvoice.balance_due) return alert('Amount exceeds remaining balance.');

    const { error } = await db.recordPayment(selectedInvoice.id, amt, settleMode, 'Dues Settlement');
    if (!error) {
      alert('Payment Recorded Successfully!');
      setShowSettleModal(false);
      setSettleAmount('');
      fetchRatesAndLedger();
    } else {
      alert('Payment save failed: ' + error.message);
    }
  };

  const handleWhatsApp = (inv, type = 'bill') => {
    const formattedDate = new Date(inv.bill_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    const customerName = inv.customers?.name || 'Customer';
    const customerPhone = inv.customers?.phone || '';
    
    const msg = type === 'bill'
      ? `Dear *${customerName}*,\n\nThank you for choosing *SHREE GANESH JEWELLERS* 🙏\n\nYour Tax Invoice *${inv.bill_number}* of ₹*${(inv.total_amount || 0).toLocaleString('en-IN')}* has been generated on *${formattedDate}*.\n\nPaid Amount: ₹${(inv.amount_paid || 0).toLocaleString('en-IN')}\nOutstanding Balance: ₹*${(inv.balance_due || 0).toLocaleString('en-IN')}*\n\nVisit our Kamothe showroom for details!`
      : `Dear *${customerName}*,\n\nFriendly reminder from *SHREE GANESH JEWELLERS* 🙏\n\nRegarding outstanding balance on Invoice *${inv.bill_number}* (Date: *${formattedDate}*):\n\nOutstanding Dues: ₹*${(inv.balance_due || 0).toLocaleString('en-IN')}*.\n\nKindly settle via UPI, card, or cash at your convenience. Thank you!`;
    
    if (!customerPhone) {
      alert('No phone number registered for this customer.');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Settle modes breakdowns
  const getPaymentsString = (inv) => {
    if (!inv.payments || inv.payments.length === 0) return 'None';
    const active = [];
    inv.payments.forEach(p => {
      const mode = (p.payment_mode || '').toUpperCase();
      if (mode && !active.includes(mode)) active.push(mode);
    });
    return active.join(' + ') || 'None';
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!inv) return false;
    const matchesSearch = 
      (inv.bill_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customers?.phone || '').includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="space-y-6 no-print">
        
        {/* Module Header Title */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              {view === 'ledger' 
                ? 'Sales & URD Ledger Book' 
                : view === 'urd_form' 
                  ? 'New Standalone URD Buyback (खरेदी)' 
                  : view === 'print_urd'
                    ? 'URD Payout Invoice'
                    : (editingId ? `Edit Invoice: ${invoices.find(i => i.id === editingId)?.bill_number}` : 'Generate New Bill')}
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              {view === 'ledger' 
                ? 'Review sales invoices and unregistered dealer buybacks' 
                : 'Complete fields below to record transaction'}
            </p>
          </div>
          {view === 'ledger' ? (
            <div className="flex gap-2">
              <button
                onClick={handleOpenNewBill}
                className="px-3.5 py-2 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                New Invoice
              </button>
              <button
                onClick={handleOpenNewUrd}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                New URD Buyback
              </button>
            </div>
          ) : (
            <button
              onClick={() => setView('ledger')}
              className="px-3.5 py-2 bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Back to Ledger
            </button>
          )}
        </div>

        {/* 1. LEDGER BOOK VIEW */}
        {view === 'ledger' && (
          <div className="space-y-6">
            
            {/* Tabs for Sales vs URD Standalone */}
            <div className="flex border-b border-[#735c00]/15 gap-2">
              <button
                type="button"
                onClick={() => setLedgerTab('sales')}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-extrabold transition-all cursor-pointer border-b-2 ${
                  ledgerTab === 'sales'
                    ? 'border-[#570000] text-[#570000]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Sales Invoices (विक्री पावती)
              </button>
              <button
                type="button"
                onClick={() => setLedgerTab('urd')}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-extrabold transition-all cursor-pointer border-b-2 ${
                  ledgerTab === 'urd'
                    ? 'border-[#570000] text-[#570000]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                URD Standalone Buybacks (खरेदी पत्रक)
              </button>
            </div>

            {ledgerTab === 'sales' && (
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-[#735c00]/10 rounded-2xl p-4 shadow-sm">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search Invoice #, Name, Phone"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-sans"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-bold"
                    >
                      <option value="all">All Settlements</option>
                      <option value="paid">Paid (Settled)</option>
                      <option value="partial">Partial Balance</option>
                      <option value="unpaid">Unpaid Dues</option>
                    </select>
                  </div>
                </div>

                {/* Invoices List table */}
                <div className="bg-white border border-[#735c00]/15 rounded-3xl overflow-hidden shadow-sm">
                  {loadingLedger ? (
                    <div className="p-12 text-center space-y-2">
                      <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Syncing Ledger...</p>
                    </div>
                  ) : filteredInvoices.length === 0 ? (
                    <div className="p-12 text-center text-xs text-gray-400 italic">
                      No invoice logs found matching parameters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/25 uppercase font-bold tracking-widest text-[9px]">
                            <th className="py-3 px-4">Invoice No</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Customer Details</th>
                            <th className="py-3 px-4 text-right">Net Payable</th>
                            <th className="py-3 px-4 text-right">Dues / Paid Progress</th>
                            <th className="py-3 px-4">Mode</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-sans font-bold">
                          {filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50/70 transition-all">
                              <td className="py-3.5 px-4 font-mono text-[#570000]">{inv.bill_number}</td>
                              <td className="py-3.5 px-4 text-gray-500">
                                {new Date(inv.bill_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-serif text-[#1c1b1b]">{inv.customers?.name || 'Walk-in Customer'}</div>
                                <div className="text-[10px] text-gray-400 font-mono font-medium">{inv.customers?.phone || 'N/A'}</div>
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-800">₹{(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="py-3.5 px-4 text-right">
                                <span className="text-red-600 font-mono block">
                                  {(inv.balance_due || 0) > 0 ? `₹${(inv.balance_due || 0).toLocaleString('en-IN')}` : '₹0'}
                                </span>
                                <div className="w-28 bg-gray-100 rounded-full h-1 mt-1 ml-auto overflow-hidden">
                                  <div 
                                    className="bg-green-600 h-1 rounded-full transition-all" 
                                    style={{ width: `${Math.min(100, ((inv.amount_paid || 0) / (inv.total_amount || 1)) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[8px] text-gray-400 font-bold block mt-0.5">
                                  ₹{(inv.amount_paid || 0).toLocaleString('en-IN')} paid / ₹{(inv.total_amount || 0).toLocaleString('en-IN')}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-gray-500 text-[10px]">{getPaymentsString(inv)}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${
                                  inv.payment_status === 'paid' 
                                    ? 'bg-green-100 text-green-700' 
                                    : (inv.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')
                                }`}>
                                  {inv.payment_status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => { setSelectedInvoice(inv); setView('print'); }}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
                                    title="Print / PDF Invoice"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditBill(inv)}
                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all cursor-pointer"
                                    title="Edit Invoice Details"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  {inv.balance_due > 0 && (
                                    <button
                                      onClick={() => { setSelectedInvoice(inv); setShowSettleModal(true); }}
                                      className="px-2 py-1.5 rounded-lg bg-[#fed65b] text-[#570000] font-extrabold text-[9px] hover:bg-[#fed65b]/90 transition-all cursor-pointer shadow-sm border border-[#735c00]/30"
                                    >
                                      Settle Dues
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleWhatsApp(inv, 'bill')}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                                    title="Send WhatsApp Invoice"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
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
              </div>
            )}

            {ledgerTab === 'urd' && (
              <div className="bg-white border border-[#735c00]/15 rounded-3xl overflow-hidden shadow-sm">
                {loadingLedger ? (
                  <div className="p-12 text-center space-y-2">
                    <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Syncing URD Buybacks...</p>
                  </div>
                ) : urdTransactions.length === 0 ? (
                  <div className="p-12 text-center text-xs text-gray-400 italic">
                    No standalone URD buyback transactions logged.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/25 uppercase font-bold tracking-widest text-[9px]">
                          <th className="py-3 px-4">URD Bill No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Customer Details</th>
                          <th className="py-3 px-4">Collateral Metal</th>
                          <th className="py-3 px-4 text-right">Net Weight</th>
                          <th className="py-3 px-4 text-right">Rate / g</th>
                          <th className="py-3 px-4 text-right">Payout Cash</th>
                          <th className="py-3 px-4">Payout Mode</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-sans font-bold">
                        {urdTransactions.map((urd) => (
                          <tr key={urd.id} className="hover:bg-gray-50/70 transition-all">
                            <td className="py-3.5 px-4 font-mono text-[#570000]">{urd.urd_bill_number}</td>
                            <td className="py-3.5 px-4 text-gray-500">
                              {new Date(urd.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-serif text-[#1c1b1b]">{urd.customers?.name || 'Walk-in Customer'}</div>
                              <div className="text-[10px] text-gray-400 font-mono font-medium">{urd.customers?.phone || 'N/A'}</div>
                            </td>
                            <td className="py-3.5 px-4 uppercase text-gray-600">
                              {urd.metal_type} ({urd.purity})
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-gray-700">{(urd.weight || 0).toFixed(3)}g</td>
                            <td className="py-3.5 px-4 text-right font-mono text-gray-600">₹{(urd.rate_per_gram || 0).toLocaleString('en-IN')}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-red-700">₹{(urd.total_value || 0).toLocaleString('en-IN')}</td>
                            <td className="py-3.5 px-4 uppercase text-gray-500 text-[10px] font-mono">{urd.payment_mode || 'CASH'}</td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => { setSelectedUrd(urd); setView('print_urd'); }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-extrabold"
                              >
                                <Printer className="h-3 w-3" />
                                Print URD
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

          </div>
        )}

        {/* 2. BILLING WORKSPACE FORM */}
        {view === 'form' && (
          <form onSubmit={handleSaveBill} className="space-y-6">
            
            {/* Customer identity ledger */}
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Customer Identity Ledger
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Customer Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono font-bold"
                    />
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Customer Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-bold"
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    City & PIN
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Kamothe, NAVI MUMBAI - 410209"
                      value={cityPin}
                      onChange={(e) => setCityPin(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000]"
                    />
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Full Shop Address (Optional)
                  </label>
                  <textarea
                    placeholder="Sector/House details, Kamothe"
                    rows={1}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#570000]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    PAN Card Number (Above ₹2 Lakh)
                  </label>
                  <input
                    type="text"
                    placeholder="PAN Card Format"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Party GSTIN Number (For B2B Sales)
                  </label>
                  <input
                    type="text"
                    placeholder="B2B GSTIN"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* GST Toggles config */}
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-3 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
                GST Invoice Preferences
              </h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    checked={printGst === true}
                    onChange={() => setPrintGst(true)}
                    className="accent-[#570000] h-4 w-4"
                  />
                  Print GST on Invoice
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    checked={printGst === false}
                    onChange={() => setPrintGst(false)}
                    className="accent-[#570000] h-4 w-4"
                  />
                  Do Not Print GST (Estimate Slip)
                </label>
              </div>
              <p className="text-[9px] text-gray-400 mt-2 leading-relaxed italic">
                * Note: GST is always calculated and included in totals for Gold line items. This toggle only hides the shop's GSTIN and SGST/CGST labels on the output receipt.
              </p>
            </div>

            {/* Ornaments Purchase Grid */}
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#fed65b]" />
                  Ornaments Purchase Grid
                </h3>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 text-[10px] font-bold text-[#570000] hover:text-white bg-[#570000]/10 hover:bg-[#570000] rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Ornament row
                </button>
              </div>

              {/* Rows */}
              <div className="space-y-4 lg:space-y-3">
                {items.map((item, idx) => {
                  const filteredSuggestions = PARTICULARS_SUGGESTIONS.filter(s =>
                    s.toLowerCase().includes((item.ornament_name || '').toLowerCase())
                  );
                  
                  const filteredStock = stockList.filter(s =>
                    s.item_number && s.item_number.toLowerCase().includes((item.item_number || '').toLowerCase())
                  );

                  return (
                    <div 
                      key={item.id}
                      className="p-4 lg:p-0 bg-[#fcf9f8] lg:bg-transparent border lg:border-0 border-[#735c00]/10 rounded-2xl lg:rounded-none space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-2 items-end border-l-4 border-l-[#570000] lg:border-l-0"
                    >
                      {/* Item No stock autocomplete */}
                      <div className="lg:col-span-2 relative">
                        <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                          Item Number
                        </label>
                        <input
                          type="text"
                          placeholder="Look up stock"
                          value={item.item_number}
                          onFocus={() => setActiveItemNoSuggestionRowId(item.id)}
                          onBlur={() => setTimeout(() => setActiveItemNoSuggestionRowId(null), 200)}
                          onChange={(e) => handleUpdateItem(item.id, 'item_number', e.target.value)}
                          className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-[#570000] focus:outline-none font-mono font-bold text-center"
                        />
                        {activeItemNoSuggestionRowId === item.id && filteredStock.length > 0 && (
                          <div className="absolute left-0 right-0 top-12 bg-white border border-[#735c00]/20 rounded-xl shadow-xl z-30 max-h-40 overflow-y-auto divide-y divide-gray-100">
                            {filteredStock.map(s => (
                              <div
                                key={s.id}
                                onMouseDown={() => handleSelectItemNo(item.id, s)}
                                className="px-2 py-1.5 text-[9px] hover:bg-[#fed65b]/20 cursor-pointer font-mono flex justify-between"
                              >
                                <span>{s.item_number} ({s.ornament_name})</span>
                                <span className="font-bold text-gray-500">{s.weight}g</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Particular details */}
                      <div className="lg:col-span-2 relative">
                        <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                          Ornament Particulars
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Bangle, Ring..."
                          value={item.ornament_name}
                          onFocus={() => setActiveSuggestionRowId(item.id)}
                          onBlur={() => setTimeout(() => setActiveSuggestionRowId(null), 200)}
                          onChange={(e) => handleUpdateItem(item.id, 'ornament_name', e.target.value)}
                          className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs text-[#1c1b1b] focus:outline-none font-serif font-bold text-[#570000]"
                        />
                        {activeSuggestionRowId === item.id && filteredSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-12 bg-white border border-[#735c00]/20 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-gray-100">
                            {filteredSuggestions.map(s => (
                              <div
                                key={s}
                                onMouseDown={() => { handleUpdateItem(item.id, 'ornament_name', s); setActiveSuggestionRowId(null); }}
                                className="px-3 py-1.5 text-xs hover:bg-[#fed65b]/20 cursor-pointer font-serif text-[#570000]"
                              >
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* HSN CODE */}
                      <div>
                        <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                          HSN
                        </label>
                        <input
                          type="text"
                          required
                          value={item.hsn_code}
                          onChange={(e) => handleUpdateItem(item.id, 'hsn_code', e.target.value)}
                          className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs font-mono text-center font-bold"
                        />
                      </div>

                      {/* Metal & Purity */}
                      <div>
                        <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                          Metal
                        </label>
                        <select
                          value={item.metal_type}
                          onChange={(e) => handleUpdateItem(item.id, 'metal_type', e.target.value)}
                          className="w-full bg-white border border-[#735c00]/20 rounded-xl px-1 py-1.5 text-xs font-bold font-sans"
                        >
                          <option value="gold">Gold</option>
                          <option value="silver">Silver</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                          Purity
                        </label>
                        <select
                          value={item.purity}
                          onChange={(e) => handleUpdateItem(item.id, 'purity', e.target.value)}
                          className="w-full bg-white border border-[#735c00]/20 rounded-xl px-1 py-1.5 text-xs font-bold font-sans"
                        >
                          {item.metal_type === 'gold' ? (
                            <>
                              <option value="22KT">22KT (91.6)</option>
                              <option value="18KT">18KT (75.0)</option>
                              <option value="14KT">14KT (58.3)</option>
                              <option value="24KT">24KT (99.9)</option>
                            </>
                          ) : (
                            <>
                              <option value="925 silver">92.5 Silver</option>
                              <option value="Fine silver">Fine Silver</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Weights */}
                      <div className="grid grid-cols-3 gap-2 lg:contents">
                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            Gross
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            required
                            placeholder="0.000"
                            value={item.gross_weight}
                            onChange={(e) => handleUpdateItem(item.id, 'gross_weight', e.target.value)}
                            className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            Stones
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={item.stone_weight}
                            onChange={(e) => handleUpdateItem(item.id, 'stone_weight', e.target.value)}
                            className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            Net Wt
                          </label>
                          <input
                            type="number"
                            disabled
                            value={item.net_weight || '0.000'}
                            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold text-gray-500"
                          />
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-3 gap-2 lg:contents">
                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            Rate / g
                          </label>
                          <input
                            type="number"
                            required
                            value={item.per_gram_rate}
                            onChange={(e) => handleUpdateItem(item.id, 'per_gram_rate', e.target.value)}
                            className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            {item.metal_type === 'gold' ? 'Making %' : 'Labour/g'}
                          </label>
                          <input
                            type="number"
                            value={item.metal_type === 'gold' ? item.making_charges_percent : item.labour_per_gram}
                            onChange={(e) => handleUpdateItem(item.id, item.metal_type === 'gold' ? 'making_charges_percent' : 'labour_per_gram', e.target.value)}
                            className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">
                            Other ₹
                          </label>
                          <input
                            type="number"
                            value={item.other_charges}
                            onChange={(e) => handleUpdateItem(item.id, 'other_charges', e.target.value)}
                            className="w-full bg-white border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs text-right font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Subtotal display and delete */}
                      <div className="flex items-center justify-between gap-2 lg:contents">
                        <div className="w-full">
                          <label className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5 text-right">
                            Subtotal
                          </label>
                          <div className="w-full bg-[#570000]/5 text-[#570000] border border-[#735c00]/20 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-right">
                            ₹{computedRowAmounts[idx].toLocaleString('en-IN')}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(item.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all border border-red-100 self-end lg:mb-1.5 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Old Gold Exchange offsets */}
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4" />
                  Old Gold / Silver Exchange Deduction
                </h3>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExchange}
                    onChange={(e) => setHasExchange(e.target.checked)}
                    className="accent-[#570000] h-4 w-4"
                  />
                  Apply Old Gold Trade-In
                </label>
              </div>

              {hasExchange && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                      Metal Type
                    </label>
                    <select
                      value={exchangeMetal}
                      onChange={(e) => setExchangeMetal(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                      Purity Value
                    </label>
                    <select
                      value={exchangePurity}
                      onChange={(e) => setExchangePurity(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    >
                      {exchangeMetal === 'gold' ? (
                        <>
                          <option value="22KT">22KT</option>
                          <option value="18KT">18KT</option>
                          <option value="14KT">14KT</option>
                        </>
                      ) : (
                        <option value="Silver">Silver</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                      Gross Weight (g)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      placeholder="0.000"
                      value={exchangeWeight}
                      onChange={(e) => setExchangeWeight(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-1.5 text-xs font-mono text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                      Bazar Rate / g (₹)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="Rate"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-1.5 text-xs font-mono text-right font-bold"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-[#735c00] uppercase mb-1">
                      Exchange Value
                    </label>
                    <div className="w-full bg-[#735c00]/5 text-[#735c00] border border-[#735c00]/20 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-right">
                      ₹{exchangeAmt.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Split Payment configurations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Cash counter breakdown inputs */}
              <div className="lg:col-span-2 bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  Payment Categorization
                </h3>
                
                <div className="flex gap-4 border-b border-gray-100 pb-3">
                  <button
                    type="button"
                    onClick={() => handlePaymentCategoryChange('full')}
                    className={`flex-1 py-2 text-xs uppercase font-extrabold tracking-wider rounded-xl transition-all cursor-pointer border ${
                      paymentCategory === 'full' 
                        ? 'bg-[#570000] border-[#570000] text-[#fed65b] shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentCategoryChange('partial')}
                    className={`flex-1 py-2 text-xs uppercase font-extrabold tracking-wider rounded-xl transition-all cursor-pointer border ${
                      paymentCategory === 'partial' 
                        ? 'bg-[#570000] border-[#570000] text-[#fed65b] shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Partial Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentCategoryChange('unpaid')}
                    className={`flex-1 py-2 text-xs uppercase font-extrabold tracking-wider rounded-xl transition-all cursor-pointer border ${
                      paymentCategory === 'unpaid' 
                        ? 'bg-red-750 border-red-750 text-white shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Unpaid (Book Dues)
                  </button>
                </div>

                {paymentCategory !== 'unpaid' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Cash Pay (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={cashPaid}
                        onChange={(e) => setCashPaid(e.target.value)}
                        className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-mono text-right font-bold text-[#570000]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        UPI Pay (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={upiPaid}
                        onChange={(e) => setUpiPaid(e.target.value)}
                        className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-mono text-right font-bold text-[#570000]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Card Pay (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={cardPaid}
                        onChange={(e) => setCardPaid(e.target.value)}
                        className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-mono text-right font-bold text-[#570000]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Net Banking (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={netBankingPaid}
                        onChange={(e) => setNetBankingPaid(e.target.value)}
                        className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-mono text-right font-bold text-[#570000]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-center text-xs font-serif leading-relaxed italic font-bold">
                    * The total invoice amount of ₹{netPayable.toLocaleString('en-IN')} will be recorded as outstanding ledger balance.
                  </div>
                )}

                <div className="pt-2 flex justify-between items-center text-xs font-bold text-gray-500 border-t border-gray-100 flex-wrap gap-2">
                  <span>Paid Dues Tally: <strong className="text-[#570000]">₹{amountPaid.toLocaleString('en-IN')}</strong></span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${
                    paymentStatus === 'paid' 
                      ? 'bg-green-100 text-green-700' 
                      : (paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')
                  }`}>
                    Status: {paymentStatus}
                  </span>
                </div>
              </div>

              {/* Aggregated Net Bill calculation */}
              <div className="bg-[#570000]/5 border border-[#735c00]/30 rounded-3xl p-5 space-y-3 font-bold">
                <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#570000] border-b border-[#735c00]/20 pb-1.5">
                  Invoice Sum Calculations
                </h4>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Items Subtotal:</span>
                  <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>CGST 1.5% + SGST 1.5%:</span>
                  <span className="font-mono">₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>

                {hasExchange && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Old Gold Exchange:</span>
                    <span className="font-mono">-₹{exchangeAmt.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-gray-500">
                  <span>Round Off:</span>
                  <span className="font-mono text-right">{roundOff >= 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                </div>

                <div className="h-[1px] bg-gray-200 my-2" />

                <div className="flex justify-between text-[#570000] text-sm">
                  <span>Net Grand Total:</span>
                  <span className="font-mono font-black">₹{netPayable.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>Amount Paid:</span>
                  <span className="font-mono">₹{amountPaid.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-red-600 text-xs border-t border-gray-100 pt-2 font-black">
                  <span>Dues Remaining:</span>
                  <span className="font-mono">₹{balanceDue.toLocaleString('en-IN')}</span>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 py-3 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Save Ledger Entry
                </button>
              </div>

            </div>

          </form>
        )}

        {/* 2.5 STANDALONE URD BUYBACK FORM */}
        {view === 'urd_form' && (
          <form onSubmit={handleSaveUrd} className="space-y-6">
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 flex items-center gap-1.5 font-serif">
                <ArrowRightLeft className="h-4 w-4" />
                URD Payout / Buyback Customer Dossier
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Customer Phone Number
                  </label>
                  <div className="relative font-bold">
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      value={urdCustomerPhone}
                      onChange={(e) => setUrdCustomerPhone(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono"
                    />
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Customer Full Name
                  </label>
                  <div className="relative font-bold">
                    <input
                      type="text"
                      required
                      placeholder="Enter customer name"
                      value={urdCustomerName}
                      onChange={(e) => setUrdCustomerName(e.target.value)}
                      className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000]"
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={urdDate}
                    onChange={(e) => setUrdDate(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Full Shop Address (Optional)
                </label>
                <textarea
                  placeholder="Sector/House details, Kamothe"
                  rows={1}
                  value={urdCustomerAddress}
                  onChange={(e) => setUrdCustomerAddress(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#570000] font-bold"
                />
              </div>
            </div>

            {/* Buyback weight and rate inputs */}
            <div className="bg-white border border-[#735c00]/10 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 flex items-center gap-1.5 font-serif">
                <Sparkles className="h-4 w-4 text-[#fed65b]" />
                Bought-in Ornaments Particulars
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Metal Type
                  </label>
                  <select
                    value={urdMetalType}
                    onChange={(e) => {
                      setUrdMetalType(e.target.value);
                      setUrdPurity(e.target.value === 'gold' ? '22KT' : 'Silver');
                      setUrdRatePerGram((e.target.value === 'gold' ? (goldRates?.rate22k || 0) / 10 : (goldRates?.rate_silver || 0)).toFixed(2));
                    }}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans"
                  >
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Purity Value
                  </label>
                  <select
                    value={urdPurity}
                    onChange={(e) => {
                      setUrdPurity(e.target.value);
                      const rate = getRatePerGram(urdMetalType, e.target.value);
                      setUrdRatePerGram(rate.toFixed(2));
                    }}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans"
                  >
                    {urdMetalType === 'gold' ? (
                      <>
                        <option value="22KT">22KT</option>
                        <option value="18KT">18KT</option>
                        <option value="14KT">14KT</option>
                        <option value="24KT">24KT</option>
                      </>
                    ) : (
                      <>
                        <option value="Silver">Silver</option>
                        <option value="925 silver">925 Silver</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Gross Weight (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.000"
                    value={urdWeight}
                    onChange={(e) => setUrdWeight(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-1.5 text-xs font-mono text-right font-bold text-[#570000]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Payout Bazar Rate / g (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={urdRatePerGram}
                    onChange={(e) => setUrdRatePerGram(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-1.5 text-xs font-mono text-right font-bold text-[#570000]"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Payout Mode
                  </label>
                  <select
                    value={urdPaymentMode}
                    onChange={(e) => setUrdPaymentMode(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans"
                  >
                    <option value="cash">Cash Outflow</option>
                    <option value="upi">UPI Transfer</option>
                    <option value="netbanking">Net Banking</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Narration / Pledged Ornaments Item Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brought old chain, broken lock, no markings"
                  value={urdNarration}
                  onChange={(e) => setUrdNarration(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-bold text-gray-800"
                />
              </div>
            </div>

            {/* Calculations totals block */}
            <div className="flex justify-end">
              <div className="w-full max-w-sm bg-[#570000]/5 border border-[#735c00]/30 rounded-3xl p-5 space-y-3 font-bold text-xs">
                <h4 className="uppercase font-extrabold tracking-widest text-[#570000] border-b border-[#735c00]/20 pb-1.5">
                  URD Payout Summary
                </h4>
                <div className="flex justify-between">
                  <span>Bought Weight:</span>
                  <span className="font-mono">{urdWeight ? parseFloat(urdWeight).toFixed(3) : '0.000'} g</span>
                </div>
                <div className="flex justify-between">
                  <span>Bazar Payout Rate:</span>
                  <span className="font-mono">₹{(parseFloat(urdRatePerGram) || 0).toLocaleString('en-IN')} / g</span>
                </div>
                <div className="h-[1px] bg-gray-200 my-2" />
                <div className="flex justify-between text-[#570000] text-sm">
                  <span>Net Payout Amount:</span>
                  <span className="font-mono font-black">₹{(Math.round((parseFloat(urdWeight) || 0) * (parseFloat(urdRatePerGram) || 0))).toLocaleString('en-IN')}</span>
                </div>
                <button
                  type="submit"
                  className="w-full mt-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Save URD Purchase Payout
                </button>
              </div>
            </div>
          </form>
        )}

      </div>

      {/* 3. INVOICE PRINT VIEW LAYOUT */}
      {view === 'print' && selectedInvoice && (
        <PrintLayout 
          invoice={selectedInvoice} 
          onClose={() => { setView('ledger'); setSelectedInvoice(null); }} 
        />
      )}

      {/* 3.5 STANDALONE URD INVOICE PRINT VIEW LAYOUT */}
      {view === 'print_urd' && selectedUrd && (
        <PrintUrdLayout 
          urd={selectedUrd} 
          onClose={() => { setView('ledger'); setSelectedUrd(null); }} 
        />
      )}

      {/* Settle Outstanding Dues Modal */}
      {showSettleModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="w-full max-w-sm bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#570000] px-5 py-3 text-[#fed65b] font-bold flex items-center justify-between border-b border-[#735c00]/30">
              <h3 className="font-serif text-sm tracking-wider uppercase">Settle Dues Installment</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-white hover:text-red-200">✕</button>
            </div>
            
            <form onSubmit={handleSettleSubmit} className="p-5 space-y-4 font-bold">
              <div className="text-xs space-y-1">
                <div className="text-gray-500">Invoice: <span className="text-gray-800 font-mono">{selectedInvoice.bill_number}</span></div>
                <div className="text-gray-500">Customer: <span className="text-gray-800 font-serif">{selectedInvoice.customers?.name || 'Walk-in Customer'}</span></div>
                <div className="text-red-600 font-black">Dues Outstanding: <span>₹{(selectedInvoice.balance_due || 0).toLocaleString('en-IN')}</span></div>
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
                  className="flex-1 py-2 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-sm cursor-pointer"
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

// Convert numbers into Indian Rupee words helper
function numToWords(num) {
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

// high-fidelity print layout component matching New Hareshwar Jewellers design reference
function PrintLayout({ invoice, onClose }) {
  useEffect(() => {
    // Hide standard layout header ticker from output
    document.body.classList.add('print-mode-active');
    return () => document.body.classList.remove('print-mode-active');
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getSplitValues = () => {
    let c = 0, u = 0, cr = 0, n = 0;
    invoice.payments.forEach(p => {
      const mode = p.payment_mode.toLowerCase();
      if (mode === 'cash') c += parseFloat(p.amount);
      if (mode === 'upi') u += parseFloat(p.amount);
      if (mode === 'card') cr += parseFloat(p.amount);
      if (mode === 'netbanking') n += parseFloat(p.amount);
    });
    return { cash: c, upi: u, card: cr, netbanking: n };
  };

  const splits = getSplitValues();
  const exchange = invoice.urd_transactions?.find(t => t.transaction_type === 'exchange');

  const formattedDate = new Date(invoice.bill_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' ' + new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-[#fcf9f8] min-h-screen p-0 md:p-6 flex flex-col items-center">
      
      {/* Top action header (no-print) */}
      <div className="w-full max-w-4xl no-print bg-[#570000] border-b border-[#735c00]/30 text-white px-5 py-3 rounded-2xl flex items-center justify-between mb-6 shadow-md">
        <span className="font-serif text-sm font-bold text-[#fed65b] tracking-wider uppercase">Invoice Receipt Sheet</span>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
          >
            Close Sheet
          </button>
        </div>
      </div>

      {/* Bill Layout Sheet */}
      <div 
        id="invoice-receipt-sheet"
        className="w-full max-w-4xl bg-white p-6 md:p-8 shadow-lg border border-gray-200 relative print:shadow-none print:border-0 print:p-0 font-sans"
        style={{ minHeight: '297mm' }} // Standard A4 height reference
      >
        
        {/* Top traditional mantra banner */}
        <div className="text-center font-bold text-gray-500 text-[10px] tracking-widest uppercase mb-1">
          ।। श्री गणेशाय नमः ।।
        </div>

        {/* Brand Header block */}
        <div className="flex justify-between items-start gap-4 border-b-2 border-gray-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#570000]/5 border-2 border-[#570000] flex flex-col items-center justify-center font-serif text-[#570000] font-black leading-none">
              <span className="text-[9px]">SG</span>
              <Gem className="h-4.5 w-4.5 text-[#570000] my-0.5" />
              <span className="text-[8px]">J</span>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-black text-[#570000] tracking-wider uppercase leading-none">
                SHREE GANESH JEWELLERS
              </h1>
              <p className="font-serif text-xs text-[#735c00] font-bold tracking-wider uppercase mt-1">
                Gold & Silver Ornaments Merchant
              </p>
              <p className="text-[10px] text-gray-500 font-bold leading-normal mt-1">
                Shop No. 01, Tirupati Garden, Plot No. 44, Sector 20, Kamothe, Navi Mumbai<br/>
                Mob: <span className="font-sans font-black">99308 97237</span>
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="px-3.5 py-1 text-xs font-black uppercase tracking-widest bg-[#570000]/10 text-[#570000] border border-[#570000]/25 rounded-md mb-2">
              {invoice.print_gst ? 'Tax Invoice' : 'Estimate Bill'}
            </div>
            <div className="text-[11px] font-bold space-y-0.5">
              <div>Invoice No: <span className="font-mono text-red-600 font-black">{invoice.bill_number}</span></div>
              <div className="text-gray-500 text-[10px]">Date: <span className="font-mono font-medium">{formattedDate}</span></div>
            </div>
          </div>
        </div>

        {/* Customer Dossier Grid */}
        <div className="grid grid-cols-2 border border-gray-300 rounded-xl p-3 mb-4 text-[11px] font-bold text-gray-700 gap-y-1.5 divide-x divide-gray-200">
          <div className="space-y-1">
            <div>Customer Name: <span className="text-gray-900 font-serif font-black">{invoice.customers?.name || 'Walk-in Customer'}</span></div>
            <div>Customer Phone: <span className="text-gray-900 font-mono">{invoice.customers?.phone || 'N/A'}</span></div>
            <div className="pr-4 leading-relaxed">Address: <span className="text-gray-800 font-medium">{invoice.customers?.address || 'N/A'}, {invoice.city_pin || 'Kamothe, Navi Mumbai'}</span></div>
          </div>
          <div className="pl-4 space-y-1">
            <div>Party GSTIN: <span className="text-gray-900 font-mono uppercase">{invoice.customers?.gst_number || 'NA'}</span></div>
            <div>PAN Card No: <span className="text-gray-900 font-mono uppercase">{invoice.customers?.pan_number || 'NA'}</span></div>
            {invoice.print_gst && <div>Store GSTIN: <span className="text-gray-900 font-mono font-black">27EBQPG8727P1ZM</span></div>}
          </div>
        </div>

        {/* Ornaments Purchase Grid Items Table */}
        <div className="border border-gray-300 rounded-xl overflow-hidden mb-4">
          <table className="w-full text-left border-collapse text-[10px] font-bold">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase tracking-widest text-[8px] border-b border-gray-300">
                <th className="py-2.5 px-2 border-r border-gray-300 text-center w-8">#</th>
                <th className="py-2.5 px-3 border-r border-gray-300">HSN</th>
                <th className="py-2.5 px-3 border-r border-gray-300">Particular Details</th>
                <th className="py-2.5 px-2 border-r border-gray-300 text-center">Purity</th>
                <th className="py-2.5 px-2 border-r border-gray-300 text-center">PCS</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-right">Gross Wt</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-right">Stone Wt</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-right">Net Wt</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-right">Rate/g</th>
                <th className="py-2.5 px-2 border-r border-gray-300 text-right">Making</th>
                <th className="py-2.5 px-2 border-r border-gray-300 text-right">Other</th>
                <th className="py-2.5 px-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {invoice.bill_items.map((item, idx) => (
                <tr key={item.id} className="text-gray-800 font-sans font-bold">
                  <td className="py-2 px-2 border-r border-gray-300 text-center">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-gray-300 font-mono font-medium">{item.hsn_code || '7113'}</td>
                  <td className="py-2 px-3 border-r border-gray-300">
                    <span className="font-serif font-black">{item.ornament_name}</span>
                    <span className="text-[8px] text-gray-400 font-medium block uppercase tracking-wider">{item.metal_type} Item {item.item_number ? `(${item.item_number})` : ''}</span>
                  </td>
                  <td className="py-2 px-2 border-r border-gray-300 text-center">{item.purity}</td>
                  <td className="py-2 px-2 border-r border-gray-300 text-center font-mono">{item.pcs}</td>
                  <td className="py-2 px-3 border-r border-gray-300 text-right font-mono font-medium">{(item.gross_weight || 0).toFixed(3)}g</td>
                  <td className="py-2 px-3 border-r border-gray-300 text-right font-mono font-medium">{(item.stone_weight || 0).toFixed(3)}g</td>
                  <td className="py-2 px-3 border-r border-gray-300 text-right font-mono font-black">{(item.net_weight || 0).toFixed(3)}g</td>
                  <td className="py-2 px-3 border-r border-gray-300 text-right font-mono">₹{(item.per_gram_rate || 0).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-2 border-r border-gray-300 text-right font-mono font-medium">
                    {item.metal_type === 'gold' ? `${item.making_charges_percent || 0}%` : `₹${item.labour_per_gram || 0}/g`}
                  </td>
                  <td className="py-2 px-2 border-r border-gray-300 text-right font-mono font-medium">
                    {(item.other_charges || 0) > 0 ? `₹${item.other_charges}` : '₹0'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black">₹{(item.item_total || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}

              {/* Total Summary Row */}
              <tr className="bg-gray-50 uppercase text-[9px] tracking-wider border-t border-gray-300 font-black text-gray-900 font-sans">
                <td colSpan="4" className="py-2 px-3 text-right border-r border-gray-300">Total:</td>
                <td className="py-2 px-2 text-center border-r border-gray-300 font-mono">
                  {invoice.bill_items.reduce((sum, item) => sum + item.pcs, 0)}
                </td>
                <td className="py-2 px-3 text-right border-r border-gray-300 font-mono">
                  {invoice.bill_items.reduce((sum, item) => sum + parseFloat(item.gross_weight), 0).toFixed(3)}g
                </td>
                <td className="py-2 px-3 text-right border-r border-gray-300 font-mono">
                  {invoice.bill_items.reduce((sum, item) => sum + parseFloat(item.stone_weight || 0), 0).toFixed(3)}g
                </td>
                <td className="py-2 px-3 text-right border-r border-gray-300 font-mono">
                  {invoice.bill_items.reduce((sum, item) => sum + parseFloat(item.net_weight), 0).toFixed(3)}g
                </td>
                <td colSpan="3" className="border-r border-gray-300"></td>
                <td className="py-2 px-3 text-right font-mono font-black">
                  ₹{invoice.bill_items.reduce((sum, item) => sum + item.item_total, 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Settlement Calculations split Grid */}
        <div className="grid grid-cols-2 gap-6 items-start mb-6 text-[11px] font-bold font-sans">
          
          {/* Payment Mode Breakdowns list */}
          <div className="border border-gray-300 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] uppercase font-black tracking-widest text-[#735c00] border-b border-gray-200 pb-1.5">
              Audited Settlement Summary
            </h4>
            
            <div className="space-y-1 text-gray-700">
              <div className="uppercase tracking-wider text-[8px] font-extrabold text-gray-400 mb-1">
                Payment Mode Breakdown:
              </div>
              
              {splits.cash > 0 && (
                <div className="flex justify-between">
                  <span>• Cash Received:</span>
                  <span className="font-mono font-bold text-gray-900">₹{splits.cash.toLocaleString('en-IN')}</span>
                </div>
              )}
              {splits.upi > 0 && (
                <div className="flex justify-between">
                  <span>• UPI Transfer Paid:</span>
                  <span className="font-mono font-bold text-gray-900">₹{splits.upi.toLocaleString('en-IN')}</span>
                </div>
              )}
              {splits.card > 0 && (
                <div className="flex justify-between">
                  <span>• Card Settlement:</span>
                  <span className="font-mono font-bold text-gray-900">₹{splits.card.toLocaleString('en-IN')}</span>
                </div>
              )}
              {splits.netbanking > 0 && (
                <div className="flex justify-between">
                  <span>• Net Banking Pay:</span>
                  <span className="font-mono font-bold text-gray-900">₹{splits.netbanking.toLocaleString('en-IN')}</span>
                </div>
              )}
              {exchange && (
                <div className="flex justify-between text-emerald-700 border-t border-gray-100 pt-1">
                  <span>• Old Gold Trade Exchange:</span>
                  <span className="font-mono font-black">₹{(exchange.total_value || 0).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-medium font-serif leading-relaxed italic">
              Amount in words: <span className="font-sans font-bold not-italic text-gray-800">{numToWords(invoice.total_amount)}</span>
            </div>
          </div>

          {/* Sum math box */}
          <div className="space-y-2 border border-gray-300 rounded-xl p-3.5 bg-gray-50 text-gray-600">
            <div className="flex justify-between">
              <span>Gross Amt.:</span>
              <span className="font-mono font-bold text-gray-900">₹{(invoice.subtotal || 0).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between">
              <span>Less Disc.:</span>
              <span className="font-mono font-bold text-gray-900">₹0.00</span>
            </div>

            <div className="flex justify-between">
              <span>ADD CGST 1.5%:</span>
              <span className="font-mono font-bold text-gray-900">₹{((invoice.gst_amount || 0) / 2).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>ADD SGST 1.5%:</span>
              <span className="font-mono font-bold text-gray-900">₹{((invoice.gst_amount || 0) / 2).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>ADD IGST 3%:</span>
              <span className="font-mono font-bold text-gray-900">₹0.00</span>
            </div>

            {(() => {
              const subtotalVal = parseFloat(invoice.subtotal || 0);
              const gstAmountVal = parseFloat(invoice.gst_amount || 0);
              const exchangeDeductionVal = parseFloat(invoice.exchange_deduction || 0);
              const totalAmountVal = parseFloat(invoice.total_amount || 0);
              const roundOffVal = totalAmountVal - (subtotalVal + gstAmountVal - exchangeDeductionVal);
              return (
                <div className="flex justify-between border-t border-gray-200 pt-1.5 text-gray-500">
                  <span>Round Off:</span>
                  <span className="font-mono font-bold">
                    {roundOffVal >= 0 ? `+₹${roundOffVal.toFixed(2)}` : `-₹${Math.abs(roundOffVal).toFixed(2)}`}
                  </span>
                </div>
              );
            })()}

            <div className="h-[1.5px] bg-gray-800 my-2" />

            <div className="flex justify-between text-gray-900 text-xs font-black">
              <span>NET PAYABLE:</span>
              <span className="font-mono font-black text-red-600">₹{(invoice.total_amount || 0).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-gray-700 text-xs">
              <span>AMOUNT PAID:</span>
              <span className="font-mono font-black text-green-700">₹{(invoice.amount_paid || 0).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-red-600 text-xs border-t border-gray-200 pt-1.5 font-black">
              <span>REMAINING BAL.:</span>
              <span className="font-mono">₹{(invoice.balance_due || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

        </div>

        {/* Footer Rules and signatures block */}
        <div className="border-t border-gray-400 pt-4 mt-6">
          <div className="grid grid-cols-2 gap-4 text-[7px] md:text-[8px] font-bold text-gray-500 leading-normal tracking-wide">
            
            {/* Gold guidelines */}
            <div className="space-y-1 pr-2">
              <h5 className="font-serif text-[#570000] font-black uppercase text-[9px] mb-1">★ सोन्याचे नियम व अटी :</h5>
              <p>• पावती असल्याशिवाय दागिने बदलून किंवा विकत घेतले जाणार नाही, दागिना मोड किंवा किंवा बदली खरेदीच्या वेळी पावती दाखवणे बंधनकारक राहील.</p>
              <p>• नवीन दागिने खरेदीच्या वेळी शुद्धता तपासली जाईल. कोणत्याही प्रकारच्या भेसळीस विक्रेता जबाबदार राहणार नाही.</p>
              <p>• दागिन्यांची जोडणी सोन्यात किंवा चांदीत योग्य दराने केली जाईल.</p>
              <p>• दागिन्यांवर लावलेले खडे किंवा मणी वजनातून वजा केले जातील.</p>
              <p>• खरेदी केलेली दागिने बदली पावतीच्या तारखेपासून ८ दिवसांच्या आत केली जातील.</p>
              <p>• खरेदी केलेली वस्तू कोणत्याही परिस्थितीत बदलून किंवा परत केली जाणार नाही.</p>
            </div>

            {/* Silver rules */}
            <div className="space-y-1 pl-2 border-l border-gray-200">
              <h5 className="font-serif text-[#570000] font-black uppercase text-[9px] mb-1">★ चांदीचे नियम व अटी :</h5>
              <p>• चांदीचे दागिने व वस्तू नैसर्गिक हवेच्या संपर्काने काही काळाने काळे पडतात, परंतु पॉलिश केल्यावर पूर्ववत होतात.</p>
              <p>• भांडी घासताना पॉलिश केलेल्या डिझाईनची काळजी घ्यावी.</p>
              
              <div className="pt-2 space-y-0.5">
                <h5 className="font-serif text-[#570000] font-black uppercase text-[9px]">★ EXCHANGE POLICY (बदली धोरण):</h5>
                <p>• Our 22kt Gold Jewellery will be (100%) weight to weight exchange with 22kt.</p>
                <p>• Our 18kt Gold Jewellery will be (75%) exchange. </p>
                <p>• Our Silver Jewellery will be (70%) exchange.</p>
              </div>

              <div className="pt-2 space-y-0.5">
                <h5 className="font-serif text-[#570000] font-black uppercase text-[9px]">★ CASH BACK POLICY (परतावा धोरण):</h5>
                <p>• 92% Cash Back on 22kt Gold Jewellery.</p>
                <p>• 75% Cash Back on 18kt Gold Jewellery.</p>
              </div>
            </div>

          </div>

          {/* Signatures grid */}
          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 text-center text-[10px] font-black text-gray-700 tracking-wider">
            <div className="flex flex-col items-center justify-between h-14">
              <div className="w-40 border-b border-gray-300" />
              <span>CUSTOMER SIGNATURE</span>
            </div>
            <div className="flex flex-col items-center justify-between h-14">
              <div className="w-40 border-b border-gray-300" />
              <span>AUTHORISED SIGNATURE</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

// Standalone URD Buyback Print Layout Component
function PrintUrdLayout({ urd, onClose }) {
  useEffect(() => {
    document.body.classList.add('print-mode-active');
    return () => document.body.classList.remove('print-mode-active');
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(urd.transaction_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' ' + new Date(urd.transaction_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-[#fcf9f8] min-h-screen p-0 md:p-6 flex flex-col items-center">
      
      {/* Top action header (no-print) */}
      <div className="w-full max-w-4xl no-print bg-[#570000] border-b border-[#735c00]/30 text-white px-5 py-3 rounded-2xl flex items-center justify-between mb-6 shadow-md font-sans">
        <span className="font-serif text-sm font-bold text-[#fed65b] tracking-wider uppercase">URD Buyback Purchase Sheet</span>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#fed65b] hover:bg-[#fed65b]/90 text-[#570000] font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1"
          >
            <Printer className="h-3.5 w-3.5" />
            Print URD Bill
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
          >
            Close Sheet
          </button>
        </div>
      </div>

      {/* Bill Layout Sheet */}
      <div 
        id="urd-receipt-sheet"
        className="w-full max-w-4xl bg-white p-6 md:p-8 shadow-lg border border-gray-200 relative print:shadow-none print:border-0 print:p-0 font-sans"
        style={{ minHeight: '297mm' }}
      >
        
        {/* Top traditional mantra banner */}
        <div className="text-center font-bold text-gray-500 text-[10px] tracking-widest uppercase mb-1">
          ।। श्री गणेशाय नमः ।।
        </div>

        {/* Brand Header block */}
        <div className="flex justify-between items-start gap-4 border-b-2 border-gray-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#570000]/5 border-2 border-[#570000] flex flex-col items-center justify-center font-serif text-[#570000] font-black leading-none">
              <span className="text-[9px]">SG</span>
              <span className="text-xs my-0.5">💎</span>
              <span className="text-[8px]">J</span>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-black text-[#570000] tracking-wider uppercase leading-none">
                SHREE GANESH JEWELLERS
              </h1>
              <p className="font-serif text-xs text-[#735c00] font-bold tracking-wider uppercase mt-1">
                Gold & Silver Ornaments Merchant
              </p>
              <p className="text-[10px] text-gray-500 font-bold leading-normal mt-1">
                Shop No. 01, Tirupati Garden, Plot No. 44, Sector 20, Kamothe, Navi Mumbai<br/>
                Mob: <span className="font-sans font-black">99308 97237</span>
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="px-3.5 py-1 text-xs font-black uppercase tracking-widest bg-amber-600/10 text-amber-700 border border-amber-600/25 rounded-md mb-2">
              URD Purchase Bill (खरेदी पत्रक)
            </div>
            <div className="text-[11px] font-bold space-y-0.5">
              <div>URD No: <span className="font-mono text-red-600 font-black">{urd.urd_bill_number}</span></div>
              <div className="text-gray-500 text-[10px]">Date: <span className="font-mono font-medium">{formattedDate}</span></div>
            </div>
          </div>
        </div>

        {/* Customer Dossier Grid */}
        <div className="grid grid-cols-2 border border-gray-300 rounded-xl p-3 mb-4 text-[11px] font-bold text-gray-700 gap-y-1.5 divide-x divide-gray-200">
          <div className="space-y-1">
            <div>Seller's Name (ग्राहकाचे नाव): <span className="text-gray-900 font-serif font-black">{urd.customers?.name}</span></div>
            <div>Seller's Phone: <span className="text-gray-900 font-mono">{urd.customers?.phone}</span></div>
            <div className="pr-4 leading-relaxed">Address: <span className="text-gray-800 font-medium">{urd.customers?.address || 'Kamothe, Navi Mumbai'}</span></div>
          </div>
          <div className="pl-4 space-y-1 flex flex-col justify-center">
            <div>PAN Card No: <span className="text-gray-900 font-mono uppercase">{urd.customers?.pan_number || 'NA'}</span></div>
            <div className="text-gray-500 mt-1 italic text-[9px]">* Unregistered Dealer (URD) purchase transaction under Section 9(4) of CGST Act.</div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-gray-300 rounded-xl overflow-hidden mb-4">
          <table className="w-full text-left border-collapse text-[10px] font-bold">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase tracking-widest text-[8px] border-b border-gray-300">
                <th className="py-2.5 px-3 border-r border-gray-300 w-12 text-center font-bold">#</th>
                <th className="py-2.5 px-4 border-r border-gray-300 font-bold">Particular Details (दागिन्यांचे वर्णन)</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-center font-bold">Metal</th>
                <th className="py-2.5 px-3 border-r border-gray-300 text-center font-bold">Purity</th>
                <th className="py-2.5 px-4 border-r border-gray-300 text-right font-bold">Net Weight</th>
                <th className="py-2.5 px-4 border-r border-gray-300 text-right font-bold">Purchase Rate / g</th>
                <th className="py-2.5 px-4 text-right font-bold">Total Cash Payout (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-800 font-sans font-bold text-center border-b border-gray-200">
                <td className="py-3 px-3 border-r border-gray-300 font-mono font-medium">1</td>
                <td className="py-3 px-4 border-r border-gray-300 text-left font-serif">
                  <span className="font-serif font-black">{urd.narration || `Old ${urd.metal_type} Ornaments`}</span>
                </td>
                <td className="py-3 px-3 border-r border-gray-300 uppercase font-medium">{urd.metal_type}</td>
                <td className="py-3 px-3 border-r border-gray-300 font-mono font-medium">{urd.purity}</td>
                <td className="py-3 px-4 border-r border-gray-300 text-right font-mono font-black text-gray-850">{urd.weight.toFixed(3)}g</td>
                <td className="py-3 px-4 border-r border-gray-300 text-right font-mono font-medium">₹{urd.rate_per_gram.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-right font-mono font-black text-red-600">₹{urd.total_value.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="bg-gray-50 uppercase text-[9px] tracking-wider border-t border-gray-300 font-black text-gray-900 font-sans text-right">
                <td colSpan="4" className="py-2.5 px-3 border-r border-gray-300 font-black">Grand Total Payout:</td>
                <td className="py-2.5 px-4 border-r border-gray-300 font-mono font-black text-right text-gray-850">{urd.weight.toFixed(3)}g</td>
                <td className="border-r border-gray-300"></td>
                <td className="py-2.5 px-4 font-mono font-black text-right text-red-600">₹{urd.total_value.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Audited Payout information */}
        <div className="grid grid-cols-2 gap-6 items-start mb-6 text-[11px] font-bold font-sans">
          <div className="border border-gray-300 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] uppercase font-black tracking-widest text-[#735c00] border-b border-gray-200 pb-1.5">
              Audited Payout Summary
            </h4>
            <div className="space-y-1 text-gray-700 font-bold">
              <div className="flex justify-between">
                <span>• Disbursed Mode:</span>
                <span className="uppercase font-mono text-gray-900 font-black">{urd.payment_mode || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span>• Payout Amount:</span>
                <span className="font-mono text-red-600 font-black">₹{urd.total_value.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-500 font-medium font-serif leading-relaxed italic">
              Amount in words: <span className="font-sans font-bold not-italic text-gray-850">{numToWords(urd.total_value)}</span>
            </div>
          </div>
          <div className="p-1"></div>
        </div>

        {/* Legal Disclaimer / Marathi Declaration of Ownership signature card */}
        <div className="border-t border-gray-400 pt-4 mt-6">
          <div className="space-y-2 pr-2 text-[8px] md:text-[9.5px] font-bold text-gray-500 leading-relaxed tracking-wide text-justify">
            <h5 className="font-serif text-[#570000] font-black uppercase text-[10px] mb-1">★ मालकी हक्क प्रतिज्ञापत्र व हमी पत्र (Marathi Ownership Declaration):</h5>
            <p>• मी अशी शपथपूर्वक प्रतिज्ञा करतो/करते की, वरील वर्णन केलेले जुने सोने/चांदी हे माझ्या पूर्ण मालकीचे असून ते मी स्वतः वापरलेले आहे. ते चोरीचे किंवा इतर कोणत्याही अवैध मार्गाने मिळवलेले नाही. त्याबद्दल भविष्यात काही वाद किंवा तक्रार निर्माण झाल्यास त्यास मी संपूर्णपणे जबाबदार राहीन आणि कायदा व न्यायालयाच्या कारवाईस पात्र राहीन.</p>
            <p>• खरेदीदाराने (Shree Ganesh Jewellers) मला वरील सोन्याची पूर्ण रक्कम समजवून माझ्या संमतीने अदा केली आहे.</p>
          </div>

          {/* Signatures grid */}
          <div className="grid grid-cols-2 gap-4 mt-12 pt-6 text-center text-[10px] font-black text-gray-700 tracking-wider">
            <div className="flex flex-col items-center justify-between h-14">
              <div className="w-40 border-b border-gray-300" />
              <span>विक्रेत्याची सही (SELLER'S SIGNATURE)</span>
            </div>
            <div className="flex flex-col items-center justify-between h-14">
              <div className="w-40 border-b border-gray-300" />
              <span>खरेदीदाराची सही (AUTHORISED SIGNATURE)</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
