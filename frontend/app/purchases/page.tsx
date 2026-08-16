'use client';

import { useState } from 'react';
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
  Tag
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Main Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Itemized Expenses & Deductions
  const [lrCharges, setLrCharges] = useState('0.00');
  const [localFreight, setLocalFreight] = useState('0.00');
  const [salesmanExpense, setSalesmanExpense] = useState('0.00');
  const [schemeMoney, setSchemeMoney] = useState('0.00');
  const [discountDeduction, setDiscountDeduction] = useState('0.00');

  // Unbilled & Payment Given
  const [unbilledNonGst, setUnbilledNonGst] = useState('0.00');
  const [amountPaid, setAmountPaid] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Item Add State
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productName, setProductName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('BAG');
  const [billedQty, setBilledQty] = useState('5');
  const [unitPrice, setUnitPrice] = useState('4800.00');
  const [gstRate, setGstRate] = useState('5.00');

  // Items Array
  const [items, setItems] = useState<any[]>([]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

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
      setSuccessMessage(`Purchase invoice #${invoiceNumber || res.invoice_number} saved successfully.`);
      setTimeout(() => setSuccessMessage(''), 6000);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record purchase bill.');
    },
  });

  // Edit purchase bill fields only (no stock re-processing)
  const [editLr, setEditLr]                   = useState('0');
  const [editFreight, setEditFreight]         = useState('0');
  const [editSalesmanExp, setEditSalesmanExp] = useState('0');
  const [editScheme, setEditScheme]           = useState('0');
  const [editDiscount, setEditDiscount]       = useState('0');
  const [editUnbilled, setEditUnbilled]       = useState('0');
  const [editAmountPaid, setEditAmountPaid]   = useState('0');
  const [editNotes, setEditNotes]             = useState('');

  const openEditInvoice = (inv: any) => {
    setEditInvoice(inv);
    setEditLr(String(inv.lr_charges || 0));
    setEditFreight(String(inv.local_freight || 0));
    setEditSalesmanExp(String(inv.salesman_expense || 0));
    setEditScheme(String(inv.scheme_money || 0));
    setEditDiscount(String(inv.discount_deduction || 0));
    setEditUnbilled(String(inv.unbilled_nongst_amount || 0));
    setEditAmountPaid(String(inv.amount_paid || 0));
    setEditNotes(inv.notes || '');
    setEditError('');
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.editPurchase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setEditInvoice(null);
      setSuccessMessage('Purchase bill updated successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update purchase bill.'),
  });

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setLrCharges('0.00');
    setLocalFreight('0.00');
    setSalesmanExpense('0.00');
    setSchemeMoney('0.00');
    setDiscountDeduction('0.00');
    setUnbilledNonGst('0.00');
    setAmountPaid('0.00');
    setNotes('');
    setItems([]);
    setSelectedProduct('');
    setProductName('');
    setHsnCode('');
    setUnit('BAG');
    setBilledQty('5');
    setUnitPrice('4800.00');
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

  // Filtered List
  const filteredPurchases = purchases.filter((p: any) =>
    (p.invoice_number && p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold shadow-sm flex items-center gap-3 animate-in fade-in duration-300">
              <PackageCheck className="h-6 w-6 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-indigo-100 glow-indigo">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">Total Billed Purchases</span>
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  ₹{isLoading ? '...' : formatCurrency(totalBilledPurchases)}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Official GST Vendor Invoices</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Total Invoices</span>
                <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isLoading ? '...' : purchases.length} <span className="text-sm font-bold text-slate-500">Invoices</span>
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Purchases Record</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-rose-200 bg-gradient-to-br from-rose-50/40 to-white glow-amber">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">Pending Amount</span>
                <div className="h-11 w-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-sm">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-rose-800 tracking-tight">
                  ₹{isLoading ? '...' : formatCurrency(totalPendingOwed)}
                </h3>
                <p className="text-xs font-semibold text-rose-700/80 mt-1">Outstanding Supplier Payable</p>
              </div>
            </div>
          </div>

          {/* Table Panel */}
          <div className="glass-panel p-6 rounded-3xl space-y-6 border border-slate-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Invoice Number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full glass-input pl-11 pr-4 py-2.5 rounded-2xl text-xs font-medium"
                />
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Purchase Entry
              </button>
            </div>

            {/* Purchase List Table */}
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-extrabold tracking-wider">
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
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500 text-sm">Loading purchase bills...</td></tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500 text-sm">No purchase invoices found.</td></tr>
                  ) : (
                    filteredPurchases.map((p: any) => {
                      const bTotal = parseFloat(p.grand_total || 0);
                      const unbilled = parseFloat(p.unbilled_nongst_amount || 0);
                      const payable = parseFloat(p.total_payable_amount || bTotal + unbilled);
                      const paid = parseFloat(p.amount_paid || 0);
                      const pending = parseFloat(p.pending_amount || payable - paid);
                      const supplierName = p.supplier?.name || 'Vendor';

                      return (
                        <tr 
                          key={p.id} 
                          className="hover:bg-indigo-50/40 transition-colors"
                        >
                          <td className="p-4 font-mono font-extrabold text-indigo-700 text-sm">{p.invoice_number}</td>
                          <td className="p-4 font-medium text-slate-600">{p.invoice_date}</td>
                          <td className="p-4 font-bold text-slate-900">{supplierName}</td>
                          <td className="p-4 text-right font-extrabold text-indigo-950 text-sm">₹{formatCurrency(bTotal)}</td>
                          <td className="p-4 text-right text-amber-800 font-bold">₹{formatCurrency(unbilled)}</td>
                          <td className="p-4 text-right font-extrabold text-slate-900">₹{formatCurrency(payable)}</td>
                          <td className="p-4 text-right text-emerald-700 font-extrabold">₹{formatCurrency(paid)}</td>
                          <td className="p-4 text-right">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${
                              pending <= 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {pending <= 0 ? 'Paid' : `₹${formatCurrency(pending)}`}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
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
                  <input type="number" placeholder="5" value={billedQty} onChange={(e) => setBilledQty(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs" />
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
                <input type="number" step="0.01" placeholder="4800.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full glass-input p-3 rounded-2xl font-extrabold text-xs text-slate-900" />
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
                  <input type="number" step="0.01" value={lrCharges} onChange={(e) => setLrCharges(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-indigo-900" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Local Freight:</span>
                  <input type="number" step="0.01" value={localFreight} onChange={(e) => setLocalFreight(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-indigo-900" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Salesman Expense:</span>
                  <input type="number" step="0.01" value={salesmanExpense} onChange={(e) => setSalesmanExpense(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Scheme Money:</span>
                  <input type="number" step="0.01" value={schemeMoney} onChange={(e) => setSchemeMoney(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Discount Deduction (-):</span>
                  <input type="number" step="0.01" value={discountDeduction} onChange={(e) => setDiscountDeduction(e.target.value)} className="w-24 glass-input p-1 rounded-lg text-right font-bold text-xs text-emerald-700" />
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
                  <input type="number" step="0.01" value={unbilledNonGst} onChange={(e) => setUnbilledNonGst(e.target.value)} className="w-full glass-input p-2.5 rounded-xl text-amber-950 font-extrabold text-sm border-amber-300" />
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
                  <input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" className="w-full glass-input p-2.5 rounded-xl text-emerald-800 font-extrabold text-sm border-emerald-300" />
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
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/25 transition-all text-sm uppercase tracking-wider mt-4"
          >
            {createPurchaseMutation.isPending ? 'Saving Purchase Invoice...' : 'Save Purchase Invoice'}
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
                <input type="number" step="0.01" value={editLr} onChange={(e) => setEditLr(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Local Freight (₹)</label>
                <input type="number" step="0.01" value={editFreight} onChange={(e) => setEditFreight(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Salesman Expense (₹) −</label>
                <input type="number" step="0.01" value={editSalesmanExp} onChange={(e) => setEditSalesmanExp(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Scheme Money (₹) −</label>
                <input type="number" step="0.01" value={editScheme} onChange={(e) => setEditScheme(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Discount Deduction (₹) −</label>
                <input type="number" step="0.01" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
              <div>
                <label className="font-bold text-amber-700 block mb-1">Unbilled Non-GST Amount (₹)</label>
                <input type="number" step="0.01" value={editUnbilled} onChange={(e) => setEditUnbilled(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" min="0" />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">Amount Paid (₹)</label>
              <input type="number" step="0.01" value={editAmountPaid} onChange={(e) => setEditAmountPaid(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-emerald-800 font-extrabold" min="0" />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="glass-input w-full p-2.5 rounded-xl resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditInvoice(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
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
                className="px-6 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-60"
              >
                {editMutation.isPending ? 'Saving...' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
