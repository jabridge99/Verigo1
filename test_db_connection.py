from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv(".env.dbtest")

USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        result.fetchone()
        print("Connection successful!")
except Exception as e:
    print(f"Failed to connect: {e}")
