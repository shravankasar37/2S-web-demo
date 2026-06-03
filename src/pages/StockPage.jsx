import { useState, useEffect } from 'react';
import Layout from '../components/shared/Layout';
import { db } from '../lib/databaseService';
import { Plus, Trash2, Printer, Search, Barcode, Package, Layers } from 'lucide-react';

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export default function StockPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'add' | 'labels'
  
  // Search and filter
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('available');

  // Label print queue selections
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Print settings states
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [labelTemplate, setLabelTemplate] = useState('sheet'); // 'sheet' | 'thermal'
  const [showGuideBorder, setShowGuideBorder] = useState(false);

  // Form fields
  const [itemNumber, setItemNumber] = useState('');
  const [ornamentName, setOrnamentName] = useState('');
  const [metalType, setMetalType] = useState('gold');
  const [weight, setWeight] = useState('');
  const [hsnCode, setHsnCode] = useState('7113');
  const [purity, setPurity] = useState('22KT');
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    fetchStockList();
  }, []);

  async function fetchStockList() {
    setLoading(true);
    const { data } = await db.getStock();
    if (data) setStock(data);
    setLoading(false);
  };

  const handleMetalChange = (val) => {
    setMetalType(val);
    setPurity(val === 'gold' ? '22KT' : '925 silver');
    setHsnCode(val === 'gold' ? '7113' : '7114');
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!itemNumber.trim() || !ornamentName.trim() || !weight) {
      return alert('Please fill in Item Number, Ornament Name, and Weight.');
    }

    const item = {
      item_number: itemNumber,
      ornament_name: ornamentName,
      metal_type: metalType,
      weight: parseFloat(weight),
      hsn_code: hsnCode,
      purity: purity,
      quantity: parseInt(quantity) || 1,
      status: 'available',
      label_printed: false
    };

    const { error } = await db.saveStockItem(item);
    if (!error) {
      alert('Stock Item Saved Successfully!');
      setItemNumber('');
      setOrnamentName('');
      setWeight('');
      setQuantity('1');
      fetchStockList();
      setView('list');
    } else {
      alert('Failed to save stock item: ' + error.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (confirm('Are you sure you want to delete this stock item?')) {
      const { error } = await db.deleteStockItem(id);
      if (!error) {
        setStock(prev => prev.filter(item => item.id !== id));
      } else {
        alert('Failed to delete item: ' + error.message);
      }
    }
  };

  // Selection toggles
  const handleToggleSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(filteredStock.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleOpenPrintDialog = () => {
    if (selectedItems.length === 0) return alert('Select items to print labels.');
    setShowPrintModal(true);
  };

  const executePrint = async () => {
    setShowPrintModal(false);
    
    const styleId = 'dynamic-print-size';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    if (labelTemplate === 'sheet') {
      styleEl.innerHTML = `@media print { @page { size: 210mm 145mm !important; margin: 0 !important; } }`;
    } else {
      styleEl.innerHTML = `@media print { @page { size: 38mm 25mm !important; margin: 0 !important; } }`;
    }

    setTimeout(async () => {
      window.print();
      if (styleEl) styleEl.innerHTML = '';
      await db.markLabelPrinted(selectedItems);
      setSelectedItems([]);
      fetchStockList();
    }, 150);
  };

  const filteredStock = stock.filter(item => {
    const matchesSearch = 
      item.item_number.toLowerCase().includes(search.toLowerCase()) ||
      item.ornament_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesMetal = metalFilter === 'all' || item.metal_type === metalFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesMetal && matchesStatus;
  });

  // Calculate totals for active list
  const totals = filteredStock.reduce((acc, item) => {
    if (item.status === 'available') {
      acc.pcs += item.quantity;
      acc.weight += parseFloat(item.weight) * item.quantity;
    }
    return acc;
  }, { pcs: 0, weight: 0 });

  return (
    <Layout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-[#735c00]/10 pb-4 no-print">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-[#570000] tracking-wide">
              Showroom Stock Database
            </h2>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Add products, track quantities, and print labels
            </p>
          </div>
          <div className="flex gap-2">
            {view === 'list' ? (
              <>
                <button
                  onClick={() => setView('add')}
                  className="px-3.5 py-2 bg-[#570000] hover:bg-[#735c00] text-[#fed65b] font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Stock
                </button>
                {selectedItems.length > 0 && (
                  <button
                    onClick={handleOpenPrintDialog}
                    className="px-3.5 py-2 bg-[#735c00] hover:bg-[#735c00]/90 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Printer className="h-4 w-4 text-[#fed65b]" />
                    Print ({selectedItems.length}) Labels
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setView('list')}
                className="px-3.5 py-2 bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Back to Stock List
              </button>
            )}
          </div>
        </div>

        {/* 1. STOCK LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-4 no-print">
            
            {/* Search, Filters, and Totals */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-[#735c00]/10 rounded-2xl p-4 shadow-sm items-center">
              <div className="relative col-span-1 md:col-span-2">
                <input
                  type="text"
                  placeholder="Search item #, ornament name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#570000]"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#735c00]/60" />
              </div>
              <div>
                <select
                  value={metalFilter}
                  onChange={(e) => setMetalFilter(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                >
                  <option value="all">All Metals</option>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                </select>
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                >
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="all">All Items</option>
                </select>
              </div>
            </div>

            {/* Live Totals summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#570000]/5 border border-[#735c00]/20 rounded-2xl p-4 flex items-center justify-between font-bold">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Available Items</p>
                  <h4 className="text-xl text-[#570000] mt-1">{totals.pcs} Pcs</h4>
                </div>
                <Layers className="h-8 w-8 text-[#570000]/20" />
              </div>

              <div className="bg-[#735c00]/5 border border-[#735c00]/20 rounded-2xl p-4 flex items-center justify-between font-bold">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Available Weight</p>
                  <h4 className="text-xl text-[#735c00] mt-1">{totals.weight.toFixed(3)} g</h4>
                </div>
                <Package className="h-8 w-8 text-[#735c00]/20" />
              </div>
            </div>

            {/* Stock List table */}
            <div className="bg-white border border-[#735c00]/15 rounded-3xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center space-y-2">
                  <div className="h-6 w-6 rounded-full border-2 border-t-[#570000] border-r-transparent border-b-[#570000] border-l-transparent animate-spin mx-auto" />
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Loading Stock...</p>
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 italic">
                  No stock records found matching filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#570000]/5 text-[#570000] border-b border-[#735c00]/25 uppercase font-bold tracking-widest text-[9px]">
                        <th className="py-3 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            onChange={handleSelectAll}
                            checked={selectedItems.length === filteredStock.length && filteredStock.length > 0}
                            className="accent-[#570000] cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4">Item Code</th>
                        <th className="py-3 px-4">Particulars</th>
                        <th className="py-3 px-4">Metal / Purity</th>
                        <th className="py-3 px-4 text-right">Weight</th>
                        <th className="py-3 px-4">HSN</th>
                        <th className="py-3 px-4 text-center">Labels</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans font-bold">
                      {filteredStock.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/70 transition-all">
                          <td className="py-3 px-4 text-center">
                            {item.status === 'available' && (
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleToggleSelect(item.id)}
                                className="accent-[#570000] cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#570000]">{item.item_number}</td>
                          <td className="py-3 px-4 font-serif text-[#1c1b1b]">{item.ornament_name}</td>
                          <td className="py-3 px-4 text-gray-500 uppercase">{item.metal_type} - {item.purity}</td>
                          <td className="py-3 px-4 text-right font-mono text-gray-800">{item.weight.toFixed(3)}g</td>
                          <td className="py-3 px-4 font-mono text-gray-400">{item.hsn_code}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                              item.label_printed ? 'bg-gray-100 text-gray-500' : 'bg-[#735c00]/10 text-[#735c00]'
                            }`}>
                              {item.label_printed ? 'Printed' : 'Queue'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                              item.status === 'available' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.status === 'available' && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all border border-red-100"
                                title="Delete stock row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
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

        {/* 2. ADD STOCK FORM VIEW */}
        {view === 'add' && (
          <div className="bg-white border border-[#735c00]/10 rounded-3xl p-6 shadow-sm no-print">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#735c00] border-b border-gray-100 pb-2 mb-4 flex items-center gap-1.5">
              <Barcode className="h-4 w-4" />
              Register New Showroom Ornament
            </h3>

            <form onSubmit={handleSaveStock} className="space-y-4 font-bold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Metal Type
                  </label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => handleMetalChange('gold')}
                      className={`flex-1 py-2 text-xs border rounded-xl font-bold uppercase transition-all ${
                        metalType === 'gold' 
                          ? 'bg-[#570000] border-[#735c00]/40 text-[#fed65b]'
                          : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      Gold Ornament
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMetalChange('silver')}
                      className={`flex-1 py-2 text-xs border rounded-xl font-bold uppercase transition-all ${
                        metalType === 'silver' 
                          ? 'bg-[#570000] border-[#735c00]/40 text-[#fed65b]'
                          : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      Silver Ornament
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Item Number (Unique SKU)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AU-001, AG-045"
                    value={itemNumber}
                    onChange={(e) => setItemNumber(e.target.value.toUpperCase())}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#570000] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Ornament Particulars
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mangalsutra, Ring"
                    value={ornamentName}
                    onChange={(e) => setOrnamentName(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#570000] font-serif"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Ornament Purity
                  </label>
                  <select
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-2.5 py-2 text-xs font-bold"
                  >
                    {metalType === 'gold' ? (
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

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    required
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-xs font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Net Weight in Grams (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.000"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-xs font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Starting Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-[#fcf9f8] border border-[#735c00]/20 rounded-xl px-3.5 py-2 text-xs font-mono text-right"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3.5 bg-[#570000] hover:bg-[#735c00] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                Log to Showroom Registry
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Print Configurator Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="w-full max-w-md bg-[#fcf9f8] border-2 border-[#735c00]/40 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#570000] px-5 py-3.5 border-b border-[#735c00]/30 text-[#fed65b] font-bold flex items-center justify-between">
              <h3 className="font-serif text-xs tracking-wider uppercase flex items-center gap-2">
                <Printer className="h-4.5 w-4.5 text-[#fed65b]" />
                Barcode Label Printer Settings
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="text-white">✕</button>
            </div>

            <div className="p-6 space-y-6 font-bold text-xs text-gray-700">
              <div className="bg-[#570000]/5 border border-[#735c00]/25 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Printing Queue</p>
                <p className="text-sm text-[#570000]">You have selected <strong className="text-base">{selectedItems.length}</strong> items to print.</p>
              </div>

              {/* Template selection radio group */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 tracking-wider">
                  Select Label Template Format
                </label>
                
                <div className="grid grid-cols-1 gap-3">
                  <label className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    labelTemplate === 'sheet' 
                      ? 'bg-amber-500/5 border-amber-500/30 text-amber-950 shadow-sm'
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="labelTemplate" 
                      value="sheet" 
                      checked={labelTemplate === 'sheet'} 
                      onChange={() => setLabelTemplate('sheet')}
                      className="accent-[#570000] mt-0.5"
                    />
                    <div>
                      <div className="font-serif text-sm font-bold text-gray-800">A4 Computer Sheet (2-Across)</div>
                      <div className="text-[10px] font-semibold text-gray-400 mt-1 leading-normal">
                        Recommended for <strong>Comp. Label 2</strong> sheets. Prints 2 columns of wide tags (95mm × 25mm). Displays ornament particulars, metal info, purity, item SKU, and weight.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    labelTemplate === 'thermal' 
                      ? 'bg-amber-500/5 border-amber-500/30 text-amber-950 shadow-sm'
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="labelTemplate" 
                      value="thermal" 
                      checked={labelTemplate === 'thermal'} 
                      onChange={() => setLabelTemplate('thermal')}
                      className="accent-[#570000] mt-0.5"
                    />
                    <div>
                      <div className="font-serif text-sm font-bold text-gray-800">Thermal Roll Tape (Single Tag)</div>
                      <div className="text-[10px] font-semibold text-gray-400 mt-1 leading-normal">
                        Recommended for <strong>TSC TE244</strong> or other thermal roll printers. Prints small stacked price labels (38mm × 25mm) displaying SKU, weight, and shop identifier.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Alignments and guide borders option */}
              <div className="space-y-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-gray-800">Show Boundary Borders</div>
                  <p className="text-[9px] font-semibold text-gray-400 leading-normal">Print light borders. Helpful for testing sheet alignment on plain A4 paper.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showGuideBorder} 
                    onChange={(e) => setShowGuideBorder(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#570000]"></div>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 py-3 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executePrint}
                  className="flex-1 py-3 text-xs text-[#570000] bg-[#fed65b] border border-[#735c00]/40 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#fed65b]/95"
                >
                  <Printer className="h-4 w-4" />
                  Proceed to Print
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Hidden print-only container styled dynamically for TSC TE244 roll or custom A5 sheets */}
      {labelTemplate === 'sheet' ? (
        /* A5 Sheet Print Mode (2 Columns x 13 Rows = 26 labels per page, matching exact dimensions) */
        <div className="print-only hidden print:block bg-white p-0">
          {chunkArray(stock.filter(item => selectedItems.includes(item.id)), 26).map((pageItems, pageIdx) => (
            <div 
              key={pageIdx}
              style={{ 
                width: '210mm', 
                height: '145mm', 
                boxSizing: 'border-box',
                paddingTop: '1mm', 
                paddingLeft: '9mm', 
                paddingRight: '9mm',
                overflow: 'hidden',
                pageBreakAfter: 'always',
                backgroundColor: 'white'
              }}
            >
              <div 
                className="grid grid-cols-2 text-black font-sans font-bold" 
                style={{ 
                  width: '192mm', 
                  columnGap: '0mm',
                  rowGap: '0mm'
                }}
              >
                {pageItems.map(item => (
                  <div 
                    key={item.id}
                    className={`flex items-center justify-between px-4 text-left ${showGuideBorder ? 'border border-gray-300' : 'border border-transparent'}`}
                    style={{
                      width: '96mm',
                      height: '11mm',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      pageBreakInside: 'avoid',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {/* ONLY Print Item Number and Weight */}
                    <span className="text-[12px] font-mono font-black text-[#570000] tracking-wider leading-none">{item.item_number}</span>
                    <span className="text-[12px] font-mono font-black text-gray-900 leading-none">{item.weight.toFixed(3)} g</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Thermal Roll Print Mode (Single Column Tag) */
        <div className="print-only hidden print:block bg-white p-0">
          <div className="flex flex-col items-center gap-0" style={{ width: '100%' }}>
            {stock.filter(item => selectedItems.includes(item.id)).map(item => (
              <div 
                key={item.id}
                className={`flex flex-col items-center justify-center p-2 text-center ${showGuideBorder ? 'border border-black' : 'border border-transparent'}`}
                style={{
                  width: '38mm',
                  height: '25mm',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  pageBreakAfter: 'always'
                }}
              >
                {/* ONLY Print Item Number and Weight */}
                <div className="text-[12px] font-mono font-black uppercase leading-none tracking-widest text-[#570000]">{item.item_number}</div>
                <div className="text-[11px] mt-1.5 font-bold font-mono text-gray-900 leading-none">{item.weight.toFixed(3)} g</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
