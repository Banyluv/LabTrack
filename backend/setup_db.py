import psycopg2
conn = psycopg2.connect(dbname="postgres", user="postgres", password="lamis", host="localhost")
conn.autocommit = True
cur = conn.cursor()
cur.execute("CREATE DATABASE labtrack")
print("Database labtrack created successfully")
conn.close()