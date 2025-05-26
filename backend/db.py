import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB")

if not MONGODB_URI or not MONGODB_DB:
    raise ValueError("MONGODB_URI and MONGODB_DB must be set in the environment variables.")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[MONGODB_DB]

def get_database():
    return db