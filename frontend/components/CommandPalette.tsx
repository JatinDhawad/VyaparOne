'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingBag, 
  ShoppingCart, 
  CreditCard, 
  Receipt, 
  BarChart3, 
  Plus, 
  ArrowRight, 
  Tag, 
  Building2, 
  UserCheck, 
  X,
  CornerDownLeft
} from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/sidebar-store';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Quick Actions' | 'Parties' | 'Products';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  onSelect: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const { isCommandOpen, closeCommand, toggleCommand } = useCommandPaletteStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Register global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      } else if (e.key === 'Escape' && isCommandOpen) {
        e.preventDefault();
        closeCommand();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommand, closeCommand, isCommandOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isCommandOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandOpen]);

  // Lightweight queries triggered only when palette is open
  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: () => api.getParties(),
    enabled: isCommandOpen,
    staleTime: 60000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
    enabled: isCommandOpen,
    staleTime: 60000,
  });

  const navigateTo = (href: string) => {
    closeCommand();
    router.push(href);
  };

  // Build and filter items
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: CommandItem[] = [];

    // 1. Navigation items
    const navs = [
      { id: 'nav-dashboard', title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, subtitle: 'Overview & metrics' },
      { id: 'nav-parties', title: 'Parties Directory', href: '/parties', icon: Users, subtitle: 'Customers & suppliers' },
      { id: 'nav-products', title: 'Product Catalog', href: '/products', icon: Package, subtitle: 'Inventory & pricing' },
      { id: 'nav-purchases', title: 'Purchase Bills', href: '/purchases', icon: ShoppingBag, subtitle: 'Inward bills & vendor ledger' },
      { id: 'nav-sales', title: 'Sales & POS Billing', href: '/sales', icon: ShoppingCart, subtitle: 'Outward billing & receipts' },
      { id: 'nav-payments', title: 'Payments & Receipts', href: '/payments', icon: CreditCard, subtitle: 'Financial settlement vouchers' },
      { id: 'nav-expenses', title: 'Operational Expenses', href: '/expenses', icon: Receipt, subtitle: 'Store & transport expense log' },
      { id: 'nav-reports', title: 'Financial Reports', href: '/reports', icon: BarChart3, subtitle: 'Ledger statements & GST tax summary' },
    ];

    navs.forEach(n => {
      if (!q || n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)) {
        result.push({
          id: n.id,
          category: 'Navigation',
          title: n.title,
          subtitle: n.subtitle,
          icon: n.icon,
          iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-100',
          onSelect: () => navigateTo(n.href),
        });
      }
    });

    // 2. Quick Actions
    const actions = [
      { id: 'act-sale', title: 'New Sales Invoice (POS)', href: '/sales', icon: Plus, subtitle: 'Create new customer sales bill' },
      { id: 'act-purchase', title: 'New Purchase Entry', href: '/purchases', icon: Plus, subtitle: 'Record supplier inward purchase' },
      { id: 'act-party', title: 'Create New Party', href: '/parties', icon: Plus, subtitle: 'Add new customer or supplier' },
      { id: 'act-product', title: 'Add Product SKU', href: '/products', icon: Plus, subtitle: 'Create inventory product item' },
      { id: 'act-expense', title: 'Record Expense', href: '/expenses', icon: Plus, subtitle: 'Log store maintenance or operational cost' },
      { id: 'act-voucher', title: 'New Payment Voucher', href: '/payments', icon: Plus, subtitle: 'Record receipt or payment' },
    ];

    actions.forEach(a => {
      if (!q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) {
        result.push({
          id: a.id,
          category: 'Quick Actions',
          title: a.title,
          subtitle: a.subtitle,
          icon: a.icon,
          iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
          onSelect: () => navigateTo(a.href),
        });
      }
    });

    // 3. Parties (Capped at top 5)
    let matchedParties = 0;
    for (const p of parties) {
      if (matchedParties >= 5) break;
      const match = !q || 
        p.name?.toLowerCase().includes(q) || 
        p.city?.toLowerCase().includes(q) || 
        p.phone?.toLowerCase().includes(q) || 
        p.gstin?.toLowerCase().includes(q);

      if (match) {
        matchedParties++;
        const balance = parseFloat(p.ledger_balance || 0);
        result.push({
          id: `party-${p.id}`,
          category: 'Parties',
          title: p.name,
          subtitle: `${p.city ? `${p.city} • ` : ''}${p.phone || 'No phone'}`,
          badge: p.party_type,
          icon: p.party_type === 'SUPPLIER' ? Building2 : UserCheck,
          iconColor: p.party_type === 'SUPPLIER' ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100',
          onSelect: () => navigateTo('/parties'),
        });
      }
    }

    // 4. Products (Capped at top 5)
    let matchedProducts = 0;
    for (const prod of products) {
      if (matchedProducts >= 5) break;
      const match = !q || 
        prod.name?.toLowerCase().includes(q) || 
        prod.hsn_code?.toLowerCase().includes(q) || 
        prod.unit?.toLowerCase().includes(q);

      if (match) {
        matchedProducts++;
        const stock = prod.stock?.current_stock ?? 0;
        const ppb = prod.packets_per_bag || 1;
        result.push({
          id: `product-${prod.id}`,
          category: 'Products',
          title: prod.name,
          subtitle: `HSN: ${prod.hsn_code || 'N/A'} • Available: ${stock.toLocaleString()} ${prod.unit}`,
          badge: ppb > 1 ? `1 Bag = ${ppb} PKT` : prod.unit,
          icon: Tag,
          iconColor: 'text-violet-700 bg-violet-50 border-violet-100',
          onSelect: () => navigateTo('/products'),
        });
      }
    }

    return result;
  }, [query, parties, products]);

  // Adjust selectedIndex bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Keyboard navigation within the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + (items.length || 1)) % (items.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].onSelect();
      }
    }
  };

  if (!isCommandOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
          <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, page, party, or product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-0 outline-hidden text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-0 p-0"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-500 border border-slate-200 rounded-md shadow-2xs">
              ESC
            </kbd>
            <button
              onClick={closeCommand}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
              aria-label="Close command palette"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-slate-50"
        >
          {items.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <p className="text-sm font-bold text-slate-700">No results found</p>
              <p className="text-xs text-slate-400">No pages, parties, or products match &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            (() => {
              let runningIndex = -1;
              const categories = ['Navigation', 'Quick Actions', 'Parties', 'Products'] as const;

              return categories.map((cat) => {
                const catItems = items.filter(it => it.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat} className="pt-2 first:pt-0 space-y-0.5">
                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {cat}
                    </div>

                    {catItems.map((item) => {
                      runningIndex++;
                      const isSelected = runningIndex === selectedIndex;
                      const itemIdx = runningIndex;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.id}
                          onClick={item.onSelect}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 border',
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-200/80 text-indigo-950 shadow-2xs'
                              : 'border-transparent hover:bg-slate-50 text-slate-700'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs', item.iconColor || 'bg-slate-100 text-slate-600 border-slate-200')}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn('text-xs font-bold truncate', isSelected ? 'text-indigo-950 font-extrabold' : 'text-slate-900')}>
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-lg border border-indigo-200">
                                Jump <CornerDownLeft className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">↵</kbd> Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">ESC</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
