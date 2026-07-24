import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.auth import router as auth_router
from app.api.routes.predictions import router as predictions_router
from app.api.routes.races import router as races_router
from app.api.routes.rules import router as rules_router
from app.api.routes.summary import router as summary_router
from app.core.config import settings

logger = logging.getLogger("boatai")

app = FastAPI(title="BoatAI API")


@app.middleware("http")
async def catch_unhandled_exceptions(request: Request, call_next):
    """未処理の例外もCORSヘッダー付きでレスポンスされるようにする。

    一見自然に見える `@app.exception_handler(Exception)`（またはキー500）は使わない：
    FastAPI/Starletteはこれを「ユーザーが追加したミドルウェアの外側」にある
    ServerErrorMiddleware専用ハンドラとして特別扱いする仕様になっており
    （build_middleware_stackの実装上、キーが500またはExceptionのハンドラは
    ExceptionMiddlewareではなくServerErrorMiddlewareのhandler引数に渡される）、
    そこで生成したレスポンスはCORSMiddlewareを経由せずに直接送信されてしまう。
    実際に検証したところ、exception_handlerで生成した500レスポンスにCORSヘッダーが
    付与されないことを確認した。

    正しい修正は、CORSMiddlewareより内側（＝先に登録＝スタックの後段）で例外を
    捕捉する独自ミドルウェアを追加すること。ここで生成したレスポンスは
    call_next()の呼び出し元であるCORSMiddlewareの送信経路を通るため、
    正しくAccess-Control-Allow-Origin等のヘッダーが付与される。
    このミドルウェアは`app.add_middleware(CORSMiddleware, ...)`より前に登録する
    必要がある（Starletteは最後に追加したミドルウェアを最も外側に置くため）。
    """
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(predictions_router)
app.include_router(races_router)
app.include_router(rules_router)
app.include_router(summary_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
