import { supabase } from './supabase';

// Helper to format dates cleanly
export const getYearStr = () => new Date().getFullYear().toString();

export const db = {
  // ==========================================
  // 1. GOLD/SILVER RATES SERVICE
  // ==========================================
  async getLatestRates() {
    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) return { data: data[0], error: null };
      
      // Fallback if table is empty
      const defaultRates = { rate24k: 76500.00, rate22k: 70150.00, rate18k: 57380.00, rate_silver: 920.00 };
      return { data: defaultRates, error: null };
    } catch (err) {
      console.error('Error fetching rates:', err);
      return { data: { rate24k: 76500.00, rate22k: 70150.00, rate18k: 57380.00, rate_silver: 920.00 }, error: err };
    }
  },

  async saveRates(rate24k, rate22k, rate18k, rate_silver) {
    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .insert([{ rate24k, rate22k, rate18k, rate_silver }])
        .select();
      if (error) throw error;
      return { data: data[0], error: null };
    } catch (err) {
      console.error('Error saving rates:', err);
      return { data: null, error: err };
    }
  },

  // ==========================================
  // 2. CUSTOMERS SERVICE
  // ==========================================
  async searchCustomerByPhone(phone) {
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('Error checking customer phone:', err);
      return { data: null, error: err };
    }
  },

  async getCustomerFullHistory(customerId) {
    try {
      // Invoices
      const { data: invoices, error: invError } = await supabase
        .from('bills')
        .select('*, bill_items(*), payments(*)')
        .eq('customer_id', customerId)
        .order('bill_date', { ascending: false });

      if (invError) throw invError;

      // Saving Schemes
      const { data: schemes, error: schError } = await supabase
        .from('saving_schemes')
        .select('*, scheme_payments(*)')
        .eq('customer_id', customerId);

      if (schError) throw schError;

      // Gold Loans
      const { data: loans, error: lnError } = await supabase
        .from('gold_loans')
        .select('*, loan_repayments(*)')
        .eq('customer_id', customerId);

      if (lnError) throw lnError;

      // URD buybacks
      const { data: buybacks, error: bbError } = await supabase
        .from('urd_transactions')
        .select('*')
        .eq('customer_id', customerId);

      if (bbError) throw bbError;

      return {
        data: { invoices, schemes, loans, buybacks },
        error: null
      };
    } catch (err) {
      console.error('Error fetching customer full history:', err);
      return { data: null, error: err };
    }
  },

  // ==========================================
  // 3. SHOWROOM STOCK SERVICE
  // ==========================================
  async getStock() {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('item_number', { ascending: true });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('Error fetching stock:', err);
      return { data: [], error: err };
    }
  },

  async saveStockItem(item) {
    try {
      const { data, error } = await supabase
        .from('stock')
        .insert([{
          item_number: item.item_number.toUpperCase(),
          ornament_name: item.ornament_name,
          metal_type: item.metal_type,
          weight: parseFloat(item.weight),
          hsn_code: item.hsn_code || (item.metal_type === 'gold' ? '7113' : '7114'),
          purity: item.purity,
          quantity: parseInt(item.quantity) || 1,
          status: item.status || 'available',
          label_printed: item.label_printed || false
        }])
        .select();
      if (error) throw error;
      return { data: data[0], error: null };
    } catch (err) {
      console.error('Error saving stock:', err);
      return { data: null, error: err };
    }
  },

  async deleteStockItem(id) {
    try {
      const { error } = await supabase.from('stock').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  async markLabelPrinted(ids) {
    try {
      const { error } = await supabase
        .from('stock')
        .update({ label_printed: true })
        .in('id', ids);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  // ==========================================
  // 4. BILLING & LEDGER SERVICE (Includes Invoice Creator & Editor)
  // ==========================================
  async getInvoices() {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, customers(*), bill_items(*), payments(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('Error fetching invoices:', err);
      return { data: [], error: err };
    }
  },

  async generateNextBillNumber() {
    const yearStr = getYearStr();
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .like('bill_number', `SG-${yearStr}-%`)
        .order('bill_number', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      let nextSeq = 1;
      if (data && data.length > 0) {
        const parts = data[0].bill_number.split('-');
        const lastSeq = parseInt(parts[2]);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
      const formattedSeq = nextSeq.toString().padStart(4, '0');
      return `SG-${yearStr}-${formattedSeq}`;
    } catch (err) {
      console.error('Error generating bill number:', err);
      // Fallback standard structure
      const rand = Math.floor(Math.random() * 9000) + 1000;
      return `SG-${yearStr}-${rand}`;
    }
  },

  async saveInvoice(invoiceHeader, invoiceItems, paymentsList = [], exchangeGold = null) {
    try {
      // 1. Get or Create Customer
      let customerId = invoiceHeader.customer_id;
      if (!customerId) {
        const { data: existingCust } = await this.searchCustomerByPhone(invoiceHeader.customer_phone);
        if (existingCust) {
          customerId = existingCust.id;
          // Update details for existing customer
          const { error: custUpdateErr } = await supabase
            .from('customers')
            .update({
              address: invoiceHeader.customer_address,
              pan_number: invoiceHeader.pan_number,
              gst_number: invoiceHeader.gst_number
            })
            .eq('id', customerId);
          if (custUpdateErr) throw custUpdateErr;
        } else {
          // Create new customer
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert([{
              name: invoiceHeader.customer_name,
              phone: invoiceHeader.customer_phone.replace(/\D/g, '').slice(-10),
              address: invoiceHeader.customer_address,
              pan_number: invoiceHeader.pan_number,
              gst_number: invoiceHeader.gst_number
            }])
            .select();
          if (custErr) throw custErr;
          customerId = newCust[0].id;
        }
      } else {
        // Update details for existing customer
        const { error: custUpdateErr } = await supabase
          .from('customers')
          .update({
            address: invoiceHeader.customer_address,
            pan_number: invoiceHeader.pan_number,
            gst_number: invoiceHeader.gst_number
          })
          .eq('id', customerId);
        if (custUpdateErr) throw custUpdateErr;
      }

      // 2. Generate Invoice Number
      const billNumber = await this.generateNextBillNumber();

      // 3. Create Bill Row
      const { data: newBill, error: billErr } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNumber,
          customer_id: customerId,
          bill_date: invoiceHeader.bill_date || new Date().toISOString().split('T')[0],
          print_gst: invoiceHeader.print_gst,
          subtotal: invoiceHeader.subtotal,
          gst_amount: invoiceHeader.gst_amount,
          exchange_deduction: invoiceHeader.exchange_deduction || 0,
          total_amount: invoiceHeader.total_amount,
          payment_status: invoiceHeader.payment_status,
          amount_paid: invoiceHeader.amount_paid,
          balance_due: invoiceHeader.balance_due
        }])
        .select();

      if (billErr) throw billErr;
      const bill = newBill[0];

      // 4. Save items
      const itemsToSave = invoiceItems.map(item => ({
        bill_id: bill.id,
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
        item_total: parseFloat(item.item_total),
        gst_rate: parseFloat(item.gst_rate) || 0
      }));

      const { error: itemsErr } = await supabase.from('bill_items').insert(itemsToSave);
      if (itemsErr) throw itemsErr;

      // 5. Update Stock statuses to sold if stock items are bound
      const stockIdsToSold = invoiceItems
        .filter(item => item.stock_id)
        .map(item => item.stock_id);

      if (stockIdsToSold.length > 0) {
        await supabase
          .from('stock')
          .update({ status: 'sold' })
          .in('id', stockIdsToSold);
      }

      // 6. Save payments logs
      if (paymentsList && paymentsList.length > 0) {
        const logs = paymentsList.map(p => ({
          bill_id: bill.id,
          amount: parseFloat(p.amount),
          payment_mode: p.payment_mode,
          payment_date: p.payment_date || new Date().toISOString()
        }));
        await supabase.from('payments').insert(logs);
      }

      // 7. Save URD Gold/Silver exchange details
      if (exchangeGold && exchangeGold.weight > 0) {
        await supabase
          .from('urd_transactions')
          .insert([{
            bill_id: bill.id,
            customer_id: customerId,
            transaction_type: 'exchange',
            metal_type: exchangeGold.metal_type,
            purity: exchangeGold.purity,
            weight: parseFloat(exchangeGold.weight),
            rate_per_gram: parseFloat(exchangeGold.rate_per_gram),
            total_value: parseFloat(exchangeGold.total_value)
          }]);
      }

      return { data: bill, error: null };
    } catch (err) {
      console.error('Error saving invoice:', err);
      return { data: null, error: err };
    }
  },

  async updateInvoice(billId, invoiceHeader, invoiceItems, paymentsList = [], exchangeGold = null) {
    try {
      // 1. Update Invoices Row
      const { error: billErr } = await supabase
        .from('bills')
        .update({
          bill_date: invoiceHeader.bill_date,
          print_gst: invoiceHeader.print_gst,
          subtotal: invoiceHeader.subtotal,
          gst_amount: invoiceHeader.gst_amount,
          exchange_deduction: invoiceHeader.exchange_deduction || 0,
          total_amount: invoiceHeader.total_amount,
          payment_status: invoiceHeader.payment_status,
          amount_paid: invoiceHeader.amount_paid,
          balance_due: invoiceHeader.balance_due
        })
        .eq('id', billId);

      if (billErr) throw billErr;

      // Update customer details as well
      const { data: billData } = await supabase
        .from('bills')
        .select('customer_id')
        .eq('id', billId)
        .single();
      
      if (billData && billData.customer_id) {
        const { error: custUpdateErr } = await supabase
          .from('customers')
          .update({
            name: invoiceHeader.customer_name,
            address: invoiceHeader.customer_address,
            pan_number: invoiceHeader.pan_number,
            gst_number: invoiceHeader.gst_number
          })
          .eq('id', billData.customer_id);
        if (custUpdateErr) throw custUpdateErr;
      }

      // 2. Adjust Stock Statuses
      // Fetch old items first to release them back to available in stock
      const { data: oldItems } = await supabase
        .from('bill_items')
        .select('stock_id')
        .eq('bill_id', billId);

      const oldStockIds = oldItems ? oldItems.filter(oi => oi.stock_id).map(oi => oi.stock_id) : [];
      const newStockIds = invoiceItems.filter(ni => ni.stock_id).map(ni => ni.stock_id);

      // Stock IDs to release (were in old items, but NOT in new items)
      const stockToRelease = oldStockIds.filter(id => !newStockIds.includes(id));
      if (stockToRelease.length > 0) {
        await supabase.from('stock').update({ status: 'available' }).in('id', stockToRelease);
      }

      // Stock IDs to sell (are in new items, but NOT in old items)
      const stockToSell = newStockIds.filter(id => !oldStockIds.includes(id));
      if (stockToSell.length > 0) {
        await supabase.from('stock').update({ status: 'sold' }).in('id', stockToSell);
      }

      // 3. Clear and insert items
      await supabase.from('bill_items').delete().eq('bill_id', billId);

      const itemsToSave = invoiceItems.map(item => ({
        bill_id: billId,
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
        item_total: parseFloat(item.item_total),
        gst_rate: parseFloat(item.gst_rate) || 0
      }));

      const { error: itemsErr } = await supabase.from('bill_items').insert(itemsToSave);
      if (itemsErr) throw itemsErr;

      // 4. Clear and insert payments
      await supabase.from('payments').delete().eq('bill_id', billId);

      if (paymentsList && paymentsList.length > 0) {
        const logs = paymentsList.map(p => ({
          bill_id: billId,
          amount: parseFloat(p.amount),
          payment_mode: p.payment_mode,
          payment_date: p.payment_date || new Date().toISOString()
        }));
        await supabase.from('payments').insert(logs);
      }

      // 5. Manage URD Gold/Silver exchange
      await supabase.from('urd_transactions').delete().eq('bill_id', billId).eq('transaction_type', 'exchange');
      if (exchangeGold && exchangeGold.weight > 0) {
        await supabase
          .from('urd_transactions')
          .insert([{
            bill_id: billId,
            customer_id: invoiceHeader.customer_id,
            transaction_type: 'exchange',
            metal_type: exchangeGold.metal_type,
            purity: exchangeGold.purity,
            weight: parseFloat(exchangeGold.weight),
            rate_per_gram: parseFloat(exchangeGold.rate_per_gram),
            total_value: parseFloat(exchangeGold.total_value)
          }]);
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating invoice:', err);
      return { error: err };
    }
  },

  async recordPayment(billId, amount, paymentMode, notes = '') {
    try {
      // 1. Create repayment log
      const { error: pErr } = await supabase
        .from('payments')
        .insert([{
          bill_id: billId,
          amount: parseFloat(amount),
          payment_mode: paymentMode,
          notes
        }]);

      if (pErr) throw pErr;

      // 2. Fetch bill to update totals
      const { data: bill } = await supabase
        .from('bills')
        .select('total_amount, amount_paid')
        .eq('id', billId)
        .single();

      const newPaid = parseFloat(bill.amount_paid) + parseFloat(amount);
      const newDue = Math.max(0, parseFloat(bill.total_amount) - newPaid);
      const status = newDue === 0 ? 'paid' : 'partial';

      const { error: updateErr } = await supabase
        .from('bills')
        .update({
          amount_paid: newPaid,
          balance_due: newDue,
          payment_status: status
        })
        .eq('id', billId);

      if (updateErr) throw updateErr;

      return { error: null };
    } catch (err) {
      console.error('Error recording payment:', err);
      return { error: err };
    }
  },

  // ==========================================
  // 5. URD BUYBACKS SERVICE (Straight Direct Payouts)
  // ==========================================
  async getUrdTransactions() {
    try {
      const { data, error } = await supabase
        .from('urd_transactions')
        .select('*, customers(*)')
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  async generateNextUrdBillNumber() {
    const yearStr = getYearStr();
    try {
      const { data } = await supabase
        .from('urd_transactions')
        .select('urd_bill_number')
        .like('urd_bill_number', `URD-${yearStr}-%`)
        .order('urd_bill_number', { ascending: false })
        .limit(1);

      let seq = 1;
      if (data && data.length > 0) {
        const parts = data[0].urd_bill_number.split('-');
        const lastSeq = parseInt(parts[2]);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      return `URD-${yearStr}-${seq.toString().padStart(4, '0')}`;
    } catch (err) {
      console.warn('Error generating next URD bill number:', err);
      const rand = Math.floor(Math.random() * 9000) + 1000;
      return `URD-${yearStr}-${rand}`;
    }
  },

  async saveDirectUrdBuyback(customerName, customerPhone, customerAddress, metalType, purity, weight, ratePerGram, totalValue, paymentMode, narration = '') {
    try {
      // Get or Create Customer
      const { data: existingCust } = await this.searchCustomerByPhone(customerPhone);
      let customerId;
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert([{
            name: customerName,
            phone: customerPhone.replace(/\D/g, '').slice(-10),
            address: customerAddress
          }])
          .select();
        customerId = newCust[0].id;
      }

      const urdNo = await this.generateNextUrdBillNumber();

      const { data, error } = await supabase
        .from('urd_transactions')
        .insert([{
          customer_id: customerId,
          urd_bill_number: urdNo,
          transaction_type: 'buyback',
          metal_type: metalType,
          purity,
          weight: parseFloat(weight),
          rate_per_gram: parseFloat(ratePerGram),
          total_value: parseFloat(totalValue),
          payment_mode: paymentMode,
          narration
        }])
        .select();

      if (error) throw error;
      return { data: data[0], error: null };
    } catch (err) {
      console.error('Error saving direct buyback:', err);
      return { data: null, error: err };
    }
  },

  // ==========================================
  // 6. SAVING SCHEMES SERVICE (12 Months Deposits)
  // ==========================================
  async getSavingSchemes() {
    try {
      const { data, error } = await supabase
        .from('saving_schemes')
        .select('*, customers(*), scheme_payments(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('Error fetching schemes:', err);
      return { data: [], error: err };
    }
  },

  async generateNextSchemeNumber() {
    const yearStr = getYearStr();
    try {
      const { data } = await supabase
        .from('saving_schemes')
        .select('account_number')
        .like('account_number', `SGS-${yearStr}-%`)
        .order('account_number', { ascending: false })
        .limit(1);

      let seq = 1;
      if (data && data.length > 0) {
        const parts = data[0].account_number.split('-');
        const lastSeq = parseInt(parts[2]);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      return `SGS-${yearStr}-${seq.toString().padStart(3, '0')}`;
    } catch (err) {
      console.warn('Error generating next scheme number:', err);
      const rand = Math.floor(Math.random() * 900) + 100;
      return `SGS-${yearStr}-${rand}`;
    }
  },

  async saveSavingScheme(customerName, customerPhone, customerAddress, monthlyAmount, startDate, reminderDay) {
    try {
      // 1. Get or Create Customer
      const { data: existingCust } = await this.searchCustomerByPhone(customerPhone);
      let customerId;
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert([{
            name: customerName,
            phone: customerPhone.replace(/\D/g, '').slice(-10),
            address: customerAddress
          }])
          .select();
        customerId = newCust[0].id;
      }

      // 2. Generate Account Number
      const accountNo = await this.generateNextSchemeNumber();

      // 3. Insert scheme
      const { data: scheme, error: schemeErr } = await supabase
        .from('saving_schemes')
        .insert([{
          account_number: accountNo,
          customer_id: customerId,
          monthly_amount: parseFloat(monthlyAmount),
          start_date: startDate,
          reminder_day: parseInt(reminderDay) || 5,
          status: 'active',
          total_saved: 0
        }])
        .select();

      if (schemeErr) throw schemeErr;
      const s = scheme[0];

      // 4. Pre-generate 12 months tracker rows
      const monthsSeed = [];
      const baseDate = new Date(startDate);
      for (let i = 1; i <= 12; i++) {
        const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i - 1, 1);
        const label = monthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        monthsSeed.push({
          scheme_id: s.id,
          month_number: i,
          month_label: label,
          is_paid: false
        });
      }

      const { error: monthsErr } = await supabase.from('scheme_payments').insert(monthsSeed);
      if (monthsErr) throw monthsErr;

      return { data: s, error: null };
    } catch (err) {
      console.error('Error creating scheme:', err);
      return { data: null, error: err };
    }
  },

  async recordSchemePayment(schemeId, monthId, amountPaid, paymentMode, paymentDate) {
    try {
      // 1. Mark month as paid
      const { error: pErr } = await supabase
        .from('scheme_payments')
        .update({
          is_paid: true,
          amount_paid: parseFloat(amountPaid),
          payment_mode: paymentMode,
          payment_date: paymentDate || new Date().toISOString().split('T')[0]
        })
        .eq('id', monthId);

      if (pErr) throw pErr;

      // 2. Recalculate running total in schemes table
      const { data: allPayments } = await supabase
        .from('scheme_payments')
        .select('amount_paid')
        .eq('scheme_id', schemeId)
        .eq('is_paid', true);

      const total = allPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);

      const { error: updateErr } = await supabase
        .from('saving_schemes')
        .update({ total_saved: total })
        .eq('id', schemeId);

      if (updateErr) throw updateErr;

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  async processSchemeMaturity(schemeId, maturityInterest) {
    try {
      const { error } = await supabase
        .from('saving_schemes')
        .update({
          status: 'matured',
          maturity_interest: parseFloat(maturityInterest) || 0
        })
        .eq('id', schemeId);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  async closeSavingScheme(schemeId) {
    try {
      const { error } = await supabase
        .from('saving_schemes')
        .update({ status: 'closed' })
        .eq('id', schemeId);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  // ==========================================
  // 7. GOLD MORTGAGE LOANS SERVICE
  // ==========================================
  async getGoldLoans() {
    try {
      const { data, error } = await supabase
        .from('gold_loans')
        .select('*, customers(*), loan_repayments(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('Error fetching loans:', err);
      return { data: [], error: err };
    }
  },

  async generateNextLoanNumber() {
    const yearStr = getYearStr();
    try {
      const { data } = await supabase
        .from('gold_loans')
        .select('loan_number')
        .like('loan_number', `SGL-${yearStr}-%`)
        .order('loan_number', { ascending: false })
        .limit(1);

      let seq = 1;
      if (data && data.length > 0) {
        const parts = data[0].loan_number.split('-');
        const lastSeq = parseInt(parts[2]);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      return `SGL-${yearStr}-${seq.toString().padStart(3, '0')}`;
    } catch (err) {
      console.warn('Error generating next loan number:', err);
      const rand = Math.floor(Math.random() * 900) + 100;
      return `SGL-${yearStr}-${rand}`;
    }
  },

  async saveGoldLoan(customerName, customerPhone, customerAddress, goldWeight, goldPurity, appraisedValue, loanAmount, interestRate, loanDate, dueDate) {
    try {
      // Get or Create Customer
      const { data: existingCust } = await this.searchCustomerByPhone(customerPhone);
      let customerId;
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert([{
            name: customerName,
            phone: customerPhone.replace(/\D/g, '').slice(-10),
            address: customerAddress
          }])
          .select();
        customerId = newCust[0].id;
      }

      const loanNo = await this.generateNextLoanNumber();

      const { data, error } = await supabase
        .from('gold_loans')
        .insert([{
          loan_number: loanNo,
          customer_id: customerId,
          gold_weight: parseFloat(goldWeight),
          gold_purity: goldPurity,
          appraised_value: parseFloat(appraisedValue),
          loan_amount: parseFloat(loanAmount),
          interest_rate: parseFloat(interestRate) || 12.00,
          loan_date: loanDate,
          due_date: dueDate,
          status: 'active',
          total_repaid: 0
        }])
        .select();

      if (error) throw error;
      return { data: data[0], error: null };
    } catch (err) {
      console.error('Error saving gold loan:', err);
      return { data: null, error: err };
    }
  },

  async recordLoanRepayment(loanId, amount, paymentMode, notes = '') {
    try {
      // 1. Add record
      const { error: repErr } = await supabase
        .from('loan_repayments')
        .insert([{
          loan_id: loanId,
          amount: parseFloat(amount),
          payment_mode: paymentMode,
          payment_date: new Date().toISOString().split('T')[0],
          notes
        }]);

      if (repErr) throw repErr;

      // 2. Fetch loan to update totals
      const { data: loan } = await supabase
        .from('gold_loans')
        .select('loan_amount, total_repaid')
        .eq('id', loanId)
        .single();

      const newRepaid = parseFloat(loan.total_repaid) + parseFloat(amount);
      const isPaidOff = newRepaid >= parseFloat(loan.loan_amount);

      const { error: updateErr } = await supabase
        .from('gold_loans')
        .update({
          total_repaid: newRepaid,
          status: isPaidOff ? 'closed' : 'active'
        })
        .eq('id', loanId);

      if (updateErr) throw updateErr;

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  async closeGoldLoan(loanId) {
    try {
      const { error } = await supabase
        .from('gold_loans')
        .update({ status: 'closed' })
        .eq('id', loanId);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  // ==========================================
  // 8. DATABASE AUTO-SEEDING / SANDBOX POPULATION
  // ==========================================
  async seedInitialSandboxData() {
    try {
      // Check if bills table is empty
      const { count, error: countErr } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        console.warn('Seeding check ignored due to table missing or auth restriction:', countErr);
        return;
      }

      if (count > 0) {
        console.log('Database already populated. Skipping auto-seed.');
        return;
      }

      console.log('Seeding initial premium sandbox records into Shree Ganesh Jewellers...');

      // Seed 2 sample customers
      const { data: customers } = await supabase
        .from('customers')
        .insert([
          { name: 'Sanjay Deshmukh', phone: '9820123456', address: 'Plot 12, Sector 15, Kamothe' },
          { name: 'Priya Kadam', phone: '9004876543', address: 'Tirupati Garden, Sector 20, Kamothe' }
        ])
        .select();

      // Seed 3 stock items (2 gold, 1 silver)
      const { data: stockItems } = await supabase
        .from('stock')
        .insert([
          { item_number: 'AU-001', ornament_name: 'Gold Ring', metal_type: 'gold', weight: 5.500, purity: '22KT', quantity: 1, status: 'sold' },
          { item_number: 'AU-002', ornament_name: 'Gold Necklace', metal_type: 'gold', weight: 18.250, purity: '22KT', quantity: 1, status: 'available' },
          { item_number: 'AG-001', ornament_name: 'Silver Anklet', metal_type: 'silver', weight: 45.000, purity: '925 silver', quantity: 1, status: 'sold' }
        ])
        .select();

      // Seed 1 active Saving Scheme
      const schemeNo = await this.generateNextSchemeNumber();
      const { data: schemes } = await supabase
        .from('saving_schemes')
        .insert([{
          account_number: schemeNo,
          customer_id: customers[1].id,
          monthly_amount: 2000.00,
          start_date: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 months ago
          reminder_day: 10,
          status: 'active',
          total_saved: 4000.00
        }])
        .select();

      // Seed pre-generated payments for the scheme
      const monthsSeed = [];
      const baseDate = new Date(schemes[0].start_date);
      for (let i = 1; i <= 12; i++) {
        const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i - 1, 1);
        const label = monthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        
        // Mark first two months as paid
        monthsSeed.push({
          scheme_id: schemes[0].id,
          month_number: i,
          month_label: label,
          is_paid: i <= 2,
          amount_paid: i <= 2 ? 2000.00 : null,
          payment_mode: i <= 2 ? 'upi' : null,
          payment_date: i <= 2 ? new Date(baseDate.getFullYear(), baseDate.getMonth() + i - 1, 10).toISOString().split('T')[0] : null
        });
      }
      await supabase.from('scheme_payments').insert(monthsSeed);

      // Seed 1 Gold Loan
      const loanNo = await this.generateNextLoanNumber();
      await supabase
        .from('gold_loans')
        .insert([{
          loan_number: loanNo,
          customer_id: customers[0].id,
          gold_weight: 15.000,
          gold_purity: '22KT',
          appraised_value: 105000.00,
          loan_amount: 75000.00,
          interest_rate: 12.00,
          loan_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days ago
          due_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'active',
          total_repaid: 10000.00
        }]);

      // Seed Bills (1 completed, 1 partial)
      const billNo1 = await this.generateNextBillNumber();
      const { data: bills1 } = await supabase
        .from('bills')
        .insert([{
          bill_number: billNo1,
          customer_id: customers[0].id,
          bill_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          print_gst: true,
          subtotal: 38582.50,
          gst_amount: 1157.50,
          exchange_deduction: 0,
          total_amount: 39740.00,
          payment_status: 'paid',
          amount_paid: 39740.00,
          balance_due: 0
        }])
        .select();

      await supabase
        .from('bill_items')
        .insert([{
          bill_id: bills1[0].id,
          stock_id: stockItems[0].id,
          item_number: 'AU-001',
          ornament_name: 'Gold Ring',
          metal_type: 'gold',
          gross_weight: 5.500,
          stone_weight: 0.000,
          net_weight: 5.500,
          hsn_code: '7113',
          per_gram_rate: 6250.00,
          making_charges_percent: 12.00,
          other_charges: 0,
          item_total: 39740.00,
          gst_rate: 3.00
        }]);

      await supabase
        .from('payments')
        .insert([{
          bill_id: bills1[0].id,
          amount: 39740.00,
          payment_mode: 'upi',
          payment_date: new Date(bills1[0].bill_date).toISOString()
        }]);

      console.log('Seeding sandbox complete!');
    } catch (e) {
      console.warn('Sandbox seeding failed or tables not ready yet:', e);
    }
  }
};
