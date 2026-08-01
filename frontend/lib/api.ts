const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8088/api/v1';

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vyaparone_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vyaparone_token');
      localStorage.removeItem('vyaparone_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || 'An error occurred while communicating with the server.';
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: any) => fetchAPI<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => fetchAPI<any>('/users/me'),
  getUsers: () => fetchAPI<any>('/users/'),
  createUser: (data: any) => fetchAPI<any>('/users/', { method: 'POST', body: JSON.stringify(data) }),

  // Master Data
  getCompanies: () => fetchAPI<any[]>('/companies/'),
  createCompany: (data: any) => fetchAPI<any>('/companies/', { method: 'POST', body: JSON.stringify(data) }),
  getCategories: () => fetchAPI<any[]>('/categories/'),
  createCategory: (data: any) => fetchAPI<any>('/categories/', { method: 'POST', body: JSON.stringify(data) }),
  getProducts: (params?: string) => fetchAPI<any[]>(`/products/${params ? `?${params}` : ''}`),
  createProduct: (data: any) => fetchAPI<any>('/products/', { method: 'POST', body: JSON.stringify(data) }),
  getProductStock: (id: string) => fetchAPI<any>(`/products/${id}/stock`),

  // Parties
  getParties: (type?: string) => fetchAPI<any[]>(`/parties/${type ? `?party_type=${type}` : ''}`),
  createParty: (data: any) => fetchAPI<any>('/parties/', { method: 'POST', body: JSON.stringify(data) }),
  deleteParty: (id: string) => fetchAPI<any>(`/parties/${id}`, { method: 'DELETE' }),

  // Ledger Accounts
  getLedgerAccounts: () => fetchAPI<any[]>('/ledger/accounts/'),
  createLedgerAccount: (data: any) => fetchAPI<any>('/ledger/accounts/', { method: 'POST', body: JSON.stringify(data) }),

  // Transactions
  getPurchases: () => fetchAPI<any[]>('/purchases/'),
  createPurchase: (data: any) => fetchAPI<any>('/purchases/', { method: 'POST', body: JSON.stringify(data) }),
  getSales: () => fetchAPI<any[]>('/sales/'),
  createSale: (data: any) => fetchAPI<any>('/sales/', { method: 'POST', body: JSON.stringify(data) }),
  getPayments: () => fetchAPI<any[]>('/payments/'),
  createPayment: (data: any) => fetchAPI<any>('/payments/', { method: 'POST', body: JSON.stringify(data) }),
  getExpenses: () => fetchAPI<any[]>('/expenses/'),
  createExpense: (data: any) => fetchAPI<any>('/expenses/', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getLedgerStatement: (accountId: string, startDate?: string, endDate?: string) => {
    let q = '';
    if (startDate) q += `start_date=${startDate}&`;
    if (endDate) q += `end_date=${endDate}`;
    return fetchAPI<any>(`/reports/ledger/${accountId}${q ? `?${q}` : ''}`);
  },
  getReceivables: () => fetchAPI<any>('/reports/receivables'),
  getPayables: () => fetchAPI<any>('/reports/payables'),
  getPartyProfitability: () => fetchAPI<any>('/reports/profitability/parties'),
  getProductProfitability: () => fetchAPI<any>('/reports/profitability/products'),
  getGSTSummary: () => fetchAPI<any>('/reports/gst-summary'),
  getDashboardSummary: () => fetchAPI<any>('/reports/dashboard-summary'),
};
