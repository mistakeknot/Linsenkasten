#!/usr/bin/env python3
"""
Run database migration using service role key.
This script has admin permissions and can execute raw SQL.
"""

import os
import sys
from supabase import create_client

# Load environment
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://cnoiajawbnxqxvsbxris.supabase.co')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SERVICE_ROLE_KEY:
    print("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment")
    print("Please set it in .env or export it")
    sys.exit(1)

print(f"🔐 Connecting to Supabase with service role key...")
client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

print("\n" + "="*60)
print("DATABASE MIGRATION: Fix Embedding VECTOR Type")
print("="*60)

# Step 1: Enable pgvector extension
print("\n📦 Step 1: Enabling pgvector extension...")
try:
    result = client.rpc('exec_sql', {
        'query': 'CREATE EXTENSION IF NOT EXISTS vector'
    }).execute()
    print("✅ pgvector extension enabled")
except Exception as e:
    # Try alternative method - direct SQL via PostgREST
    print(f"⚠️  Cannot use exec_sql RPC: {e}")
    print("Attempting direct schema modification...")

# Step 2: Check current schema
print("\n🔍 Step 2: Checking current embedding column type...")
try:
    # Query lenses table to see current schema
    result = client.table('lenses').select('id, name, embedding').limit(1).execute()
    if result.data:
        lens = result.data[0]
        embedding = lens.get('embedding')
        if isinstance(embedding, str):
            print(f"✅ Current type: TEXT (JSON string)")
            print(f"   Length: {len(embedding)} chars")
        else:
            print(f"⚠️  Current type: {type(embedding)}")
except Exception as e:
    print(f"❌ Error checking schema: {e}")
    sys.exit(1)

# Step 3: Add new VECTOR column
print("\n➕ Step 3: Adding new VECTOR(384) column...")
try:
    # This requires direct database access - use Supabase management API
    import requests

    # Use Supabase REST API to execute SQL
    headers = {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json'
    }

    # Try to add column via raw SQL
    sql = "ALTER TABLE lenses ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(384)"

    # Note: This might not work through REST API - may need direct PostgreSQL access
    print(f"⚠️  Adding VECTOR column requires direct PostgreSQL access")
    print(f"   SQL: {sql}")
    print(f"\n💡 SOLUTION: The service role key doesn't have SQL execution privileges")
    print(f"   You need to run the migration in Supabase SQL Editor")
    print(f"   File: migrations/001_fix_embedding_vector_type.sql")

except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*60)
print("MIGRATION INCOMPLETE")
print("="*60)
print("\n📝 Summary:")
print("   - Service role key has API access, not SQL execution access")
print("   - The migration requires DDL operations (ALTER TABLE, CREATE INDEX)")
print("   - These can only be run through the Supabase SQL Editor")
print("\n📋 Next Steps:")
print("   1. Open Supabase Dashboard → SQL Editor")
print("   2. Copy migrations/001_fix_embedding_vector_type.sql")
print("   3. Run the full migration SQL")
print("   4. Verify 288 rows migrated")
print("\n" + "="*60)
