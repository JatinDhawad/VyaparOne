from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.companies import router as companies_router
from app.api.v1.categories import router as categories_router
from app.api.v1.products import router as products_router
from app.api.v1.parties import router as parties_router
from app.api.v1.ledger import router as ledger_router
from app.api.v1.purchases import router as purchases_router
from app.api.v1.sales import router as sales_router
from app.api.v1.payments import router as payments_router
from app.api.v1.expenses import router as expenses_router
from app.api.v1.reports import router as reports_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(companies_router)
api_router.include_router(categories_router)
api_router.include_router(products_router)
api_router.include_router(parties_router)
api_router.include_router(ledger_router)
api_router.include_router(purchases_router)
api_router.include_router(sales_router)
api_router.include_router(payments_router)
api_router.include_router(expenses_router)
api_router.include_router(reports_router)
