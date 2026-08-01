'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Phone, Mail, MapPin } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [partyType, setPartyType] = useState('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [creditDays, setCreditDays] = useState('30');
  const [formError, setFormError] = useState('');

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ['parties', filterType],
    queryFn: () => api.getParties(filterType),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createParty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create party.');
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
    setCreditDays('30');
    setFormError('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      party_type: partyType,
      phone: phone || null,
      email: email || null,
      gstin: gstin || null,
      city: city || null,
      state: state || null,
      credit_limit: 0,
      credit_days: parseInt(creditDays) || 30,
    });
  };

  const filteredParties = parties.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Parties Directory" 
          subtitle="Suppliers & Customers database with auto-ledger account linkage" 
          onActionClick={isAdmin ? () => setIsModalOpen(true) : undefined}
          actionLabel="Add New Party"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Controls Bar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search parties by name or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-semibold text-slate-500">Filter Type:</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {['', 'CUSTOMER', 'SUPPLIER', 'BOTH'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      filterType === type 
                        ? 'bg-indigo-600 text-white shadow-sm' 
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">Loading parties...</div>
            ) : filteredParties.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">No parties found matching criteria.</div>
            ) : (
              filteredParties.map((party: any) => (
                <div key={party.id} className="glass-card p-5 rounded-2xl space-y-4 border-slate-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{party.name}</h3>
                      <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded mt-1 border ${
                        party.party_type === 'SUPPLIER' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : party.party_type === 'CUSTOMER'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {party.party_type}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Payment Terms</span>
                      <span className="text-xs font-bold text-slate-800">{party.credit_days || 30} Days</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    {party.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{party.phone}</span>
                      </div>
                    )}
                    {party.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{party.email}</span>
                      </div>
                    )}
                    {party.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{party.city}{party.state ? `, ${party.state}` : ''}</span>
                      </div>
                    )}
                    {party.gstin && (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                        <span>GSTIN:</span>
                        <span className="text-slate-900 font-bold">{party.gstin}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Add Party Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Party">
        {formError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{formError}</div>}
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Party Name *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Traders" className="w-full glass-input p-2.5 rounded-xl" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Party Type *</label>
              <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className="w-full glass-input p-2.5 rounded-xl bg-white">
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="SUPPLIER">SUPPLIER</option>
                <option value="BOTH">BOTH (Supplier & Customer)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="w-full glass-input p-2.5 rounded-xl" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" className="w-full glass-input p-2.5 rounded-xl font-mono uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Indore" className="w-full glass-input p-2.5 rounded-xl" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Credit Terms (Days)</label>
              <input type="number" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} placeholder="30" className="w-full glass-input p-2.5 rounded-xl" />
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Party & Link Ledger'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
