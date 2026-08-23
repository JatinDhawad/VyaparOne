'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, PackageCheck, Layers, Tag, Pencil, Package, 
  History, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  DollarSign, BarChart3, FileText, CheckCircle2, ShoppingBag, ShoppingCart
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';
import { Skeleton, EmptyState } from '@/components/ui';

// ── Preset conversion ratios ──────────────────────────────────────────────────
const PACKET_PRESETS = [
  { label: 'Sweet Supari @5', ratio: 480 },
  { label: 'Sweet Supari @1', ratio: 300 },
  { label: 'Mouth Freshener @1', ratio: 240 },
  { label: 'Mouth Freshener @2', ratio: 360 },
];

export default function ProductsPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');

  // ── Create Product modal ──────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('PKT');
  const [purchasePrice, setPurchasePrice] = useState('2000.00');
  const [sellingPrice, setSellingPrice] = useState('5.00');
  const [gstRate, setGstRate] = useState('5.00');
  const [packetsPerBag, setPacketsPerBag] = useState('480');

  // ── Edit Product modal ────────────────────────────────────────────────────
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editError, setEditError] = useState('');
  const [editName, setEditName] = useState('');
  const [editHsn, setEditHsn] = useState('');
  const [editUnit, setEditUnit] = useState('PKT');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editGstRate, setEditGstRate] = useState('5.00');
  const [editPacketsPerBag, setEditPacketsPerBag] = useState('0');

  // ── Rate & Batch History modal ───────────────────────────────────────────
  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<any>(null);
  const [historyTab, setHistoryTab] = useState<'PURCHASES' | 'SALES'>('PURCHASES');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: products = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  });

  const { data: purchases = [], isLoading: isPurchasesLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

  const { data: sales = [], isLoading: isSalesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.getSales(),
  });

  // ── Helper to extract purchase and sales history for a product ─────────────
  const getProductInsights = (productId: string, ppb: number, avgLandedCost: number) => {
    const ratio = ppb > 0 ? ppb : 1;

    // 1. Inward Purchase Batches
    const inwardBatches: any[] = [];
    purchases.forEach((p: any) => {
      (p.items || []).forEach((it: any) => {
        if (it.product_id === productId) {
          const billedQty = parseFloat(it.billed_quantity || 0);
          const freeQty = parseFloat(it.free_quantity || 0);
          const totalBags = billedQty + freeQty;
          const ratePerBag = parseFloat(it.unit_purchase_price || 0);
          const ratePerPkt = ratio > 0 ? ratePerBag / ratio : ratePerBag;
          const totalPkts = totalBags * ratio;
          const lineTotal = parseFloat(it.line_total || 0);
          const effectiveCostPerPkt = totalPkts > 0 ? lineTotal / totalPkts : ratePerPkt;

          inwardBatches.push({
            invoice_id: p.id,
            invoice_number: p.invoice_number,
            date: p.invoice_date,
            supplier_name: p.supplier?.name || 'Vendor',
            billed_bags: billedQty,
            free_bags: freeQty,
            total_bags: totalBags,
            total_pkts: totalPkts,
            rate_per_bag: ratePerBag,
            rate_per_pkt: ratePerPkt,
            effective_cost_per_pkt: effectiveCostPerPkt,
            line_total: lineTotal,
          });
        }
      });
    });

    inwardBatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 2. Outward Sales
    const outwardSales: any[] = [];
    sales.forEach((s: any) => {
      (s.items || []).forEach((it: any) => {
        if (it.product_id === productId) {
          const qty = parseFloat(it.quantity || 0);
          const sellingRate = parseFloat(it.unit_selling_price || 0);
          const totalAmount = qty * sellingRate;
          const profitPerPkt = sellingRate - avgLandedCost;
          const totalProfit = profitPerPkt * qty;

          outwardSales.push({
            invoice_id: s.id,
            invoice_number: s.invoice_number,
            date: s.invoice_date,
            customer_name: s.customer?.name || 'Customer',
            location: s.location,
            quantity: qty,
            selling_rate: sellingRate,
            selling_rate_per_bag: ratio > 0 ? sellingRate * ratio : sellingRate,
            total_amount: totalAmount,
            profit_per_pkt: profitPerPkt,
            total_profit: totalProfit,
          });
        }
      });
    });

    outwardSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. Aggregate metrics
    const latestPurchase = inwardBatches[0] || null;
    const latestSale = outwardSales[0] || null;

    const purchaseRates = inwardBatches.map(b => b.rate_per_bag).filter(r => r > 0);
    const minPurchRate = purchaseRates.length > 0 ? Math.min(...purchaseRates) : 0;
    const maxPurchRate = purchaseRates.length > 0 ? Math.max(...purchaseRates) : 0;

    const sellingRates = outwardSales.map(s => s.selling_rate).filter(r => r > 0);
    const minSellRate = sellingRates.length > 0 ? Math.min(...sellingRates) : 0;
    const maxSellRate = sellingRates.length > 0 ? Math.max(...sellingRates) : 0;

    const totalPktsPurchased = inwardBatches.reduce((acc, b) => acc + b.total_pkts, 0);
    const totalCostPaid = inwardBatches.reduce((acc, b) => acc + b.line_total, 0);

    const totalPktsSold = outwardSales.reduce((acc, s) => acc + s.quantity, 0);
    const totalRevenue = outwardSales.reduce((acc, s) => acc + s.total_amount, 0);
    const totalRealizedProfit = outwardSales.reduce((acc, s) => acc + s.total_profit, 0);

    const avgSellingRate = totalPktsSold > 0 ? totalRevenue / totalPktsSold : (latestSale?.selling_rate || 0);
    const profitMarginPercent = avgSellingRate > 0 && avgLandedCost > 0 ? ((avgSellingRate - avgLandedCost) / avgSellingRate) * 100 : 0;

    return {
      inwardBatches,
      outwardSales,
      latestPurchase,
      latestSale,
      minPurchRate,
      maxPurchRate,
      minSellRate,
      maxSellRate,
      totalPktsPurchased,
      totalCostPaid,
      totalPktsSold,
      totalRevenue,
      totalRealizedProfit,
      avgSellingRate,
      profitMarginPercent,
    };
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
      toast.success(`Product "${name || res?.name || 'SKU'}" created successfully!`);
      resetCreate();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to create product';
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateProduct(id, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Product "${editProduct?.name || res?.name || 'Product'}" updated successfully!`);
      setEditProduct(null);
      setEditError('');
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to update product';
      setEditError(msg);
      toast.error(msg);
    },
  });

  const resetCreate = () => {
    setName('');
    setHsnCode('21069030');
    setUnit('PKT');
    setPurchasePrice('2000.00');
    setSellingPrice('5.00');
    setGstRate('5.00');
    setPacketsPerBag('480');
    setCreateError('');
  };

  const openEdit = (p: any) => {
    setEditProduct(p);
    setEditName(p.name);
    setEditHsn(p.hsn_code || '');
    setEditUnit(p.unit || 'PKT');
    setEditPurchasePrice(String(p.default_purchase_price ?? ''));
    setEditSellingPrice(String(p.default_selling_price ?? ''));
    setEditGstRate(String(p.gst_rate ?? '5.00'));
    setEditPacketsPerBag(String(p.packets_per_bag || 0));
    setEditError('');
  };

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.hsn_code && p.hsn_code.includes(searchTerm)) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Product Catalog & Inventory" />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product by name or HSN code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-input pl-10 pr-4 py-2.5 w-full text-xs rounded-2xl"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { resetCreate(); setIsCreateOpen(true); }}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                + Add Product SKU
              </button>
              <div className="px-3 py-2 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Total SKUs: <span className="font-extrabold text-slate-900">{products.length}</span>
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isProductsLoading ? (
              [...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-96 w-full rounded-3xl" />
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Package}
                  title="No Products Found"
                  description={searchTerm ? "No products matched your search keywords." : "Your catalog is empty. Record a purchase or create a new SKU."}
                  actionLabel="Add Product SKU"
                  onAction={() => { resetCreate(); setIsCreateOpen(true); }}
                />
              </div>
            ) : (
              filteredProducts.map((p: any) => {
                const currentStock = p.stock?.current_stock ?? 0;
                const ppb = p.packets_per_bag || 1;
                const currentBags = ppb > 1 ? (currentStock / ppb).toFixed(1) : null;
                const avgLandedCost = parseFloat(p.stock?.average_landed_cost || 0);
                const stockValuation = currentStock * avgLandedCost;

                const insights = getProductInsights(p.id, ppb, avgLandedCost);

                // Effective display rates
                const displayPurchRateBag = insights.latestPurchase?.rate_per_bag || parseFloat(p.default_purchase_price || 0);
                const displayPurchRatePkt = insights.latestPurchase?.rate_per_pkt || (ppb > 1 ? displayPurchRateBag / ppb : displayPurchRateBag);

                const displaySellRatePkt = insights.latestSale?.selling_rate || parseFloat(p.default_selling_price || 0);
                const displaySellRateBag = ppb > 1 ? displaySellRatePkt * ppb : displaySellRatePkt;

                return (
                  <div
                    key={p.id}
                    className="glass-card p-6 rounded-3xl space-y-4 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 border border-slate-200/80 bg-white flex flex-col justify-between"
                  >
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200/80">
                            <Tag className="h-3 w-3" />
                            HSN: {p.hsn_code || p.sku || 'N/A'}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-lg leading-snug mt-2 truncate">{p.name}</h3>
                          {ppb > 1 && (
                            <span className="inline-block text-[10px] font-extrabold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200 mt-1">
                              1 Bag = {ppb} PKT (Auto-Unpacked)
                            </span>
                          )}
                        </div>

                        {/* Current Available Stock Badge */}
                        <div className="text-right shrink-0">
                          <span className="flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs">
                            <PackageCheck className="h-4 w-4 text-emerald-600" />
                            {currentStock.toLocaleString()} {ppb > 1 ? 'PKT' : p.unit}
                          </span>
                          {currentBags && (
                            <span className="text-[10px] font-bold text-slate-500 block mt-1">
                              ({currentBags} Bags)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4 Dynamic Metric Boxes */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      {/* Box 1: Inward Purchase Rate */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Latest Inward Rate</span>
                        <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                          ₹{formatCurrency(displayPurchRateBag)} {ppb > 1 ? '/ Bag' : ''}
                        </div>
                        {ppb > 1 && (
                          <span className="text-[10px] font-semibold text-slate-500 block">
                            ≈ ₹{formatCurrency(displayPurchRatePkt)} / pkt
                          </span>
                        )}
                      </div>

                      {/* Box 2: Realized Selling Rate */}
                      <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                        <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Selling Rate</span>
                        <div className="font-extrabold text-emerald-900 text-sm mt-0.5">
                          ₹{formatCurrency(displaySellRatePkt)} / PKT
                        </div>
                        {ppb > 1 && (
                          <span className="text-[10px] font-semibold text-emerald-700 block">
                            ≈ ₹{formatCurrency(displaySellRateBag)} / Bag
                          </span>
                        )}
                      </div>

                      {/* Box 3: Real Avg Landed Cost */}
                      <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/80">
                        <span className="text-[10px] font-bold text-indigo-700 block uppercase tracking-wider">Avg Landed Cost</span>
                        <div className="font-extrabold text-indigo-900 text-sm mt-0.5">
                          ₹{formatCurrency(avgLandedCost)} / PKT
                        </div>
                        {ppb > 1 && (
                          <span className="text-[10px] font-semibold text-indigo-600 block">
                            ₹{formatCurrency(avgLandedCost * ppb)} / Bag
                          </span>
                        )}
                      </div>

                      {/* Box 4: Margin & Stock Value */}
                      <div className="p-3 rounded-2xl bg-violet-50/60 border border-violet-200/80">
                        <span className="text-[10px] font-bold text-violet-700 block uppercase tracking-wider">Live Margin</span>
                        <div className={`font-extrabold text-sm mt-0.5 ${insights.profitMarginPercent >= 0 ? 'text-violet-900' : 'text-rose-700'}`}>
                          {insights.profitMarginPercent >= 0 ? '+' : ''}{insights.profitMarginPercent.toFixed(1)}% Margin
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 block">
                          Val: ₹{formatCurrency(stockValuation)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setViewingHistoryProduct(p);
                          setHistoryTab('PURCHASES');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-2xs"
                        title="View Purchase Batches & Realized Sales Rates"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Rate & Batch History</span>
                      </button>

                      <button
                        onClick={() => openEdit(p)}
                        className="p-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors shadow-2xs shrink-0"
                        title="Edit Item Details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* ── Create Product Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Product Catalog Entry">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name, hsn_code: hsnCode, unit, packets_per_bag: parseInt(packetsPerBag) || 0, default_purchase_price: parseFloat(purchasePrice) || 0, default_selling_price: parseFloat(sellingPrice) || 0, gst_rate: parseFloat(gstRate) || 0 }); }} className="space-y-4">
          {createError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">{createError}</div>}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Product Description / Trade Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mouth Freshener @ 1" className="glass-input w-full p-2.5 rounded-xl text-xs" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">HSN / SAC Code</label>
              <input type="text" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="21069030" className="glass-input w-full p-2.5 rounded-xl text-xs font-mono" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Base Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs bg-white">
                <option value="PKT">PACKET (PKT)</option>
                <option value="BAG">BAG</option>
                <option value="BOX">BOX</option>
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Rate / Bag (₹)</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-emerald-700 block mb-1">Selling Rate / PKT (₹)</label>
              <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">GST Rate (%)</label>
              <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="glass-input w-full p-2.5 rounded-xl text-xs bg-white font-bold">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-violet-700 block mb-1">Packets per Bag Ratio</label>
            <div className="flex gap-2 mb-1">
              {PACKET_PRESETS.map((pr) => (
                <button key={pr.ratio} type="button" onClick={() => setPacketsPerBag(String(pr.ratio))}
                  className="px-2 py-1 text-[10px] font-bold bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg border border-violet-200 transition-colors">
                  {pr.label}: {pr.ratio}
                </button>
              ))}
            </div>
            <input type="number" value={packetsPerBag} onChange={(e) => setPacketsPerBag(e.target.value)} placeholder="e.g. 480" className="glass-input w-full p-2.5 rounded-xl text-xs" min="0" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">
              {createMutation.isPending ? 'Saving...' : 'Save Product SKU'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Product Modal ────────────────────────────────────────────────── */}
      {editProduct && (
        <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title={`Edit Stock Item — ${editProduct.name}`}>
          <form onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate({ id: editProduct.id, data: {
              name: editName, hsn_code: editHsn, unit: editUnit,
              packets_per_bag: parseInt(editPacketsPerBag) || 0,
              default_purchase_price: parseFloat(editPurchasePrice) || 0,
              default_selling_price: parseFloat(editSellingPrice) || 0,
              gst_rate: parseFloat(editGstRate) || 0,
            }});
          }} className="space-y-4 text-xs">
            {editError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">{editError}</div>}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">HSN Code</label>
                <input type="text" value={editHsn} onChange={(e) => setEditHsn(e.target.value)} className="glass-input w-full p-2.5 rounded-xl font-mono" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Base Unit</label>
                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="glass-input w-full p-2.5 rounded-xl bg-white">
                  <option value="PKT">PACKET (PKT)</option>
                  <option value="BAG">BAG</option>
                  <option value="BOX">BOX</option>
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Purchase Rate / Bag (₹)</label>
                <input type="number" step="0.01" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">Selling Rate / PKT (₹)</label>
                <input type="number" step="0.01" value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} className="glass-input w-full p-2.5 rounded-xl" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">GST Rate (%)</label>
                <select value={editGstRate} onChange={(e) => setEditGstRate(e.target.value)} className="glass-input w-full p-2.5 rounded-xl bg-white font-bold">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-bold text-violet-700 block mb-1">Packets per Bag</label>
              <div className="flex gap-2 mb-1.5">
                {PACKET_PRESETS.map((pr) => (
                  <button key={pr.ratio} type="button" onClick={() => setEditPacketsPerBag(String(pr.ratio))}
                    className="px-2 py-1 text-[10px] font-bold bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg border border-violet-200 transition-colors">
                    {pr.ratio}
                  </button>
                ))}
              </div>
              <input type="number" value={editPacketsPerBag} onChange={(e) => setEditPacketsPerBag(e.target.value)} className="glass-input w-full p-2.5 rounded-xl font-extrabold text-indigo-900" min="0" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditProduct(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={editMutation.isPending} className="px-4 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">
                {editMutation.isPending ? 'Updating...' : 'Update Details'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Rate & Batch History Modal ────────────────────────────────────────── */}
      {viewingHistoryProduct && (
        <Modal
          isOpen={!!viewingHistoryProduct}
          onClose={() => setViewingHistoryProduct(null)}
          title={`Rate & Batch Insights — ${viewingHistoryProduct.name}`}
          maxWidth="max-w-4xl"
        >
          {(() => {
            const ppb = viewingHistoryProduct.packets_per_bag || 1;
            const avgCost = parseFloat(viewingHistoryProduct.stock?.average_landed_cost || 0);
            const curStock = viewingHistoryProduct.stock?.current_stock ?? 0;
            const insights = getProductInsights(viewingHistoryProduct.id, ppb, avgCost);

            return (
              <div className="space-y-5 text-xs">
                {/* 1. Profile & Live Valuation Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-slate-900">{viewingHistoryProduct.name}</h4>
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        HSN: {viewingHistoryProduct.hsn_code || 'N/A'}
                      </span>
                      {ppb > 1 && (
                        <span className="text-[10px] font-extrabold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-200">
                          1 Bag = {ppb} PKT
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 font-medium text-[11px]">
                      Historical breakdown of all vendor purchase batches and customer sales invoices.
                    </p>
                  </div>

                  {/* Stock Valuation Badge */}
                  <div className="p-3 px-4 rounded-xl bg-white border border-slate-200 flex items-center gap-3 shrink-0">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Current Stock Valuation</span>
                      <span className="text-base font-black text-indigo-900">
                        ₹{formatCurrency(curStock * avgCost)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block">
                        ({curStock.toLocaleString()} PKT @ ₹{formatCurrency(avgCost)}/pkt)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Top Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Total Inward Qty</span>
                    <span className="text-sm font-black text-amber-950 mt-0.5 block">{insights.totalPktsPurchased.toLocaleString()} PKT</span>
                    {ppb > 1 && <span className="text-[10px] text-amber-700 font-medium">({(insights.totalPktsPurchased / ppb).toFixed(1)} Bags)</span>}
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Outward Sold</span>
                    <span className="text-sm font-black text-emerald-950 mt-0.5 block">{insights.totalPktsSold.toLocaleString()} PKT</span>
                    {ppb > 1 && <span className="text-[10px] text-emerald-700 font-medium">({(insights.totalPktsSold / ppb).toFixed(1)} Bags)</span>}
                  </div>

                  <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/70">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase block">Avg Landed Cost</span>
                    <span className="text-sm font-black text-indigo-950 mt-0.5 block">₹{formatCurrency(avgCost)} / PKT</span>
                    {ppb > 1 && <span className="text-[10px] text-indigo-600 font-medium">₹{formatCurrency(avgCost * ppb)} / Bag</span>}
                  </div>

                  <div className="p-3 rounded-2xl bg-violet-50/60 border border-violet-200/70">
                    <span className="text-[10px] font-bold text-violet-800 uppercase block">Total Profit Earned</span>
                    <span className="text-sm font-black text-violet-950 mt-0.5 block">₹{formatCurrency(insights.totalRealizedProfit)}</span>
                    <span className="text-[10px] text-violet-700 font-medium">Margin: {insights.profitMarginPercent.toFixed(1)}%</span>
                  </div>
                </div>

                {/* 3. Section Tabs */}
                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryTab('PURCHASES')}
                    className={`px-3 py-1.5 rounded-lg font-extrabold transition-all ${
                      historyTab === 'PURCHASES' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Inward Purchase Batches ({insights.inwardBatches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab('SALES')}
                    className={`px-3 py-1.5 rounded-lg font-extrabold transition-all ${
                      historyTab === 'SALES' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Outward Sales Invoices ({insights.outwardSales.length})
                  </button>
                </div>

                {/* 4. Tab Tables */}
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 max-h-[350px] overflow-y-auto">
                  {historyTab === 'PURCHASES' ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold sticky top-0 bg-slate-100">
                        <tr>
                          <th className="p-3">Bill #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3 text-right">Bags (Billed+Free)</th>
                          <th className="p-3 text-right">Total Packets</th>
                          <th className="p-3 text-right">Rate / Bag (₹)</th>
                          <th className="p-3 text-right">Landed Cost / PKT (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {insights.inwardBatches.length === 0 ? (
                          <tr><td colSpan={7} className="p-6 text-center text-slate-400">No purchase batches recorded yet for this product.</td></tr>
                        ) : (
                          insights.inwardBatches.map((b, idx) => (
                            <tr key={`${b.invoice_id}-${idx}`} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-amber-800">#{b.invoice_number}</td>
                              <td className="p-3 font-medium">{b.date}</td>
                              <td className="p-3 font-semibold text-slate-900">{b.supplier_name}</td>
                              <td className="p-3 text-right font-medium">{b.billed_bags} {b.free_bags > 0 ? `+ ${b.free_bags} free` : ''} ({b.total_bags} bags)</td>
                              <td className="p-3 text-right font-bold text-indigo-900">{b.total_pkts.toLocaleString()} PKT</td>
                              <td className="p-3 text-right font-bold text-slate-900">₹{formatCurrency(b.rate_per_bag)}</td>
                              <td className="p-3 text-right font-black text-indigo-700">₹{formatCurrency(b.effective_cost_per_pkt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold sticky top-0 bg-slate-100">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Location</th>
                          <th className="p-3 text-right">Quantity (PKT)</th>
                          <th className="p-3 text-right">Selling Rate / PKT (₹)</th>
                          <th className="p-3 text-right">Profit / PKT (₹)</th>
                          <th className="p-3 text-right">Total Profit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {insights.outwardSales.length === 0 ? (
                          <tr><td colSpan={8} className="p-6 text-center text-slate-400">No sales recorded yet for this product.</td></tr>
                        ) : (
                          insights.outwardSales.map((s, idx) => (
                            <tr key={`${s.invoice_id}-${idx}`} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-indigo-700">#{s.invoice_number}</td>
                              <td className="p-3 font-medium">{s.date}</td>
                              <td className="p-3 font-semibold text-slate-900">{s.customer_name}</td>
                              <td className="p-3 text-slate-500">{s.location || '—'}</td>
                              <td className="p-3 text-right font-bold text-slate-900">{s.quantity.toLocaleString()} PKT</td>
                              <td className="p-3 text-right font-bold text-emerald-800">₹{formatCurrency(s.selling_rate)}</td>
                              <td className={`p-3 text-right font-bold ${s.profit_per_pkt >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {s.profit_per_pkt >= 0 ? '+' : ''}₹{formatCurrency(s.profit_per_pkt)}
                              </td>
                              <td className={`p-3 text-right font-black ${s.total_profit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                                {s.total_profit >= 0 ? '+' : ''}₹{formatCurrency(s.total_profit)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setViewingHistoryProduct(null)}
                    className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
