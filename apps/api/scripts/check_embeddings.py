#!/usr/bin/env python3
"""
Check which lenses have embeddings in Supabase.
Diagnoses the batch 2 contrast generation failure.
"""

import os
from supabase import create_client

def check_embeddings():
    """Check embedding status for all lenses"""

    # Initialize Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
        return

    supabase = create_client(supabase_url, supabase_key)

    print("🔍 Checking embedding status for all lenses...\n")

    # Fetch all lenses with id, name, and embedding status
    response = supabase.table('lenses') \
        .select('id, name, embedding') \
        .execute()

    lenses = response.data

    # Analyze embedding coverage
    with_embeddings = []
    without_embeddings = []
    null_embeddings = []

    for lens in lenses:
        if lens.get('embedding') is None:
            null_embeddings.append(lens)
        elif isinstance(lens.get('embedding'), list) and len(lens['embedding']) > 0:
            with_embeddings.append(lens)
        else:
            without_embeddings.append(lens)

    print(f"📊 Embedding Coverage:")
    print(f"   ✅ With embeddings: {len(with_embeddings)}/{len(lenses)}")
    print(f"   ❌ NULL embeddings: {len(null_embeddings)}")
    print(f"   ⚠️  Empty/invalid: {len(without_embeddings)}\n")

    # Show sample IDs from each category
    if with_embeddings:
        print(f"✅ Sample lenses WITH embeddings (first 5):")
        for lens in with_embeddings[:5]:
            emb_len = len(lens['embedding']) if isinstance(lens['embedding'], list) else 0
            print(f"   - {lens['id']}: {lens['name']} ({emb_len}-dim)")

    if null_embeddings:
        print(f"\n❌ Lenses WITHOUT embeddings (NULL) - showing first 10:")
        for lens in null_embeddings[:10]:
            print(f"   - {lens['id']}: {lens['name']}")
        if len(null_embeddings) > 10:
            print(f"   ... and {len(null_embeddings) - 10} more")

    if without_embeddings:
        print(f"\n⚠️  Lenses with EMPTY/INVALID embeddings:")
        for lens in without_embeddings:
            print(f"   - {lens['id']}: {lens['name']}")

    # Check ID format patterns
    print(f"\n📋 ID Format Analysis:")
    id_prefixes = {}
    for lens in lenses:
        prefix = lens['id'].split('_')[0] if '_' in lens['id'] else lens['id']
        id_prefixes[prefix] = id_prefixes.get(prefix, 0) + 1

    for prefix, count in sorted(id_prefixes.items()):
        print(f"   {prefix}_*: {count} lenses")

    # Return stats for further analysis
    return {
        'total': len(lenses),
        'with_embeddings': with_embeddings,
        'null_embeddings': null_embeddings,
        'without_embeddings': without_embeddings
    }

if __name__ == '__main__':
    check_embeddings()
