'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Phone, Mail, MapPin, Pencil, Users, Building2, UserCheck, Plus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function PartiesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.name === 'ADMIN' || user?.role_id === 1;

  const [filterType, setFilterType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
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

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createParty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create party.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateParty(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsEditModalOpen(false);
      setEditingParty(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update party details.');
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

        <main className="p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-indigo-100 glow-indigo">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">Total Directory</span>
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isLoading ? '...' : parties.length} <span className="text-sm font-bold text-slate-500">Parties</span>
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Active trading accounts</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-emerald-100 glow-emerald">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Customers (Buyers)</span>
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <UserCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-emerald-800 tracking-tight">
                  {isLoading ? '...' : customerCount} <span className="text-sm font-bold text-slate-500 font-medium">Accounts</span>
                </h3>
                <p className="text-xs font-semibold text-emerald-700/80 mt-1">Sales tax invoice buyers</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl relative overflow-hidden border-amber-100 glow-amber">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Suppliers (Vendors)</span>
                <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold text-amber-800 tracking-tight">
                  {isLoading ? '...' : supplierCount} <span className="text-sm font-bold text-slate-500 font-medium">Vendors</span>
                </h3>
                <p className="text-xs font-semibold text-amber-700/80 mt-1">Inbound stock manufacturers</p>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-200">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search parties by name, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-11 pr-4 py-2.5 rounded-2xl text-xs font-medium"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-extrabold text-slate-600">Filter Type:</span>
              <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {['', 'CUSTOMER', 'SUPPLIER', 'BOTH'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
                      filterType === type 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
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
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">Loading parties directory...</div>
            ) : filteredParties.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 text-sm">No parties found matching criteria.</div>
            ) : (
              filteredParties.map((party: any) => {
                const balance = parseFloat(party.ledger_balance || 0);
                const isSupplier = party.party_type === 'SUPPLIER';
                const isCustomer = party.party_type === 'CUSTOMER';
                const isBoth = party.party_type === 'BOTH';

                // For customers: positive balance = they owe us (to collect)
                // For suppliers: positive balance = we owe them (to pay) — backend stores as positive too
                const isCleared = Math.abs(balance) < 0.01;

                return (
                  <div key={party.id} className="glass-card p-6 rounded-3xl space-y-4 border-slate-200 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-lg leading-snug">{party.name}</h3>
                          <span className={`inline-block text-[11px] font-extrabold uppercase px-3 py-1 rounded-xl mt-1.5 border ${
                            party.party_type === 'SUPPLIER' 
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : party.party_type === 'CUSTOMER'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {party.party_type}
                          </span>
                        </div>

                        {/* Edit Button */}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(party)}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 shadow-xs shrink-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
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
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all text-xs uppercase tracking-wider mt-4"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Party'}
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
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all text-xs uppercase tracking-wider mt-4"
          >
            {updateMutation.isPending ? 'Updating...' : 'Update Party Details'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
