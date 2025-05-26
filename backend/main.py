# To run the backend on localhost:8000, use:
# uvicorn main:app --host localhost --port 8000 --reload
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from starlette.responses import JSONResponse

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "1075078781081-vei8h3oce8dgcvd8405ijuatv5ekgc5j.apps.googleusercontent.com")

@app.post("/api/auth/google")
async def google_auth(request: Request):
    print("Request headers:", dict(request.headers))
    data = await request.json()
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")
    try:
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        user = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
        response = JSONResponse({"user": user})
        response.set_cookie(
            key="session", value=token, httponly=True, secure=False, samesite="lax", max_age=3600
        )
        print("Set-Cookie header should be set for session.")
        return response
    except Exception as e:
        print("Token verification failed:", e)
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/me")
async def me(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        user = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
        return {"user": user}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

@app.post("/api/logout")
async def logout(response):
    response.delete_cookie("session")
    return {"ok": True}
