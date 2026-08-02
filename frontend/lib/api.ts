const PRIMARY_API_URL = 'https://vyaparone-backend.onrender.com/api/v1';

let rawApiUrl = process.env.NEXT_PUBLIC_API_URL || PRIMARY_API_URL;

if (typeof window !== 'undefined' && (rawApiUrl.includes('127.0.0.1') || rawApiUrl.includes('localhost'))) {
  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    rawApiUrl = PRIMARY_API_URL;
  }
}

rawApiUrl = rawApiUrl.trim().replace(/\/+$/, '');
if (!rawApiUrl.includes('/api/v1')) {
  rawApiUrl = `${rawApiUrl}/api/v1`;
}
const API_BASE_URL = rawApiUrl;

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}, retries = 1): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vyaparone_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrls = [API_BASE_URL];

  let lastError: any = null;

  for (const baseUrl of baseUrls) {
    const fullUrl = `${baseUrl}${formattedEndpoint}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(fullUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || (data && typeof data.detail === 'string' && (data.detail.includes('User not found') || data.detail.includes('session expired')))) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('vyaparone_token');
            localStorage.removeItem('vyaparone_user');
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        }

        if (!response.ok) {
          const errorMsg = data.detail || 'An error occurred while communicating with the server.';
          throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        }

        return data as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        const isNetworkError = err.message === 'Failed to fetch' || err instanceof TypeError || err.name === 'AbortError';

        if (isNetworkError && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
      }
    }
  }

  if (lastError) {
    if (lastError.name === 'AbortError') {
      throw new Error('Cloud server response timed out. Please try again in a moment.');
    }
    if (lastError.message === 'Failed to fetch' || lastError instanceof TypeError) {
      throw new Error('Cloud server is warming up or unreachable. Please try again in a moment.');
    }
    throw lastError;
  }

  throw new Error('Unable to connect to backend server.');
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
  updateParty: (id: string, data: any) => fetchAPI<any>(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
