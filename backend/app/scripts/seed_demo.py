"""
VyaparOne demo data seeder.

Populates an EMPTY / demo database with realistic but entirely fictional FMCG
distribution data (brands, products, suppliers, Indore retailers, purchase bills
with freight, sales invoices, receipts, supplier payments, expenses).

All data is written through the app's own REST API so that ledgers, stock and
landed cost stay consistent with what the UI would produce.

Two modes
---------
1. In-process (default): talks to the FastAPI app directly via httpx's ASGI
   transport, using whatever DATABASE_URL is in the environment. Tables, roles and
   the admin user are created first (same as app startup), and the script
   authenticates as the admin by minting a token with the app's SECRET_KEY, so no
   password is needed beyond ADMIN_SEED_PASSWORD for a brand-new database.

       cd backend
       SECRET_KEY=... ADMIN_SEED_PASSWORD=... \
       DATABASE_URL=sqlite+aiosqlite:///./vyaparone_demo.db \
       python -m app.scripts.seed_demo

   A non-SQLite DATABASE_URL is refused unless --allow-non-sqlite is passed
   (guard against accidentally seeding a production database).

2. Against a running server:

       DEMO_ADMIN_EMAIL=admin@vyaparone.com DEMO_ADMIN_PASSWORD=... \
       python -m app.scripts.seed_demo --api-url http://localhost:8000

   Non-localhost URLs are refused unless --allow-remote is passed.

Optional: set DEMO_OWNER_PASSWORD to also create a BUSINESS_OWNER login
(owner@example.com). The script is idempotent-ish: masters are get-or-create by
name, transactions are keyed by invoice / voucher numbers and skipped if present.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
from datetime import date, timedelta
from urllib.parse import urlparse

import httpx

TODAY = date.today()


def d(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


# ── Fictional master data ─────────────────────────────────────────────────────

COMPANIES = [
    {"name": "Saffron Leaf Spices", "code": "SLS", "contact_person": "Rakesh Bhandari", "phone": "9800000101"},
    {"name": "Kesar Valley Supari", "code": "KVS", "contact_person": "Imran Qureshi", "phone": "9800000102"},
    {"name": "Malwa Gold Namkeen", "code": "MGN", "contact_person": "Sunil Agrawal", "phone": "9800000103"},
    {"name": "Narmada Fresh Beverages", "code": "NFB", "contact_person": "Pooja Dubey", "phone": "9800000104"},
]

CATEGORIES = [
    {"name": "Spices & Masala", "description": "Ground spices and blended masalas"},
    {"name": "Supari & Mukhwas", "description": "Sweet supari, mukhwas and mouth fresheners"},
    {"name": "Namkeen & Snacks", "description": "Sev, bhujia, mixtures"},
    {"name": "Beverages", "description": "Ready-to-drink beverages and packaged water"},
]

# key, name, company code, category, hsn, gst, unit, packets_per_bag, purchase (ex-GST, per unit bought), selling (GST-incl, per stock unit), min alert
PRODUCTS = [
    ("GM100", "Saffron Leaf Garam Masala 100g (Box of 10)", "SLS", "Spices & Masala", "09109100", 5, "BOX", 0, 420, 495, 10),
    ("HL200", "Saffron Leaf Haldi Powder 200g (Box of 20)", "SLS", "Spices & Masala", "09103020", 5, "BOX", 0, 640, 745, 8),
    ("KC100", "Saffron Leaf Kashmiri Chilli 100g (Box of 10)", "SLS", "Spices & Masala", "09042211", 5, "BOX", 0, 380, 445, 10),
    ("KK050", "Saffron Leaf Kitchen King 50g (Box of 20)", "SLS", "Spices & Masala", "09109100", 5, "BOX", 0, 560, 655, 6),
    ("SS001", "Kesar Sweet Supari @1", "KVS", "Supari & Mukhwas", "21069099", 18, "BAG", 100, 72, 0.92, 1000),
    ("EM005", "Kesar Elaichi Mukhwas @5", "KVS", "Supari & Mukhwas", "21069099", 18, "BAG", 24, 85, 4.60, 200),
    ("RG400", "Kesar Valley Rose Gulkand 400g", "KVS", "Supari & Mukhwas", "20079990", 12, "PCS", 0, 118, 145, 12),
    ("RS400", "Malwa Gold Ratlami Sev 400g", "MGN", "Namkeen & Snacks", "21069099", 12, "PKT", 0, 62, 76, 40),
    ("AB200", "Malwa Gold Aloo Bhujia 200g", "MGN", "Namkeen & Snacks", "21069099", 12, "PKT", 0, 34, 42, 60),
    ("KM200", "Malwa Gold Khatta Meetha 200g", "MGN", "Namkeen & Snacks", "21069099", 12, "PKT", 0, 33, 41, 60),
    ("IM1KG", "Malwa Gold Indori Mixture 1kg", "MGN", "Namkeen & Snacks", "21069099", 12, "PKT", 0, 128, 155, 20),
    ("JJ250", "Narmada Jaljeera 250ml (Crate of 24)", "NFB", "Beverages", "22029920", 12, "BOX", 0, 240, 290, 10),
    ("MD200", "Narmada Mango Drink 200ml (Crate of 30)", "NFB", "Beverages", "22029920", 12, "BOX", 0, 270, 325, 10),
    ("PW1L", "Narmada Packaged Water 1L (Case of 12)", "NFB", "Beverages", "22011010", 18, "BOX", 0, 92, 118, 25),
    ("NS250", "Narmada Nimbu Shikanji 250ml (Crate of 24)", "NFB", "Beverages", "22029920", 12, "BOX", 0, 230, 278, 10),
]

SUPPLIERS = [
    {"key": "SLS", "name": "Saffron Leaf Spices Pvt. Ltd.", "gstin": "23AAKCS1001A1Z1", "phone": "9800000201",
     "address": "Plot 14, Sector F, Sanwer Road Industrial Area", "city": "Indore", "credit_days": 30},
    {"key": "KVS", "name": "Kesar Valley Foods LLP", "gstin": "23AAKFK1002B1Z2", "phone": "9800000202",
     "address": "22, Transport Nagar", "city": "Ujjain", "credit_days": 21},
    {"key": "MGN", "name": "Malwa Gold Snacks Pvt. Ltd.", "gstin": "23AAKCM1003C1Z3", "phone": "9800000203",
     "address": "Industrial Estate, Pithampur Sector 3", "city": "Dhar", "credit_days": 15},
    {"key": "NFB", "name": "Narmada Fresh Beverages", "gstin": "23AAKFN1004D1Z4", "phone": "9800000204",
     "address": "Khandwa Road, Near Bypass", "city": "Indore", "credit_days": 30},
]

CUSTOMERS = [
    ("Shree Ganesh Kirana Store", "Rajwada", 15, 40000),
    ("Mahakal General Store", "Vijay Nagar", 7, 25000),
    ("Annapurna Provision Centre", "Annapurna Road", 15, 30000),
    ("Sai Krupa Traders", "Palasia", 21, 60000),
    ("Jain Brothers Supermart", "Sapna Sangeeta", 30, 80000),
    ("Om Sai Pan Bhandar", "Bhawarkuan", 7, 15000),
    ("Nidhi Kirana & Dairy", "Rau", 10, 20000),
    ("Patel Wholesale Mart", "Siyaganj", 21, 75000),
    ("Gupta Daily Needs", "MR-10 Road", 15, 30000),
    ("Shubh Laxmi Stores", "Bengali Square", 10, 25000),
]

# Purchase bills: (invoice no, supplier key, days ago, items[(product key, billed, free)], lr, local freight, scheme, unbilled, paid at bill)
PURCHASES = [
    ("SLS/26-27/0418", "SLS", 29, [("GM100", 80, 8), ("HL200", 60, 0), ("KC100", 80, 4), ("KK050", 50, 0)], 1650, 600, 0, 0, 0),
    ("KVF-2231", "KVS", 27, [("SS001", 150, 10), ("EM005", 100, 5), ("RG400", 120, 0)], 2200, 800, 0, 4500, 4500),
    ("MGS/1187", "MGN", 26, [("RS400", 400, 16), ("AB200", 600, 24), ("KM200", 600, 24), ("IM1KG", 160, 0)], 1200, 0, 2500, 0, 10000),
    ("NFB-INV-0962", "NFB", 25, [("JJ250", 120, 0), ("MD200", 100, 4), ("PW1L", 240, 0), ("NS250", 100, 0)], 2600, 900, 0, 0, 20000),
    ("SLS/26-27/0533", "SLS", 11, [("GM100", 50, 5), ("KK050", 30, 0), ("HL200", 30, 0)], 900, 300, 0, 0, 0),
]

EXPENSES = [
    ("Godown Rent", 9000, "BANK", 28, "Sharma Properties", "Monthly godown rent - Loha Mandi"),
    ("Staff Salary", 9500, "BANK", 27, "Godown helper", "Monthly salary"),
    ("Vehicle Fuel", 3200, "CASH", 22, "HP Pump, Ring Road", "Delivery van diesel"),
    ("Electricity", 2150, "UPI", 18, "MPEB", "Godown electricity bill"),
    ("Vehicle Fuel", 2900, "CASH", 9, "HP Pump, Ring Road", "Delivery van diesel"),
    ("Tea & Refreshments", 640, "CASH", 4, "Local tea stall", "Staff tea"),
]


class Seeder:
    def __init__(self, client: httpx.AsyncClient):
        self.c = client
        self.company_ids: dict[str, int] = {}
        self.category_ids: dict[str, int] = {}
        self.products: dict[str, dict] = {}
        self.suppliers: dict[str, dict] = {}
        self.customers: list[dict] = []
        self.created = {"companies": 0, "categories": 0, "products": 0, "parties": 0, "purchases": 0,
                        "sales": 0, "collections": 0, "supplier_payments": 0, "expenses": 0, "users": 0}

    async def req(self, method: str, path: str, **kw):
        r = await self.c.request(method, f"/api/v1{path}", **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:400]}")
        return r.json() if r.content else None

    async def masters(self):
        existing = {c["name"]: c for c in await self.req("GET", "/companies/")}
        for comp in COMPANIES:
            if comp["name"] not in existing:
                existing[comp["name"]] = await self.req("POST", "/companies/", json=comp)
                self.created["companies"] += 1
            self.company_ids[comp["code"]] = existing[comp["name"]]["id"]

        existing = {c["name"]: c for c in await self.req("GET", "/categories/")}
        for cat in CATEGORIES:
            if cat["name"] not in existing:
                existing[cat["name"]] = await self.req("POST", "/categories/", json=cat)
                self.created["categories"] += 1
            self.category_ids[cat["name"]] = existing[cat["name"]]["id"]

        existing = {p["name"]: p for p in await self.req("GET", "/products/?limit=500")}
        for key, name, comp, cat, hsn, gst, unit, ppb, pp, sp, alert in PRODUCTS:
            if name not in existing:
                existing[name] = await self.req("POST", "/products/", json={
                    "name": name, "hsn_code": hsn, "sku": f"{comp}-{key}",
                    "company_id": self.company_ids[comp], "category_id": self.category_ids[cat],
                    "gst_rate": gst, "unit": unit, "packets_per_bag": ppb,
                    "default_purchase_price": pp, "default_selling_price": sp, "min_stock_alert": alert,
                })
                self.created["products"] += 1
            self.products[key] = {**existing[name], "_pp": pp, "_sp": sp, "_gst": gst, "_ppb": ppb}

        existing = {p["name"]: p for p in await self.req("GET", "/parties/?active_only=false&limit=500")}
        for s in SUPPLIERS:
            if s["name"] not in existing:
                body = {k: v for k, v in s.items() if k != "key"}
                body.update(party_type="SUPPLIER", state="Madhya Pradesh", email=None)
                existing[s["name"]] = await self.req("POST", "/parties/", json=body)
                self.created["parties"] += 1
            self.suppliers[s["key"]] = existing[s["name"]]
        for i, (name, area, days, limit) in enumerate(CUSTOMERS):
            if name not in existing:
                existing[name] = await self.req("POST", "/parties/", json={
                    "name": name, "party_type": "CUSTOMER",
                    "gstin": f"23AB{'CDEFGHIJKL'[i]}PS{4100 + i}{'MNPQRSTUVW'[i]}1Z{i}" if i % 3 != 2 else None,
                    "phone": f"98270{10100 + i * 37:05d}", "address": f"{area}, Indore",
                    "city": "Indore", "state": "Madhya Pradesh", "credit_limit": limit, "credit_days": days,
                })
                self.created["parties"] += 1
            self.customers.append({**existing[name], "_area": area})

    async def purchases(self):
        existing = {(p["supplier_id"], p["invoice_number"]): p for p in await self.req("GET", "/purchases/?limit=500")}
        self.purchase_ids = {}
        for inv_no, skey, ago, items, lr, lf, scheme, unbilled, paid in PURCHASES:
            sup = self.suppliers[skey]
            k = (sup["id"], inv_no)
            if k not in existing:
                existing[k] = await self.req("POST", "/purchases/", json={
                    "invoice_number": inv_no, "supplier_id": sup["id"], "invoice_date": d(ago),
                    "billing_mode": "TAX_INVOICE", "lr_charges": lr, "local_freight": lf,
                    "scheme_money": scheme, "unbilled_nongst_amount": unbilled, "amount_paid": paid,
                    "notes": "Transport: Malwa Roadlines" if lr else None,
                    "items": [{
                        "product_id": self.products[pk]["id"], "billed_quantity": bq, "free_quantity": fq,
                        "unit_purchase_price": self.products[pk]["_pp"], "gst_rate": self.products[pk]["_gst"],
                    } for pk, bq, fq in items],
                })
                self.created["purchases"] += 1
            self.purchase_ids[inv_no] = existing[k]["id"]

    async def supplier_payments(self):
        # Voucher-style payments, tracked by a marker in remarks so reruns don't double pay.
        pays = await self.req("GET", "/payments/?payment_type=PAYMENT&limit=500")
        done_text = " | ".join(p.get("remarks") or "" for p in pays)
        plan = [
            ("SLS/26-27/0418", 100000, "NEFT", 18, "UTR-DEMO-88213"),
            ("KVF-2231", 35633.20, "UPI", 15, "UPI-DEMO-55120"),
            ("MGS/1187", 60000, "BANK", 12, "IMPS-DEMO-31877"),
            ("NFB-INV-0962", 70000, "CHEQUE", 9, "CHQ-004417"),
        ]
        for inv_no, amt, mode, ago, ref in plan:
            marker = f"[demo] Part payment against #{inv_no}"
            if marker in done_text:
                continue
            await self.req("POST", f"/purchases/{self.purchase_ids[inv_no]}/pay", json={
                "amount": amt, "payment_mode": mode, "payment_date": d(ago),
                "reference_number": ref, "remarks": marker,
            })
            self.created["supplier_payments"] += 1

    async def sales(self):
        existing = {s["invoice_number"]: s for s in await self.req("GET", "/sales/?limit=500")}
        rng = random.Random(20261107)
        # Track stock locally so we never oversell
        prods = await self.req("GET", "/products/?limit=500")
        stock = {p["id"]: float((p.get("stock") or {}).get("current_stock") or 0) for p in prods}
        keys = list(self.products.keys())
        days = sorted(rng.sample(range(1, 25), 20), reverse=True)
        self.sales_made = []
        for n, ago in enumerate(days, start=1):
            inv_no = f"VO/{TODAY.year % 100}-{TODAY.year % 100 + 1}/{n:04d}"
            if inv_no in existing:
                self.sales_made.append(existing[inv_no])
                continue
            cust = self.customers[(n * 3) % len(self.customers)]  # every retailer gets bills
            lines, gross = [], 0.0
            for pk in rng.sample(keys, rng.randint(3, 6)):
                p = self.products[pk]
                avail = stock.get(p["id"], 0)
                if p["_ppb"] > 1:
                    qty = rng.choice([1500, 2000, 2500, 3000, 4000]) if p["_ppb"] >= 100 else rng.choice([144, 192, 240, 288])
                elif p["unit"] == "PKT":
                    qty = rng.choice([36, 48, 60, 72, 96])
                else:
                    qty = rng.choice([4, 5, 6, 8, 10, 12])
                if qty > avail * 0.5:
                    continue
                stock[p["id"]] = avail - qty
                lines.append({"product_id": p["id"], "quantity": qty, "unit_selling_price": p["_sp"], "gst_rate": p["_gst"]})
                gross += qty * p["_sp"]
            if not lines:
                continue
            gross = round(gross, 2)
            tax_invoice = rng.random() < 0.6
            r = rng.random()
            if not tax_invoice:
                # cash challan: mostly paid on the spot, sometimes part-paid
                paid = gross if r < 0.7 else round(gross * 0.5 / 100) * 100
                mode = "CASH"
            elif r < 0.3:
                paid, mode = gross, rng.choice(["UPI", "BANK"])
            elif r < 0.65:
                paid, mode = round(gross * rng.choice([0.3, 0.4, 0.5]) / 100) * 100, rng.choice(["CASH", "UPI"])
            else:
                paid, mode = 0, "CASH"              # on credit
            lr = rng.choice([0, 0, 0, 150, 200])
            inv = await self.req("POST", "/sales/", json={
                "invoice_number": inv_no, "customer_id": cust["id"], "invoice_date": d(ago),
                "billing_mode": "TAX_INVOICE" if tax_invoice else "CASH_CHALLAN",
                "location": cust["_area"],
                "gst_billed_amount": gross if tax_invoice else 0,
                "without_gst_amount": 0 if tax_invoice else gross,
                "lr_charges": lr, "amount_paid": min(paid, gross - lr), "payment_mode": mode,
                "notes": None, "items": lines,
            })
            self.created["sales"] += 1
            self.sales_made.append(inv)

    async def collections(self):
        # Later collections against older credit bills (updates pending + ledger via PATCH).
        older = [s for s in self.sales_made if float(s["pending_amount"]) > 0
                 and (TODAY - date.fromisoformat(s["invoice_date"])).days > 12]
        for s in older[::2][:4]:
            if s.get("notes") and "[demo-collected]" in s["notes"]:
                continue
            new_paid = round(float(s["amount_paid"]) + float(s["pending_amount"]) * 0.6, 0)
            await self.req("PATCH", f"/sales/{s['id']}", json={
                "amount_paid": new_paid, "payment_mode": "UPI",
                "notes": "[demo-collected] Part collection by salesman",
            })
            self.created["collections"] += 1

    async def expenses(self):
        existing = {(e["category"], e["expense_date"], float(e["amount"])) for e in await self.req("GET", "/expenses/?limit=500")}
        for cat, amt, mode, ago, to, rem in EXPENSES:
            if (cat, d(ago), float(amt)) in existing:
                continue
            await self.req("POST", "/expenses/", json={
                "category": cat, "amount": amt, "payment_mode": mode, "expense_date": d(ago),
                "paid_to": to, "remarks": rem,
            })
            self.created["expenses"] += 1

    async def owner_user(self, owner_role_id: int | None):
        pw = os.environ.get("DEMO_OWNER_PASSWORD", "").strip()
        if not pw:
            return
        users = await self.req("GET", "/users/")
        if any(u["email"] == "owner@example.com" for u in users):
            return
        await self.req("POST", "/users/", json={
            "email": "owner@example.com", "full_name": "Ravi Malviya (Owner)", "phone": "9800000999",
            "password": pw, "role_id": owner_role_id or 2,
        })
        self.created["users"] += 1

    async def run(self, owner_role_id=None):
        await self.masters()
        await self.purchases()
        await self.supplier_payments()
        await self.sales()
        await self.collections()
        await self.expenses()
        await self.owner_user(owner_role_id)
        print("Demo seed complete. Created:", ", ".join(f"{k}={v}" for k, v in self.created.items()))


async def run_in_process(allow_non_sqlite: bool):
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./vyaparone.db")
    if not db_url.startswith("sqlite") and not allow_non_sqlite:
        sys.exit(f"Refusing to seed non-SQLite DATABASE_URL without --allow-non-sqlite (got scheme "
                 f"'{db_url.split(':', 1)[0]}'). Never point this at production.")
    from sqlalchemy.future import select
    from app.main import app
    from app.scripts.init_db import init_db, seed_data
    from app.core.database import AsyncSessionLocal
    from app.core.security import create_access_token
    from app.models.user import User, Role, RoleName

    await init_db()
    await seed_data()
    async with AsyncSessionLocal() as s:
        admin = (await s.execute(select(User).where(User.email == "admin@vyaparone.com"))).scalars().first()
        owner_role = (await s.execute(select(Role).where(Role.name == RoleName.BUSINESS_OWNER.value))).scalars().first()
    if not admin:
        sys.exit("Admin user missing; set ADMIN_SEED_PASSWORD and retry.")
    token = create_access_token(subject=admin.id)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://seed.local",
                                 headers={"Authorization": f"Bearer {token}"}, timeout=60) as c:
        await Seeder(c).run(owner_role.id if owner_role else None)


async def run_remote(api_url: str, allow_remote: bool):
    host = urlparse(api_url).hostname or ""
    if host not in ("localhost", "127.0.0.1", "::1") and not allow_remote:
        sys.exit(f"Refusing to seed non-local API host '{host}' without --allow-remote.")
    email = os.environ.get("DEMO_ADMIN_EMAIL", "admin@vyaparone.com")
    pw = os.environ.get("DEMO_ADMIN_PASSWORD") or os.environ.get("ADMIN_SEED_PASSWORD")
    if not pw:
        sys.exit("Set DEMO_ADMIN_PASSWORD (or ADMIN_SEED_PASSWORD) for --api-url mode.")
    async with httpx.AsyncClient(base_url=api_url.rstrip("/"), timeout=60) as c:
        r = await c.post("/api/v1/auth/login", json={"email": email, "password": pw})
        r.raise_for_status()
        c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        await Seeder(c).run()


def main():
    ap = argparse.ArgumentParser(description="Seed fictional VyaparOne demo data.")
    ap.add_argument("--api-url", help="Seed a running server (e.g. http://localhost:8000) instead of in-process.")
    ap.add_argument("--allow-remote", action="store_true", help="Allow a non-localhost --api-url.")
    ap.add_argument("--allow-non-sqlite", action="store_true", help="Allow in-process seeding of a non-SQLite DATABASE_URL.")
    a = ap.parse_args()
    if a.api_url:
        asyncio.run(run_remote(a.api_url, a.allow_remote))
    else:
        asyncio.run(run_in_process(a.allow_non_sqlite))


if __name__ == "__main__":
    main()
