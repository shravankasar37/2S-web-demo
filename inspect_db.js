import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://njmcifegeristznahthz.supabase.co';
const supabaseKey = 'sb_publishable_-Vjw5apegVogIX0awpBJYg_Q8knV8EL';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('bills')
    .select('*, customers(*), bill_items(*), payments(*)');
  
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total bills found:', data?.length);
  data?.forEach(b => {
    console.log(`ID: ${b.id}, Bill No: ${b.bill_number}, Total: ${b.total_amount}, Paid: ${b.amount_paid}, Due: ${b.balance_due}, Customer: ${b.customers ? b.customers.name : 'NULL'}`);
  });
}
test();
