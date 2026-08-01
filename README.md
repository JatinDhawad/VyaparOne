# VyaparOne ERP (Trading Management System)

Production-grade Enterprise Resource Planning system specifically engineered for FMCG wholesale distribution, trading economics, landed cost calculation, and double-entry financial ledger accounting.

---

## 🏗️ Architecture & Technology Stack

- **Backend**: FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 Async ORM, PostgreSQL (Supabase), Alembic.
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query.
- **Security**: JWT Authentication, Argon2/Bcrypt password hashing, Role-Based Access Control (RBAC).
- **Financial Architecture**: Double-entry bookkeeping system, proportional landed cost allocation engine, real-time sales gross/net profit tracking, dual GST / Cash billing mode support.

---

## 📁 Repository Structure

```
VyaparOne/
├── backend/            # FastAPI Python REST API & Service Layer
│   ├── app/
│   │   ├── api/        # REST API Routes (v1)
│   │   ├── core/       # Configurations, DB Session, Security
│   │   ├── models/     # SQLAlchemy 2.0 Database Models
│   │   ├── schemas/    # Pydantic Schemas & Data DTOs
│   │   └── services/   # Business Logic Engines (Landed Cost, Ledgers, Margins)
│   ├── alembic/        # Database Migration Scripts
│   ├── requirements.txt
│   └── .env.example
├── frontend/           # Next.js 14 Web Application
└── README.md
```

---

## 🚀 Key Functional Modules

1. **Party & Company Directory**: Suppliers, Customers, Credit Limits & Credit Days.
2. **Product Catalog**: Brands, Categories, HSN Codes, GST Tax Brackets, Units.
3. **Purchase Management**: Bill Entry, Vendor Schemes, Free Goods Handling, Inbound Freight & Godown Expenses Allocation (Landed Cost Engine).
4. **Sales Management**: Tax Invoice vs Cash Challan Billing, Flat Salesman Commission, Automated Line Profit & Invoice Net Profit Calculation.
5. **Double-Entry Ledgers**: Supplier Ledger, Customer Ledger, Cash & Bank Accounts, Operational Expense Accounts.
6. **Reports & Analytics**: Party Profitability, Top Selling FMCG Goods, Overdue Accounts Receivable / Payable, GST Returns Summary.
