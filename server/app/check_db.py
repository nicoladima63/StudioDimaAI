# check_db.py
import os
from sqlalchemy import create_engine, inspect

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.abspath(os.path.join(basedir, '../instance/users.db'))
db_uri = f"sqlite:///{db_path}"

engine = create_engine(db_uri)
inspector = inspect(engine)

# Rimuovo tutti i print di debug
