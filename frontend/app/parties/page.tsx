'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, Phone, Mail, MapPin, Pencil, Users, Building2, UserCheck, 
  Plus, ShoppingCart, Receipt, FileText, ExternalLink, Calendar, 
  DollarSign, Eye, ArrowUpRight, CheckCircle2, Clock, Loader2 
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton, EmptyState, Badge } from '@/components/ui';

export default function PartiesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.name === 'ADMIN' || user?.role_id === 1;

  const [filterType, setFilterType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
  const [viewingParty, setViewingParty] = useState<any>(null);
  const [partyTab, setPartyTab] = useState<'SALES' | 'PURCHASES'>('SALES');
  const [formError, setFormError] = useState('');

  // Form State for Create & Edit
  const [name, setName] = useState('');
  const [partyType, setPartyType] = useState('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ['parties', filterType],
    queryFn: () => api.getParties(filterType),
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.getSales(),
  });

  const { data: allPurchases = [] } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.getPurchases(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createParty(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsCreateModalOpen(false);
      toast.success(`Party "${name || res?.name || 'New Party'}" created successfully!`);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to create party.';
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateParty(id, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsEditModalOpen(false);
      toast.success(`Party "${editingParty?.name || res?.name || 'Party'}" updated successfully!`);
      setEditingParty(null);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.message || 'Failed to update party details.';
      setFormError(msg);
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setName('');
    setPartyType('CUSTOMER');
    setPhone('');
    setEmail('');
    setGstin('');
    setCity('');
    setState('');
    setFormError('');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (party: any) => {
    setEditingParty(party);
    setName(party.name || '');
    setPartyType(party.party_type || 'CUSTOMER');
    setPhone(party.phone || '');
    setEmail(party.email || '');
    setGstin(party.gstin || '');
    setCity(party.city || '');
    setState(party.state || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      party_type: partyType,
      phone: phone || null,
      email: email || null,
      gstin: gstin || null,
      city: city || null,
      state: state || null,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;

    updateMutation.mutate({
      id: editingParty.id,
      data: {
        name,
        party_type: partyType,
        phone: phone || null,
        email: email || null,
        gstin: gstin || null,
        city: city || null,
        state: state || null,
      },
    });
  };

  const filteredParties = parties.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  // Statistics
  const customerCount = parties.filter((p: any) => p.party_type === 'CUSTOMER' || p.party_type === 'BOTH').length;
  const supplierCount = parties.filter((p: any) => p.party_type === 'SUPPLIER' || p.party_type === 'BOTH').length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Parties Directory" 
          onActionClick={isAdmin ? handleOpenCreateModal : undefined}
          actionLabel="Add New Party"
        />

        <main className="p-4 sm:p-8 space-y-6 sm:space-y-8 flex-1 overflow-y-auto">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="section-label">Total Directory</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-28 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {parties.length} <span className="text-sm font-normal text-slate-500">Parties</span>
                  </h3>
                )}
                <p className="text-xs font-normal text-slate-500 mt-1">Active trading accounts</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="section-label">Customers (Buyers)</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-28 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {customerCount} <span className="text-sm font-normal text-slate-500">Accounts</span>
                  </h3>
                )}
                <p className="text-xs font-normal text-slate-500 mt-1">Sales tax invoice buyers</p>
              </div>
            </div>

            <div className="glass-card p-5 rounded-xl border-slate-200 bg-white flex flex-col justify-between min-h-[125px]">
              <span className="section-label">Suppliers (Vendors)</span>
              <div className="mt-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-28 rounded-md" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {supplierCount} <span className="text-sm font-normal text-slate-500">Vendors</span>
                  </h3>
                )}
                <p className="text-xs font-normal text-slate-500 mt-1">Inbound stock manufacturers</p>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-panel p-4 sm:p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-200">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search parties by name, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2 rounded-lg text-xs font-normal"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
              <span className="section-label">Filter Type:</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto max-w-full">
                {['', 'CUSTOMER', 'SUPPLIER', 'BOTH'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                      filterType === type 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === '' ? 'ALL' : type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Party List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-3xl" />
              ))
            ) : filteredParties.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Users}
                  title="No Parties Found"
                  description={searchTerm ? "No trading parties matched your search keyword." : "Your party directory is currently empty."}
                  actionLabel={isAdmin ? "Create New Party" : undefined}
                  onAction={isAdmin ? handleOpenCreateModal : undefined}
                />
              </div>
            ) : (

              filteredParties.map((party: any) => {
                const balance = parseFloat(party.ledger_balance || 0);
                const isSupplier = party.party_type === 'SUPPLIER';
                const isCustomer = party.party_type === 'CUSTOMER';
                const isBoth = party.party_type === 'BOTH';
                const isCleared = Math.abs(balance) < 0.01;

                const partySales = allSales.filter((s: any) => s.customer_id === party.id);
                const partyPurchases = allPurchases.filter((p: any) => p.supplier_id === party.id);
                const billsCount = (isCustomer ? partySales.length : isSupplier ? partyPurchases.length : partySales.length + partyPurchases.length);

                return (
                  <div
                    key={party.id}
                    onClick={() => {
                      setViewingParty(party);
                      setPartyTab(isSupplier ? 'PURCHASES' : 'SALES');
                    }}
                    className="glass-card p-6 rounded-3xl space-y-4 border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer group bg-white"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-lg leading-snug group-hover:text-indigo-600 transition-colors">
                              {party.name}
                            </h3>
                            <ArrowUpRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="mt-1.5">
                            <Badge
                              variant={party.party_type === 'SUPPLIER' ? 'warning' : party.party_type === 'CUSTOMER' ? 'success' : 'info'}
                              size="sm"
                            >
                              {party.party_type}
                            </Badge>
                          </div>
                        </div>

                        {/* Top Right Action Pill */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setViewingParty(party);
                              setPartyTab(isSupplier ? 'PURCHASES' : 'SALES');
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all flex items-center gap-1 shadow-2xs"
                            title="View all bills for this party"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>{billsCount} Bills</span>
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEditModal(party)}
                              className="p-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all flex items-center shadow-2xs"
                              title="Edit Party Details"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                        {party.phone && (
                          <div className="flex items-center gap-2.5">
                            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800">{party.phone}</span>
                          </div>
                        )}
                        {party.email && (
                          <div className="flex items-center gap-2.5">
                            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{party.email}</span>
                          </div>
                        )}
                        {party.city && (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">{party.city}{party.state ? `, ${party.state}` : ''}</span>
                          </div>
                        )}
                        {party.gstin && (
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pt-1">
                            <span className="font-bold">GSTIN:</span>
                            <span className="text-slate-900 font-extrabold uppercase">{party.gstin}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Outstanding Balance Badge */}
                    <div className={`mt-1 p-3.5 rounded-2xl border flex items-center justify-between ${
                      isCleared
                        ? 'bg-slate-50 border-slate-200'
                        : isSupplier
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                          isCleared ? 'text-slate-400' : isSupplier ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          {isCleared ? 'All Settled' : isSupplier ? 'To Pay' : 'To Collect'}
                        </span>
                        <span className={`text-base font-black mt-0.5 ${
                          isCleared ? 'text-slate-400' : isSupplier ? 'text-rose-800' : 'text-emerald-900'
                        }`}>
                          {isCleared ? '✓ No Dues' : `₹${Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        </span>
                      </div>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm ${
                        isCleared ? 'bg-slate-100' : isSupplier ? 'bg-rose-100' : 'bg-emerald-100'
                      }`}>
                        {isCleared ? '✓' : isSupplier ? '↑' : '↓'}
                      </div>
                    </div>

                    {/* Quick Billing Action Row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(isCustomer || isBoth) && (
                        <Link
                          href={`/sales?customerId=${party.id}&location=${encodeURIComponent(party.city ? (party.state ? `${party.city}, ${party.state}` : party.city) : '')}&openModal=true`}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5"
                          title="Open POS billing for this customer"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          <span>Generate Sale</span>
                        </Link>
                      )}
                      {(isSupplier || isBoth) && (
                        <Link
                          href={`/purchases?supplierId=${party.id}&openModal=true`}
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-1.5"
                          title="Open Purchase Entry for this supplier"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Purchase Bill</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })

            )}
          </div>
        </main>
      </div>

      {/* Add Party Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Register New Party" maxWidth="max-w-2xl">
        {formError && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold mb-4">{formError}</div>}
        <form onSubmit={handleCreateSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Party Name *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Traders" className="w-full glass-input p-3 rounded-2xl font-semibold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Party Type *</label>
              <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white font-bold">
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="SUPPLIER">SUPPLIER</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Phone Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" className="w-full glass-input p-3 rounded-2xl font-mono uppercase font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@example.com" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Indore" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">State</label>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="Madhya Pradesh" className="w-full glass-input p-3 rounded-2xl font-medium" />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-all text-xs uppercase tracking-wider mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{createMutation.isPending ? 'Saving Party...' : 'Save Party'}</span>
          </button>
        </form>
      </Modal>

      {/* Edit Party Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Party: ${editingParty?.name || ''}`} maxWidth="max-w-2xl">
        {formError && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold mb-4">{formError}</div>}
        <form onSubmit={handleEditSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Party Name *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Traders" className="w-full glass-input p-3 rounded-2xl font-semibold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Party Type *</label>
              <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className="w-full glass-input p-3 rounded-2xl bg-white font-bold">
                <option value="CUSTOMER">CUSTOMER (Buyer)</option>
                <option value="SUPPLIER">SUPPLIER (Vendor)</option>
                <option value="BOTH">BOTH (Supplier & Customer)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Phone Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" className="w-full glass-input p-3 rounded-2xl font-mono uppercase font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@example.com" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Indore" className="w-full glass-input p-3 rounded-2xl font-medium" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">State</label>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="Madhya Pradesh" className="w-full glass-input p-3 rounded-2xl font-medium" />
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-all text-xs uppercase tracking-wider mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{updateMutation.isPending ? 'Updating...' : 'Update Party Details'}</span>
          </button>
        </form>
      </Modal>

      {/* ── Party Invoices & Statement Modal ───────────────────────────────── */}
      {viewingParty && (
        <Modal
          isOpen={!!viewingParty}
          onClose={() => setViewingParty(null)}
          title={`Invoices & History — ${viewingParty.name}`}
          maxWidth="max-w-4xl"
        >
          {(() => {
            const isCust = viewingParty.party_type === 'CUSTOMER';
            const isSupp = viewingParty.party_type === 'SUPPLIER';
            const isBoth = viewingParty.party_type === 'BOTH';
            const curSales = allSales.filter((s: any) => s.customer_id === viewingParty.id);
            const curPurchases = allPurchases.filter((p: any) => p.supplier_id === viewingParty.id);

            const totalSalesBilled = curSales.reduce((acc: number, s: any) => acc + parseFloat(s.grand_total || 0), 0);
            const totalSalesPaid   = curSales.reduce((acc: number, s: any) => acc + parseFloat(s.amount_paid || 0), 0);
            const totalSalesPending = curSales.reduce((acc: number, s: any) => acc + parseFloat(s.pending_amount || 0), 0);

            const totalPurchBilled = curPurchases.reduce((acc: number, p: any) => acc + parseFloat(p.total_payable_amount || p.grand_total || 0), 0);
            const totalPurchPaid   = curPurchases.reduce((acc: number, p: any) => acc + parseFloat(p.amount_paid || 0), 0);
            const totalPurchPending = curPurchases.reduce((acc: number, p: any) => acc + parseFloat(p.pending_amount || 0), 0);

            const balance = parseFloat(viewingParty.ledger_balance || 0);
            const isCleared = Math.abs(balance) < 0.01;

            return (
              <div className="space-y-5 text-xs">
                {/* 1. Header Profile & Balance Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-slate-900">{viewingParty.name}</h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border ${
                        isSupp ? 'bg-amber-50 text-amber-800 border-amber-200' : isCust ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {viewingParty.party_type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 font-medium text-[11px]">
                      {viewingParty.phone && <span>📞 {viewingParty.phone}</span>}
                      {viewingParty.city && <span>📍 {viewingParty.city}{viewingParty.state ? `, ${viewingParty.state}` : ''}</span>}
                      {viewingParty.gstin && <span className="font-mono">GSTIN: {viewingParty.gstin}</span>}
                    </div>
                  </div>

                  {/* Balance Badge */}
                  <div className={`p-3 px-4 rounded-xl border flex items-center gap-3 shrink-0 ${
                    isCleared ? 'bg-white border-slate-200' : isSupp ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                        {isCleared ? 'Balance Status' : isSupp ? 'To Pay (Vendor Balance)' : 'To Collect (Customer Balance)'}
                      </span>
                      <span className="text-base font-black">
                        {isCleared ? '✓ All Settled' : `₹${Math.abs(balance).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Quick Billing Actions inside modal */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Tab Selector if BOTH */}
                  {isBoth ? (
                    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPartyTab('SALES')}
                        className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all ${
                          partyTab === 'SALES' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sales Invoices ({curSales.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartyTab('PURCHASES')}
                        className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all ${
                          partyTab === 'PURCHASES' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Purchase Bills ({curPurchases.length})
                      </button>
                    </div>
                  ) : (
                    <span className="font-extrabold text-slate-800 text-sm">
                      {isCust ? `Sales Invoices (${curSales.length})` : `Purchase Bills (${curPurchases.length})`}
                    </span>
                  )}

                  {/* Create New Bill Button */}
                  <div className="flex items-center gap-2">
                    {(isCust || (isBoth && partyTab === 'SALES')) && (
                      <Link
                        href={`/sales?customerId=${viewingParty.id}&location=${encodeURIComponent(viewingParty.city ? (viewingParty.state ? `${viewingParty.city}, ${viewingParty.state}` : viewingParty.city) : '')}&openModal=true`}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>+ New Sale for {viewingParty.name}</span>
                      </Link>
                    )}
                    {(isSupp || (isBoth && partyTab === 'PURCHASES')) && (
                      <Link
                        href={`/purchases?supplierId=${viewingParty.id}&openModal=true`}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>+ New Purchase from {viewingParty.name}</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* 3. Summary Cards for this Party */}
                {(partyTab === 'SALES' || isCust) && !isSupp ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block">Total Sales Billed</span>
                      <span className="text-base font-black text-indigo-900">₹{formatCurrency(totalSalesBilled)}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Received</span>
                      <span className="text-base font-black text-emerald-900">₹{formatCurrency(totalSalesPaid)}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-100">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Pending Balance</span>
                      <span className={`text-base font-black ${totalSalesPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ₹{formatCurrency(totalSalesPending)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block">Total Purchases</span>
                      <span className="text-base font-black text-indigo-900">₹{formatCurrency(totalPurchBilled)}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Amount Paid</span>
                      <span className="text-base font-black text-emerald-900">₹{formatCurrency(totalPurchPaid)}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-100">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Pending Balance</span>
                      <span className={`text-base font-black ${totalPurchPending > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ₹{formatCurrency(totalPurchPending)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Table of Invoices */}
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 max-h-[350px] overflow-y-auto">
                  {(partyTab === 'SALES' || isCust) && !isSupp ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold sticky top-0 bg-slate-100">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Location</th>
                          <th className="p-3 text-right">Grand Total (₹)</th>
                          <th className="p-3 text-right">Paid (₹)</th>
                          <th className="p-3 text-right">Pending (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {curSales.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-slate-400">No sales invoices found for this customer.</td></tr>
                        ) : (
                          curSales.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-indigo-700">#{s.invoice_number}</td>
                              <td className="p-3 font-medium">{s.invoice_date}</td>
                              <td className="p-3 text-slate-500">{s.location || '—'}</td>
                              <td className="p-3 text-right font-bold text-slate-900">₹{formatCurrency(s.grand_total)}</td>
                              <td className="p-3 text-right text-emerald-700 font-semibold">₹{formatCurrency(s.amount_paid)}</td>
                              <td className={`p-3 text-right font-bold ${s.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                ₹{formatCurrency(s.pending_amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold sticky top-0 bg-slate-100">
                        <tr>
                          <th className="p-3">Bill #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Billed (₹)</th>
                          <th className="p-3 text-right">Unbilled (₹)</th>
                          <th className="p-3 text-right">Total Payable (₹)</th>
                          <th className="p-3 text-right">Paid (₹)</th>
                          <th className="p-3 text-right">Pending (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {curPurchases.length === 0 ? (
                          <tr><td colSpan={7} className="p-6 text-center text-slate-400">No purchase bills found from this supplier.</td></tr>
                        ) : (
                          curPurchases.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-amber-800">#{p.invoice_number}</td>
                              <td className="p-3 font-medium">{p.invoice_date}</td>
                              <td className="p-3 text-right font-medium text-slate-900">₹{formatCurrency(p.grand_total)}</td>
                              <td className="p-3 text-right text-slate-500">₹{formatCurrency(p.unbilled_nongst_amount)}</td>
                              <td className="p-3 text-right font-bold text-slate-900">₹{formatCurrency(p.total_payable_amount || p.grand_total)}</td>
                              <td className="p-3 text-right text-emerald-700 font-semibold">₹{formatCurrency(p.amount_paid)}</td>
                              <td className={`p-3 text-right font-bold ${p.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                ₹{formatCurrency(p.pending_amount)}
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
                    onClick={() => setViewingParty(null)}
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

