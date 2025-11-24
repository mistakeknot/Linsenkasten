#!/usr/bin/env python3
"""
Inspect the actual format of embeddings in Supabase.
"""

import os
from supabase import create_client

def inspect_embedding_format():
    """Check what the embedding field actually contains"""

    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    supabase = create_client(supabase_url, supabase_key)

    print("🔍 Inspecting embedding format...\n")

    # Fetch one lens with ALL fields
    response = supabase.table('lenses') \
        .select('*') \
        .limit(1) \
        .execute()

    if response.data:
        lens = response.data[0]
        print(f"Sample lens: {lens['id']} - {lens['name']}")
        print(f"\n📋 All fields:")
        for key in sorted(lens.keys()):
            value = lens[key]
            value_type = type(value).__name__
            if isinstance(value, list):
                print(f"   {key}: {value_type} (length {len(value)})")
                if len(value) > 0:
                    print(f"      First 3 values: {value[:3]}")
            elif isinstance(value, str) and len(value) > 100:
                print(f"   {key}: {value_type} (length {len(value)}, truncated)")
                print(f"      Preview: {value[:100]}...")
            else:
                print(f"   {key}: {value_type} = {value}")

    # Check embedding field specifically
    print(f"\n🔬 Embedding field details:")
    response = supabase.table('lenses') \
        .select('id, name, embedding') \
        .limit(5) \
        .execute()

    for lens in response.data:
        emb = lens.get('embedding')
        emb_type = type(emb).__name__
        if emb is None:
            print(f"   {lens['id']}: NULL")
        elif isinstance(emb, list):
            print(f"   {lens['id']}: list of {len(emb)} values")
            if len(emb) > 0:
                print(f"      First value type: {type(emb[0]).__name__}")
                print(f"      First 3: {emb[:3]}")
        elif isinstance(emb, str):
            print(f"   {lens['id']}: string (length {len(emb)})")
            print(f"      Content: {emb[:100]}")
        else:
            print(f"   {lens['id']}: {emb_type} = {emb}")

if __name__ == '__main__':
    inspect_embedding_format()
