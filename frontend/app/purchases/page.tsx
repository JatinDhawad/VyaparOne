'use client';

import { useState, useMemo, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Trash2, 
  PackageCheck, 
  Receipt, 
  DollarSign, 
  ShoppingBag, 
  FileText, 
  Search, 
  Truck,
  Sparkles,
  CreditCard,
  Pencil,
  Eye,
  Building2,
  Calendar,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, EmptyState, Badge, FilterChip } from '@/components/ui';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

  // Main Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Pre-fill supplier from URL (e.g. from Parties page) ───────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const suppId = params.get('supplierId') || params.get('supplier_id');
      const shouldOpen = params.get('openModal') === 'true' || !!suppId;

      if (suppId) {
        setSupplierId(suppId);
      }
      if (shouldOpen && suppId) {
        setIsModalOpen(true);
      }
    }
  }, []);
  
  // Itemized Expenses & Deductions
  const [lrCharges, setLrCharges] = useState('');
  const [localFreight, setLocalFreight] = useState('');
  const [salesmanExpense, setSalesmanExpense] = useState('');
  const [schemeMoney, setSchemeMoney] = useState('');
  const [discountDeduction, setDiscountDeduction] = useState('');

  // Unbilled & Payment Given
  const [unbilledNonGst, setUnbilledNonGst] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  // Item Add State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productName, setProductName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BAG');
  const [billedQty, setBilledQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [gstRate, setGstRate] = useState('5.00');

  // Items Array
  const [items, setItems] = useState<any[]>([]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.getParties('SUPPLIER'),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: any) => api.createPurchase(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      const msg = `Purchase invoice #${invoiceNumber || res.invoice_number} saved successfully!`;
      setSuccessMessage(msg);
      toast.success(msg);
      setTimeout(() => setSuccessMessage(''), 6000);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to record purchase bill.';
      setFormError(msg);
      toast.error(msg);
    },
  });

  // Edit purchase bill fields only (no stock re-processing)
  const [editLr, setEditLr]                   = useState('');
  const [editFreight, setEditFreight]         = useState('');
  const [editSalesmanExp, setEditSalesmanExp] = useState('');
  const [editScheme, setEditScheme]           = useState('');
  const [editDiscount, setEditDiscount]       = useState('');
  const [editUnbilled, setEditUnbilled]       = useState('');
  const [editAmountPaid, setEditAmountPaid]   = useState('');
  const [editNotes, setEditNotes]             = useState('');

  const openEditInvoice = (inv: any) => {
    setEditInvoice(inv);
    setEditLr(inv.lr_charges ? String(inv.lr_charges) : '');
    setEditFreight(inv.local_freight ? String(inv.local_freight) : '');
    setEditSalesmanExp(inv.salesman_expense ? String(inv.salesman_expense) : '');
    setEditScheme(inv.scheme_money ? String(inv.scheme_money) : '');
    setEditDiscount(inv.discount_deduction ? String(inv.discount_deduction) : '');
    setEditUnbilled(inv.unbilled_nongst_amount ? String(inv.unbilled_nongst_amount) : '');
    setEditAmountPaid(inv.amount_paid ? String(inv.amount_paid) : '');
    setEditNotes(inv.notes || '');
    setEditError('');
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.editPurchase(id, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setEditInvoice(null);
      const msg = `Purchase bill #${editInvoice?.invoice_number || res?.invoice_number} updated successfully!`;
      setSuccessMessage(msg);
      toast.success(msg);
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to update purchase bill.';
      setEditError(msg);
      toast.error(msg);
    },
  });

  // ── Record Payment State & Mutation ───────────────────────────────────────
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState('');

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.payPurchase(id, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      const msg = `Payment of ₹${formatCurrency(parseFloat(payAmount) || 0)} recorded for Bill #${payInvoice?.invoice_number || res.invoice_number}!`;
      setPayInvoice(null);
      setSuccessMessage(msg);
      toast.success(msg);
      setTimeout(() => setSuccessMessage(''), 6000);
      setPayAmount('');
      setPayRef('');
      setPayRemarks('');
      setPayError('');
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to record supplier payment.';
      setPayError(msg);
      toast.error(msg);
    },
  });

  const openPayModal = (p: any) => {
    setPayInvoice(p);
    const bTotal = parseFloat(p.grand_total || 0);
    const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
    const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);
    const paid = parseFloat(p.amount_paid || 0);
    const pending = parseFloat(p.pending_amount || Math.max(0, payable - paid));

    setPayAmount(pending > 0 ? String(pending) : '');
    setPayMode('CASH');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRef('');
    setPayRemarks('');
    setPayError('');
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setLrCharges('');
    setLocalFreight('');
    setSalesmanExpense('');
    setSchemeMoney('');
    setDiscountDeduction('');
    setUnbilledNonGst('');
    setAmountPaid('');
    setNotes('');
    setItems([]);
    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setUnit('BAG');
    setBilledQty('');
    setUnitPrice('');
    setGstRate('5.00');
    setFormError('');
  };

  const handleProductSelect = (prodId: string) => {
    setSelectedProduct(prodId);
    if (!prodId) {
      setProductName('');
      setHsnCode('');
      setUnitPrice('4800.00');
      return;
    }
    const prod = products.find((p: any) => p.id === prodId);
    if (prod) {
      setProductName(prod.name);
      setHsnCode(prod.hsn_code || prod.sku);
      setUnit(prod.unit || 'BAG');
      setUnitPrice(parseFloat(prod.default_purchase_price || 0).toString());
      setGstRate(parseFloat(prod.gst_rate || 0).toString());
    }
  };

  const handleAddItem = () => {
    const qtyVal = parseFloat(billedQty) || 0;
    const priceVal = parseFloat(unitPrice) || 0;
    const rateGst = parseFloat(gstRate) || 0;

    if (qtyVal <= 0) {
      setFormError('Quantity must be greater than 0.');
      return;
    }

    if (!productName && !selectedProduct) {
      setFormError('Please select or enter a product description.');
      return;
    }

    setFormError('');

    const taxable = qtyVal * priceVal;
    const gstAmt = taxable * (rateGst / 100);
    const lineTotal = taxable + gstAmt;

    setItems([
      ...items,
      {
        product_id: selectedProduct || null,
        product_name: productName || `Item ${hsnCode}`,
        hsn_code: hsnCode || '21069030',
        unit: unit || 'BAG',
        billed_quantity: qtyVal,
        unit_purchase_price: priceVal,
        gst_rate: rateGst,
        taxable_amount: taxable,
        gst_amount: gstAmt,
        line_total: lineTotal,
      },
    ]);

    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setBilledQty('5');
  };

  const handleEditItem = (index: number) => {
    const itemToEdit = items[index];
    setSelectedProduct(itemToEdit.product_id || '');
    setProductName(itemToEdit.product_name || '');
    setHsnCode(itemToEdit.hsn_code || '');
    setUnit(itemToEdit.unit || 'BAG');
    setBilledQty(itemToEdit.billed_quantity.toString());
    setUnitPrice(itemToEdit.unit_purchase_price.toString());
    setGstRate(itemToEdit.gst_rate.toString());
    setItems(items.filter((_, i) => i !== index));
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setFormError('Please select a supplier vendor.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one line item to the purchase bill.');
      return;
    }

    createPurchaseMutation.mutate({
      invoice_number: invoiceNumber || `PUR-${Date.now()}`,
      supplier_id: supplierId,
      invoice_date: invoiceDate,
      lr_charges: parseFloat(lrCharges) || 0,
      local_freight: parseFloat(localFreight) || 0,
      salesman_expense: parseFloat(salesmanExpense) || 0,
      scheme_money: parseFloat(schemeMoney) || 0,
      discount_deduction: parseFloat(discountDeduction) || 0,
      unbilled_nongst_amount: parseFloat(unbilledNonGst) || 0,
      amount_paid: parseFloat(amountPaid) || 0,
      notes,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        hsn_code: i.hsn_code,
        unit: i.unit,
        billed_quantity: i.billed_quantity,
        unit_purchase_price: i.unit_purchase_price,
        discount_amount: 0,
        gst_rate: i.gst_rate,
      })),
    });
  };

  // Calculations: All 4 expenses (LR Charges, Local Freight, Salesman Expense, Scheme Money) are minused/deducted
  const calculatedSubtotal = items.reduce((sum, i) => sum + i.taxable_amount, 0);
  const calculatedTaxAmount = items.reduce((sum, i) => sum + i.gst_amount, 0);

  const numLr = parseFloat(lrCharges) || 0;
  const numLocalFr = parseFloat(localFreight) || 0;
  const numSalesExp = parseFloat(salesmanExpense) || 0;
  const numScheme = parseFloat(schemeMoney) || 0;
  const numDiscountDeduct = parseFloat(discountDeduction) || 0;

  const totalBilledExpenses = - (numLr + numLocalFr + numSalesExp + numScheme + numDiscountDeduct);
  const officialBilledTotal = calculatedSubtotal + calculatedTaxAmount;

  const unbilledPayable = parseFloat(unbilledNonGst) || 0;
  const totalPayableAmount = officialBilledTotal + totalBilledExpenses + unbilledPayable;

  const numPaid = parseFloat(amountPaid) || 0;
  const pendingBalanceOwed = totalPayableAmount - numPaid;

  // Filtered + Sorted List
  const [sortField, setSortField] = useState<'date' | 'invoice' | 'billed' | 'unbilled' | 'payable' | 'pending'>('date');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p: any) => {
      const bTotal = parseFloat(p.grand_total || 0);
      const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
      const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);
      const paid = parseFloat(p.amount_paid || 0);
      const pending = parseFloat(p.pending_amount || payable - paid);

      if (statusFilter === 'PAID' && pending > 0) return false;
      if (statusFilter === 'PENDING' && pending <= 0) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const invMatch = (p.invoice_number || '').toLowerCase().includes(q);
        const suppMatch = (p.supplier?.name || '').toLowerCase().includes(q);
        if (!invMatch && !suppMatch) return false;
      }
      return true;
    });
  }, [purchases, statusFilter, searchTerm]);

  const sortedPurchases = useMemo(() => {
    return [...filteredPurchases].sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortField === 'date')     { valA = a.invoice_date;               valB = b.invoice_date; }
      if (sortField === 'invoice')  { valA = a.invoice_number;             valB = b.invoice_number; }
      if (sortField === 'billed')   { valA = parseFloat(a.grand_total || 0);             valB = parseFloat(b.grand_total || 0); }
      if (sortField === 'unbilled') { valA = parseFloat(a.unbilled_nongst_amount || 0); valB = parseFloat(b.unbilled_nongst_amount || 0); }
      if (sortField === 'payable')  { valA = parseFloat(a.total_payable_amount || 0);   valB = parseFloat(b.total_payable_amount || 0); }
      if (sortField === 'pending')  { valA = parseFloat(a.pending_amount || 0);          valB = parseFloat(b.pending_amount || 0); }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPurchases, sortField, sortDir]);

  // Overall Totals
  const totalBilledPurchases = purchases.reduce((sum: number, p: any) => sum + parseFloat(p.grand_total || 0), 0);
  const totalPendingOwed = purchases.reduce((sum: number, p: any) => sum + parseFloat(p.pending_amount || 0), 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Purchase Invoices & Bills" 
          onActionClick={() => setIsModalOpen(true)}
          actionLabel="New Purchase Entry"
        />

        <main className="p-4 sm:p-8 space-y-6 sm:space-y-8 flex-1 overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold shadow-sm flex items-center gap-3 animate-in fade-in duration-300">
              <PackageCheck className="h-6 w-6 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Top Metric Cards */}
          {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed Purchases</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-36 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    ₹{formatCurrency(totalBilledPurchases)}
                  </h3>
                )}
                <p className="text-xs font-normal text-slate-500 mt-1">Official GST Vendor Invoices</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoices</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-24 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {purchases.length} <span className="text-sm font-normal text-slate-500">Invoices</span>
                  </h3>
                )}
                <p className="text-xs font-normal text-slate-500 mt-1">Purchases Record</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Amount</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-36 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-rose-700 tracking-tight">
                    ₹{formatCurrency(totalPendingOwed)}
                  </h3>
                )}
                <p className="text-xs font-normal text-rose-600 mt-1">Pending Supplier Payables</p>
              </div>
            </div>
          </div>

          {/* Table Panel */}
          <div className="glass-panel p-6 rounded-3xl space-y-6 border border-slate-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice number or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full glass-input pl-11 pr-4 py-2.5 rounded-2xl text-xs font-medium"
                />
              </div>

              {/* Status and Sort Controls */}
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
                {/* Status Toggles */}
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  {(['ALL', 'PAID', 'PENDING'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 font-bold rounded-lg text-[11px] transition-all ${
                        statusFilter === st
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : st === 'PAID' ? 'Paid' : 'Pending'}
                    </button>
                  ))}
                </div>

                {/* Sort controls */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Sort:</span>
                  {([['date','Date'],['invoice','Invoice #'],['billed','Billed'],['unbilled','Unbilled'],['payable','Payable'],['pending','Pending']] as const).map(([f, label]) => (
                    <button
                      key={f}
                      onClick={() => toggleSort(f)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                        sortField === f
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      {label}
                      {sortField === f
                        ? sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            {(searchTerm.trim() !== '' || statusFilter !== 'ALL' || sortField !== 'date' || sortDir !== 'desc') && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                <span className="text-[11px] font-bold text-slate-400">Active Filters:</span>
                {searchTerm.trim() !== '' && (
                  <FilterChip
                    label="Search"
                    value={`"${searchTerm}"`}
                    onRemove={() => setSearchTerm('')}
                  />
                )}
                {statusFilter !== 'ALL' && (
                  <FilterChip
                    label="Status"
                    value={statusFilter === 'PAID' ? 'Paid Bills' : 'Pending Dues'}
                    onRemove={() => setStatusFilter('ALL')}
                  />
                )}
                {(sortField !== 'date' || sortDir !== 'desc') && (
                  <FilterChip
                    label="Sort"
                    value={`${sortField.toUpperCase()} (${sortDir.toUpperCase()})`}
                    onRemove={() => {
                      setSortField('date');
                      setSortDir('desc');
                    }}
                  />
                )}
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setSortField('date');
                    setSortDir('desc');
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-rose-600 underline ml-1 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* New purchase button row */}
            <div className="flex justify-end">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Purchase Entry
              </button>
            </div>

            {/* Purchase List Table */}
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm max-h-[700px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 border-b border-slate-200 uppercase text-[10px] font-extrabold tracking-wider">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4 text-right text-indigo-900">Billed Total (₹)</th>
                    <th className="p-4 text-right text-amber-800">Unbilled Amount (₹)</th>
                    <th className="p-4 text-right">Total Payable (₹)</th>
                    <th className="p-4 text-right text-emerald-800">Amount Paid (₹)</th>
                    <th className="p-4 text-right text-rose-800">Pending Balance (₹)</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="p-4"><Skeleton className="h-5 w-24 rounded-lg" /></td>
                        <td className="p-4"><Skeleton className="h-5 w-20 rounded-lg" /></td>
                        <td className="p-4"><Skeleton className="h-5 w-32 rounded-lg" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-5 w-24 rounded-lg ml-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-5 w-24 rounded-lg ml-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-5 w-20 rounded-lg ml-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-6 w-16 rounded-xl ml-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></td>
                      </tr>
                    ))
                  ) : sortedPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8">
                        <EmptyState
                          icon={ShoppingBag}
                          title="No Purchase Invoices"
                          description={searchTerm ? "No bills matched your search query." : "Record your first inward inventory purchase bill."}
                          actionLabel="New Purchase Entry"
                          onAction={() => setIsModalOpen(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    sortedPurchases.map((p: any) => {
                      const bTotal = parseFloat(p.grand_total || 0);
                      const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
                      const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);
                      const paid = parseFloat(p.amount_paid || 0);
                      const pending = parseFloat(p.pending_amount || payable - paid);
                      const supplierName = p.supplier?.name || 'Vendor';

                      return (
                        <tr 
                          key={p.id} 
                          className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                          <td className="p-4 font-mono font-extrabold text-indigo-700 text-sm">{p.invoice_number}</td>
                          <td className="p-4 font-medium text-slate-600">{p.invoice_date}</td>
                          <td className="p-4 font-bold text-slate-900">{supplierName}</td>
                          <td className="p-4 text-right font-extrabold text-indigo-950 text-sm">₹{formatCurrency(bTotal)}</td>
                          <td className="p-4 text-right text-amber-800 font-bold">₹{formatCurrency(unbilled)}</td>
                          <td className="p-4 text-right font-extrabold text-slate-900">₹{formatCurrency(payable)}</td>
                          <td className="p-4 text-right text-emerald-700 font-extrabold">₹{formatCurrency(paid)}</td>
                          <td className="p-4 text-right">
                            <Badge variant={pending <= 0 ? 'success' : 'danger'} size="sm">
                              {pending <= 0 ? 'Paid' : `₹${formatCurrency(pending)}`}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {pending > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openPayModal(p); }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs"
                                  title="Record Part or Full Payment to Supplier"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Pay
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedInvoiceForView(p); }} 
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-extrabold text-xs transition-colors inline-flex items-center gap-1.5 border border-indigo-200"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditInvoice(p); }} 
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-extrabold text-xs transition-colors inline-flex items-center gap-1.5 border border-amber-200"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Invoice Details & Cost Breakdown Modal */}
      {selectedInvoiceForView && (
        <Modal 
          isOpen={!!selectedInvoiceForView} 
          onClose={() => setSelectedInvoiceForView(null)} 
          title={`Purchase Invoice Breakdown - #${selectedInvoiceForView.invoice_number}`} 
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs">
            {/* Header Details Card */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Supplier Vendor</span>
                <span className="font-extrabold text-slate-900 text-base">{selectedInvoiceForView.supplier?.name || 'Vendor'}</span>
                {selectedInvoiceForView.supplier?.city && (
                  <span className="text-xs text-slate-500 block font-medium">{selectedInvoiceForView.supplier.city}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Number</span>
                <span className="font-mono font-extrabold text-indigo-700 text-base">{selectedInvoiceForView.invoice_number}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Date</span>
                <span className="font-extrabold text-slate-800 text-base">{selectedInvoiceForView.invoice_date}</span>
              </div>
            </div>

            {/* Line Items Table */}
            {selectedInvoiceForView.items && selectedInvoiceForView.items.length > 0 && (
              <div className="space-y-2">
                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider block">Purchased Goods Items ({selectedInvoiceForView.items.length})</span>
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold">
                      <tr>
                        <th className="p-3">Product Description</th>
                        <th className="p-3">HSN Code</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Rate / Unit</th>
                        <th className="p-3">GST %</th>
                        <th className="p-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedInvoiceForView.items.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-extrabold text-slate-900">{it.product?.name || `Item ${it.product_id}`}</td>
                          <td className="p-3 font-mono text-indigo-700 font-bold">{it.product?.hsn_code || it.product?.sku || '-'}</td>
                          <td className="p-3 font-bold">{it.billed_quantity} {it.product?.unit || 'BAG'}</td>
                          <td className="p-3 font-semibold">₹{parseFloat(it.unit_purchase_price || 0).toFixed(2)}</td>
                          <td className="p-3 font-bold text-slate-600">{it.gst_rate}%</td>
                          <td className="p-3 font-extrabold text-slate-900 text-right">₹{parseFloat(it.line_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Complete Financial Breakdown & Cost Origin */}
            <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100 space-y-4">
              <span className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider block flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-600" />
                Cost Breakdown & Invoice Expenses Origin
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">Goods Subtotal (Taxable Value):</span>
                  <span className="font-extrabold text-slate-900">₹{parseFloat(selectedInvoiceForView.subtotal || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">GST Tax Amount:</span>
                  <span className="font-extrabold text-slate-900">₹{parseFloat(selectedInvoiceForView.tax_amount || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">LR Charges:</span>
                  <span className="font-bold text-indigo-900">₹{parseFloat(selectedInvoiceForView.lr_charges || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">Local Freight:</span>
                  <span className="font-bold text-indigo-900">₹{parseFloat(selectedInvoiceForView.local_freight || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">Salesman Expense Deduction (-):</span>
                  <span className="font-bold text-emerald-700">₹{parseFloat(selectedInvoiceForView.salesman_expense || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">Scheme Money Deduction (-):</span>
                  <span className="font-bold text-emerald-700">₹{parseFloat(selectedInvoiceForView.scheme_money || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-indigo-100/80">
                  <span className="font-medium text-slate-600">Discount Deduction (-):</span>
                  <span className="font-bold text-emerald-700">₹{parseFloat(selectedInvoiceForView.discount_deduction || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Summary Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t-2 border-indigo-200">
                <div className="p-3.5 rounded-2xl bg-white border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Official GST Billed Total</span>
                  <span className="font-extrabold text-indigo-950 text-base">₹{parseFloat(selectedInvoiceForView.grand_total || 0).toFixed(2)}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">Unbilled Non-GST Amount</span>
                  <span className="font-extrabold text-amber-900 text-base">₹{parseFloat(selectedInvoiceForView.unbilled_nongst_amount || 0).toFixed(2)}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Total Purchase Payable</span>
                  <span className="font-extrabold text-emerald-900 text-base">₹{parseFloat(selectedInvoiceForView.total_payable_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment & Pending Balance */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 text-xs">
                <div>
                  <span className="font-medium text-slate-500 block">Amount Paid to Supplier</span>
                  <span className="font-extrabold text-emerald-700 text-sm">₹{parseFloat(selectedInvoiceForView.amount_paid || 0).toFixed(2)}</span>
                </div>

                <div className="text-right">
                  <span className="font-medium text-slate-500 block">Pending Balance Owed</span>
                  <span className={`font-extrabold text-sm ${parseFloat(selectedInvoiceForView.pending_amount || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{parseFloat(selectedInvoiceForView.pending_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action buttons inside View Modal */}
              <div className="flex justify-end gap-3 pt-2">
                {parseFloat(selectedInvoiceForView.pending_amount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const inv = selectedInvoiceForView;
                      setSelectedInvoiceForView(null);
                      openPayModal(inv);
                    }}
                    className="px-4 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CreditCard className="h-4 w-4" />
                    Pay Supplier (₹{parseFloat(selectedInvoiceForView.pending_amount || 0).toFixed(2)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForView(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* New Purchase Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Purchase Invoice" maxWidth="max-w-5xl">
        {formError && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold mb-4">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          
          {/* SECTION 1: Supplier & Bill Metadata */}
          <div className="p-6 rounded-3xl bg-slate-50/80 border border-slate-200 space-y-4">
            <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider block flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              1. Supplier & Invoice Details
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Invoice Number *</label>
                <input required type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. 43" className="w-full glass-input p-3 rounded-2xl font-mono text-sm font-bold" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Select Supplier *</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white text-xs font-bold text-slate-900">
                  <option value="">-- Choose Vendor --</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city || 'Vendor'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Invoice Date *</label>
                <input required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-semibold" />
              </div>
            </div>
          </div>

          {/* SECTION 2: Goods & Stock Items Builder */}
          <div className="p-6 rounded-3xl bg-indigo-50/40 border border-indigo-100 space-y-5">
            <span className="font-extrabold text-indigo-900 text-xs uppercase tracking-wider block flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              2. Add Goods & Items
            </span>

            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-5 space-y-2">
                <label className="block text-xs font-extrabold text-slate-700">Select Product or Enter Item Description</label>
                <select value={selectedProduct} onChange={(e) => handleProductSelect(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white text-xs font-bold text-indigo-950 shadow-sm">
                  <option value="">-- Pick Existing SKU Catalog --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (HSN: {p.hsn_code || p.sku})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="Item Description (e.g. MOUTH FRESHNER @ 1/-)" 
                  value={productName} 
                  onChange={(e) => setProductName(e.target.value)} 
                  className="w-full glass-input p-3 rounded-2xl text-xs font-extrabold text-slate-900" 
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">HSN/SAC Code</label>
                <input type="text" placeholder="21069030" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-mono uppercase text-xs font-bold" />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity & Unit</label>
                <div className="flex gap-1.5">
                  <input type="text" inputMode="decimal" placeholder="1" value={billedQty} onChange={(e) => setBilledQty(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs" />
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input p-3 rounded-2xl bg-white text-xs font-extrabold">
                    <option value="BAG">BAG</option>
                    <option value="BOX">BOX</option>
                    <option value="KG">KG</option>
                    <option value="PKT">PKT</option>
                  </select>
                </div>
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rate / Unit (₹)</label>
                <input type="text" inputMode="decimal" placeholder="0.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs text-slate-900" />
              </div>

              <div className="col-span-6 md:col-span-1">
                <button type="button" onClick={handleAddItem} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl shadow-md shadow-indigo-600/20 text-xs transition-all">
                  + Add
                </button>
              </div>
            </div>

            {/* Added Invoice Items List Table */}
            {items.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="font-extrabold text-slate-800 block text-xs">Invoice Items Cart ({items.length})</span>
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100/90 text-slate-500 uppercase text-[10px] font-extrabold">
                      <tr>
                        <th className="p-3.5">Item Description</th>
                        <th className="p-3.5">HSN/SAC</th>
                        <th className="p-3.5">Quantity</th>
                        <th className="p-3.5">Rate per Unit</th>
                        <th className="p-3.5">GST %</th>
                        <th className="p-3.5">Taxable Value</th>
                        <th className="p-3.5">Line Total</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{it.product_name}</td>
                          <td className="p-3.5 font-mono text-indigo-700 font-bold">{it.hsn_code}</td>
                          <td className="p-3.5 font-extrabold text-slate-900">{it.billed_quantity} {it.unit}</td>
                          <td className="p-3.5 font-semibold">₹{it.unit_purchase_price.toFixed(2)}</td>
                          <td className="p-3.5 font-bold text-slate-600">{it.gst_rate}%</td>
                          <td className="p-3.5 font-semibold text-slate-800">₹{it.taxable_amount.toFixed(2)}</td>
                          <td className="p-3.5 font-extrabold text-indigo-900 text-sm">₹{it.line_total.toFixed(2)}</td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleEditItem(idx)} title="Edit Item" className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => handleRemoveItem(idx)} title="Delete Item" className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Financial Breakdown & Payments */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Card A: Itemized Billed Expenses & Invoice Total */}
            <div className="p-5 rounded-3xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs shadow-sm">
              <span className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider block flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-700" />
                Billed Invoice Summary
              </span>

              <div className="flex justify-between text-slate-700 py-0.5">
                <span>Subtotal (Taxable):</span>
                <span className="font-extrabold text-slate-900">₹{calculatedSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-700 py-0.5">
                <span>GST Tax Amount (5%):</span>
                <span className="font-extrabold text-slate-900">₹{calculatedTaxAmount.toFixed(2)}</span>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-indigo-100">
                <div className="flex justify-between items-center text-slate-700">
                  <span>LR Charges:</span>
                  <input type="text" inputMode="decimal" placeholder="0" value={lrCharges} onChange={(e) => setLrCharges(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-indigo-900" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Local Freight:</span>
                  <input type="text" inputMode="decimal" placeholder="0" value={localFreight} onChange={(e) => setLocalFreight(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-indigo-900" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Salesman Expense:</span>
                  <input type="text" inputMode="decimal" placeholder="0" value={salesmanExpense} onChange={(e) => setSalesmanExpense(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Scheme Money:</span>
                  <input type="text" inputMode="decimal" placeholder="0" value={schemeMoney} onChange={(e) => setSchemeMoney(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Discount Deduction (-):</span>
                  <input type="text" inputMode="decimal" placeholder="0" value={discountDeduction} onChange={(e) => setDiscountDeduction(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
              </div>

              <div className="flex justify-between text-indigo-950 font-extrabold text-sm border-t-2 border-indigo-200 pt-2">
                <span>Official Billed Total:</span>
                <span>₹{officialBilledTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Card B: Unbilled Cash / Non-GST Amount */}
            <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200 space-y-2.5 text-xs shadow-sm flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-amber-950 text-xs uppercase tracking-wider block flex items-center gap-1.5 mb-2">
                  <DollarSign className="h-4 w-4 text-amber-700" />
                  Unbilled Non-GST Amount
                </span>

                <p className="text-[11px] text-amber-800 font-medium mb-3">Unbilled cash or off-tax invoice amount to pay.</p>

                <div>
                  <label className="block font-bold text-amber-950 mb-1">Unbilled Amount (₹)</label>
                  <input type="text" inputMode="decimal" placeholder="0.00" value={unbilledNonGst} onChange={(e) => setUnbilledNonGst(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-amber-950 font-extrabold text-sm border-amber-300" />
                </div>
              </div>

              <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t-2 border-amber-200 pt-2">
                <span>Total Purchase Payable:</span>
                <span className="text-amber-900">₹{totalPayableAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Card C: Partial Payment & Pending Balance Owed */}
            <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-2.5 text-xs shadow-sm flex flex-col justify-between">
              <div>
                <span className="font-extrabold text-emerald-950 text-xs uppercase tracking-wider block flex items-center gap-1.5 mb-2">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  Payment & Balance
                </span>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Amount Paid (₹)</label>
                  <input type="text" inputMode="decimal" placeholder="0.00" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-emerald-800 font-extrabold text-sm border-emerald-300" />
                </div>
              </div>

              <div className="space-y-1 border-t-2 border-emerald-200 pt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pending Balance</span>
                <div className="flex items-center justify-between">
                  <span className={`text-base font-extrabold ${pendingBalanceOwed > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{pendingBalanceOwed.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                    pendingBalanceOwed <= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    {pendingBalanceOwed <= 0 ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createPurchaseMutation.isPending}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-all text-xs uppercase tracking-wider mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createPurchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{createPurchaseMutation.isPending ? 'Saving Purchase Invoice...' : 'Save Purchase Invoice'}</span>
          </button>
        </form>
      </Modal>

      {/* ── Edit Purchase Bill Modal ─────────────────────────────────────────── */}
      {editInvoice && (
        <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title={`Edit Purchase Bill — #${editInvoice.invoice_number}`}>
          <div className="space-y-4 text-xs">
            {editError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">{editError}</div>}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">⚠ Note: Stock levels and ledger entries are not changed. Only financial adjustment fields are editable.</span>
              <div className="grid grid-cols-2 gap-2 font-medium text-slate-600">
                <span>Supplier: <strong className="text-slate-900">{editInvoice.supplier?.name || '—'}</strong></span>
                <span>Date: <strong className="text-slate-900">{editInvoice.invoice_date}</strong></span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">LR / Bilty Charges (₹)</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editLr} onChange={(e) => setEditLr(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Local Freight (₹)</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editFreight} onChange={(e) => setEditFreight(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Salesman Expense (₹) −</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editSalesmanExp} onChange={(e) => setEditSalesmanExp(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Scheme Money (₹) −</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editScheme} onChange={(e) => setEditScheme(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Discount Deduction (₹) −</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-amber-800 block mb-1">Unbilled Non-GST (₹) +</label>
                <input type="text" inputMode="decimal" placeholder="0" value={editUnbilled} onChange={(e) => setEditUnbilled(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-amber-950 font-bold" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">Amount Paid (₹)</label>
              <input type="text" inputMode="decimal" placeholder="0" value={editAmountPaid} onChange={(e) => setEditAmountPaid(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-emerald-800 font-extrabold" />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="glass-input w-full p-2.5 rounded-xl resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditInvoice(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                type="button"
                disabled={editMutation.isPending}
                onClick={() => editMutation.mutate({ id: editInvoice.id, data: {
                  lr_charges:              parseFloat(editLr) || 0,
                  local_freight:           parseFloat(editFreight) || 0,
                  salesman_expense:        parseFloat(editSalesmanExp) || 0,
                  scheme_money:            parseFloat(editScheme) || 0,
                  discount_deduction:      parseFloat(editDiscount) || 0,
                  unbilled_nongst_amount:  parseFloat(editUnbilled) || 0,
                  amount_paid:             parseFloat(editAmountPaid) || 0,
                  notes: editNotes,
                }})}
                className="px-6 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {editMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{editMutation.isPending ? 'Saving...' : '✓ Save Changes'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Record Supplier Payment Modal ────────────────────────────────────── */}
      {payInvoice && (
        <Modal
          isOpen={!!payInvoice}
          onClose={() => setPayInvoice(null)}
          title={`Record Payment — Bill #${payInvoice.invoice_number}`}
        >
          {(() => {
            const bTotal = parseFloat(payInvoice.grand_total || 0);
            const unbilled = parseFloat(payInvoice.unbilled_nongst_amount || 0);
            const payable = parseFloat(payInvoice.total_payable_amount || bTotal + unbilled);
            const currentPaid = parseFloat(payInvoice.amount_paid || 0);
            const currentPending = parseFloat(payInvoice.pending_amount || Math.max(0, payable - currentPaid));
            const newPaymentNum = parseFloat(payAmount) || 0;
            const projectedPaid = currentPaid + newPaymentNum;
            const projectedPending = Math.max(0, payable - projectedPaid);

            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPaymentNum <= 0) {
                    setPayError('Please enter a valid payment amount greater than 0.');
                    return;
                  }
                  payMutation.mutate({
                    id: payInvoice.id,
                    data: {
                      amount: newPaymentNum,
                      payment_mode: payMode,
                      payment_date: payDate,
                      reference_number: payRef || null,
                      remarks: payRemarks || null,
                    }
                  });
                }}
                className="space-y-4 text-xs"
              >
                {payError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
                    {payError}
                  </div>
                )}

                {/* Bill Summary Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Supplier</span>
                    <span className="font-extrabold text-slate-900 text-sm">{payInvoice.supplier?.name || 'Vendor'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Total Payable Amount</span>
                    <span className="font-extrabold text-slate-900">₹{formatCurrency(payable)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Currently Paid</span>
                    <span className="font-bold text-emerald-700">₹{formatCurrency(currentPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                    <span className="font-bold text-slate-700">Current Outstanding Due</span>
                    <span className="font-extrabold text-rose-700 text-sm">₹{formatCurrency(currentPending)}</span>
                  </div>
                </div>

                {/* Quick Payment Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Quick Fill Presets</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(currentPending))}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-[11px] transition-all"
                    >
                      Full Balance: ₹{formatCurrency(currentPending)}
                    </button>
                    {currentPending > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(Math.round(currentPending / 2)))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-[11px] transition-all"
                        >
                          50%: ₹{formatCurrency(Math.round(currentPending / 2))}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(Math.round(currentPending / 4)))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-[11px] transition-all"
                        >
                          25%: ₹{formatCurrency(Math.round(currentPending / 4))}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount and Mode Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-extrabold text-slate-900 block mb-1">Payment Amount (₹) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl font-extrabold text-emerald-800 text-base border-emerald-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Payment Mode</label>
                    <select
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl bg-white font-bold"
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK / ONLINE</option>
                      <option value="UPI">UPI / GPAY / PHONEPE</option>
                      <option value="CHEQUE">CHEQUE</option>
                      <option value="NEFT">NEFT / RTGS</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ref / Cheque # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR123456"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className="glass-input w-full p-2.5 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Remarks (Optional)</label>
                  <textarea
                    placeholder="e.g. Part payment via HDFC Bank"
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                    rows={2}
                    className="glass-input w-full p-2.5 rounded-xl resize-none"
                  />
                </div>

                {/* Live Preview Box */}
                <div className="p-3.5 rounded-2xl bg-indigo-950 text-white space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">Balance Update Preview</span>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">New Total Paid:</span>
                    <span className="font-bold text-emerald-400">₹{formatCurrency(projectedPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-indigo-800 pt-1">
                    <span className="text-slate-300">Remaining Balance Due:</span>
                    <span className={`font-black ${projectedPending <= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {projectedPending <= 0 ? '✓ Fully Settled' : `₹${formatCurrency(projectedPending)}`}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayInvoice(null)}
                    className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={payMutation.isPending || newPaymentNum <= 0}
                    className="px-6 py-2.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {payMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    <span>{payMutation.isPending ? 'Recording...' : `Confirm Payment of ₹${formatCurrency(newPaymentNum)}`}</span>
                  </button>
                </div>
              </form>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

