#!/usr/bin/env python3
"""
Re-embed all lenses with sentence-transformers (FREE local model).

This fixes the cross-model embedding mismatch:
- Before: Query (sentence-transformers) vs Corpus (OpenAI) = poor similarity
- After: Query (sentence-transformers) vs Corpus (sentence-transformers) = good similarity

Run this to enable truly free search with good quality results!

Usage:
    python scripts/reembed_with_sentence_transformers.py
    python scripts/reembed_with_sentence_transformers.py --limit 10  # Test first
"""

import os
import sys
import argparse
from typing import List, Dict
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase_store import SupabaseLensStore

def reembed_lenses(limit: int = None, dry_run: bool = False):
    """Re-embed all lenses using FREE sentence-transformers."""

    print("🔧 Initializing with sentence-transformers model...")
    store = SupabaseLensStore()

    if not store.local_model:
        print("❌ sentence-transformers model not available!")
        print("Make sure sentence-transformers is installed:")
        print("  pip install sentence-transformers")
        sys.exit(1)

    print("✅ sentence-transformers model loaded (all-MiniLM-L6-v2, 384-dim)")

    print("\n📦 Fetching all lenses...")
    result = store.client.table('lenses').select('id, name, definition, lens_type').execute()
    lenses = result.data

    if limit:
        lenses = lenses[:limit]
        print(f"ℹ️  Limited to {limit} lenses for testing")

    print(f"📊 Found {len(lenses)} lenses")

    if dry_run:
        print("\n🏃 DRY RUN - No changes will be made")
        print("\nSample lenses to be re-embedded:")
        for lens in lenses[:5]:
            print(f"  - {lens['name']}")
        return

    # Re-generate embeddings using sentence-transformers
    updated = 0
    errors = 0

    print("\n🚀 Generating FREE local embeddings with sentence-transformers...")
    print("   (No API costs, runs on your CPU!)")

    for i, lens in enumerate(lenses):
        try:
            # Create text for embedding
            text = f"{lens['name']}: {lens.get('definition', '')}"

            # Generate embedding using FREE local sentence-transformers
            embedding = store.generate_query_embedding(text)

            # Update lens in Supabase
            store.client.table('lenses').update({
                'embedding': embedding
            }).eq('id', lens['id']).execute()

            updated += 1

            # Progress indicator
            if (i + 1) % 10 == 0:
                print(f"  ✅ Processed {i + 1}/{len(lenses)} lenses...")

            # Small delay to avoid overwhelming the database
            time.sleep(0.01)

        except Exception as e:
            errors += 1
            print(f"  ❌ Error embedding '{lens['name']}': {e}")
            continue

    print(f"\n✨ Complete!")
    print(f"  ✅ Successfully embedded: {updated} lenses")
    print(f"  ❌ Errors: {errors}")

    if errors == 0:
        print(f"\n🎉 All lenses now use sentence-transformers embeddings!")
        print(f"💰 Query + Corpus = SAME MODEL = High similarity scores!")
        print(f"🔍 Search quality will be much better now!")
        print(f"📝 Next: Test search and deploy to Railway")

def main():
    parser = argparse.ArgumentParser(description='Re-embed all lenses with sentence-transformers')
    parser.add_argument('--limit', type=int, help='Limit number of lenses (for testing)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    args = parser.parse_args()

    reembed_lenses(limit=args.limit, dry_run=args.dry_run)

if __name__ == '__main__':
    main()
