from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.races import router as races_router
from app.core.config import settings

app = FastAPI(title="BoatAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(races_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
