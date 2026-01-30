#!/usr/bin/env python3
"""
Generate contrast relationships for lenses and append to JSON file.

This script:
1. Reads existing lenses and connections from JSON files
2. Identifies lenses without contrasts
3. Finds contrast candidates using embedding distance + shared concepts
4. Generates insight text explaining the dialectic tension
5. Outputs new contrasts to a JSON file for review
6. Provides merge command to append approved contrasts
"""

import json
import logging
import os
from typing import List, Dict, Set
import numpy as np
from supabase import create_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
CONNECTIONS_FILE = 'claude_lens_connections_analysis.json'
LENSES_FILE = 'all_lenses_for_analysis.json'
OUTPUT_FILE = 'new_contrasts.json'


class ContrastGenerator:
    def __init__(self):
        # Load environment variables
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables required")

        self.supabase = create_client(self.supabase_url, self.supabase_key)

        # Load data
        self.lenses = self.load_lenses()
        self.existing_contrasts = self.load_existing_contrasts()

        logger.info(f"Loaded {len(self.lenses)} lenses")
        logger.info(f"Found {len(self.existing_contrasts)} existing contrasts")

    def load_lenses(self) -> List[Dict]:
        """Load all lenses from Supabase (ensures IDs match database)"""
        logger.info("Fetching lenses from Supabase...")
        response = self.supabase.table('lenses').select('id, name, definition, related_concepts, lens_type').execute()
        lenses = response.data
        logger.info(f"Fetched {len(lenses)} lenses from Supabase")
        return lenses

    def load_existing_contrasts(self) -> List[Dict]:
        """Load existing contrast relationships from JSON file"""
        with open(CONNECTIONS_FILE, 'r') as f:
            data = json.load(f)

        connections = data.get('connections', [])
        contrasts = [c for c in connections if c.get('type') == 'contrast']
        return contrasts

    def get_uncovered_lenses(self) -> List[Dict]:
        """Find lenses without contrast relationships"""
        # Build set of lens IDs that have contrasts
        covered_ids = set()
        for contrast in self.existing_contrasts:
            covered_ids.add(contrast['source_id'])
            covered_ids.add(contrast['target_id'])

        # Find uncovered lenses
        uncovered = [lens for lens in self.lenses if lens['id'] not in covered_ids]

        logger.info(f"Found {len(uncovered)} lenses without contrasts ({len(covered_ids)} covered)")
        return uncovered

    def get_lens_embedding(self, lens_id: str) -> np.ndarray:
        """Fetch lens embedding from Supabase"""
        try:
            response = self.supabase.table('lenses') \
                .select('embedding') \
                .eq('id', lens_id) \
                .single() \
                .execute()

            if response.data and response.data.get('embedding'):
                embedding = response.data['embedding']
                # Handle case where embedding might be a string (JSON encoded)
                if isinstance(embedding, str):
                    import json
                    embedding = json.loads(embedding)
                # Convert to numpy array with float type
                return np.array(embedding, dtype=np.float32)
            else:
                logger.warning(f"No embedding found for {lens_id}")
                return None
        except Exception as e:
            logger.error(f"Error fetching embedding for {lens_id}: {e}")
            return None

    def cosine_distance(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Calculate cosine distance (1 - cosine similarity)"""
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        similarity = dot_product / (norm1 * norm2)
        return 1.0 - similarity

    def calculate_dialectic_score(self, source_lens: Dict, target_lens: Dict) -> float:
        """Calculate how dialectically opposed two lenses are based on their definitions"""
        source_def = source_lens.get('definition', '').lower()
        target_def = target_lens.get('definition', '').lower()

        # Dialectic keyword pairs (opposing concepts)
        dialectic_pairs = [
            ('centralized', 'decentralized'),
            ('control', 'freedom'),
            ('stability', 'change'),
            ('conservative', 'liberal'),
            ('individual', 'collective'),
            ('short-term', 'long-term'),
            ('reactive', 'proactive'),
            ('top-down', 'bottom-up'),
            ('rigid', 'flexible'),
            ('specialized', 'generalized'),
            ('compete', 'cooperate'),
            ('open', 'closed'),
            ('fast', 'slow'),
            ('explicit', 'implicit'),
            ('formal', 'informal')
        ]

        score = 0.0
        for word1, word2 in dialectic_pairs:
            # Check if one lens mentions first concept and other mentions second
            if (word1 in source_def and word2 in target_def) or \
               (word2 in source_def and word1 in target_def):
                score += 0.2  # Add 0.2 for each dialectic pair found

        # Cap at 1.0
        return min(score, 1.0)

    def find_contrast_candidates(self, source_lens: Dict, limit: int = 5) -> List[Dict]:
        """Find potential contrast candidates for a lens using improved dialectic detection"""
        source_embedding = self.get_lens_embedding(source_lens['id'])
        if source_embedding is None:
            return []

        source_concepts = set(c.lower() for c in source_lens.get('related_concepts', []))

        # Generic concepts to filter out (too broad for meaningful contrasts)
        generic_concepts = {
            'core concepts', 'systems thinking', 'thinking', 'concepts',
            'strategy', 'management', 'leadership', 'organizational'
        }

        candidates = []

        for target_lens in self.lenses:
            # Skip self
            if target_lens['id'] == source_lens['id']:
                continue

            # Skip if already has contrast with this lens
            has_existing = any(
                (c['source_id'] == source_lens['id'] and c['target_id'] == target_lens['id']) or
                (c['target_id'] == source_lens['id'] and c['source_id'] == target_lens['id'])
                for c in self.existing_contrasts
            )
            if has_existing:
                continue

            # Get target embedding
            target_embedding = self.get_lens_embedding(target_lens['id'])
            if target_embedding is None:
                continue

            # Calculate distance (sweet spot for dialectic opposition: 0.65-0.92)
            distance = self.cosine_distance(source_embedding, target_embedding)

            # Check for shared concepts (need some connection for meaningful contrast)
            target_concepts = set(c.lower() for c in target_lens.get('related_concepts', []))
            shared_concepts = source_concepts & target_concepts

            # Filter out generic shared concepts
            specific_shared = shared_concepts - generic_concepts

            # Require: distance in sweet spot + meaningful shared concepts
            # Meaningful = at least 1 specific concept OR 2+ generic concepts
            has_meaningful_shared = len(specific_shared) >= 1 or len(shared_concepts) >= 2

            if 0.65 <= distance <= 0.92 and has_meaningful_shared:
                # Calculate dialectic score based on opposing keywords in definitions
                dialectic_score = self.calculate_dialectic_score(source_lens, target_lens)

                # Combined score: 70% distance + 30% dialectic keywords
                combined_score = (distance * 0.7) + (dialectic_score * 0.3)

                candidates.append({
                    'lens': target_lens,
                    'distance': distance,
                    'dialectic_score': dialectic_score,
                    'combined_score': combined_score,
                    'shared_concepts': list(shared_concepts)
                })

        # Sort by combined score (highest first) and limit
        candidates.sort(key=lambda x: x['combined_score'], reverse=True)
        return candidates[:limit]

    def generate_insight(self, source_lens: Dict, target_lens: Dict,
                        distance: float, shared_concepts: List[str]) -> str:
        """Generate insight text for the contrast relationship"""
        # Simple template-based insight generation
        # In production, you could use an LLM to generate richer insights

        source_name = source_lens['name']
        target_name = target_lens['name']

        # Extract key themes from definitions
        source_def = source_lens.get('definition', '')[:100]
        target_def = target_lens.get('definition', '')[:100]

        insight = (
            f"{source_name} and {target_name} represent contrasting perspectives "
            f"within {', '.join(shared_concepts)}. "
            f"While {source_name} focuses on {source_def}..., "
            f"{target_name} emphasizes {target_def}... "
            f"Together they map complementary approaches to the same domain."
        )

        return insight

    def generate_contrasts(self, limit: int = None) -> List[Dict]:
        """Generate new contrast relationships"""
        uncovered = self.get_uncovered_lenses()

        if limit:
            uncovered = uncovered[:limit]
            logger.info(f"Processing first {limit} uncovered lenses")

        new_contrasts = []

        for i, source_lens in enumerate(uncovered, 1):
            logger.info(f"[{i}/{len(uncovered)}] Finding contrasts for: {source_lens['name']}")

            candidates = self.find_contrast_candidates(source_lens, limit=3)

            if not candidates:
                logger.info(f"  No suitable candidates found")
                continue

            # Take best candidate
            best = candidates[0]
            target_lens = best['lens']
            distance = best['distance']
            dialectic_score = best['dialectic_score']
            combined_score = best['combined_score']
            shared_concepts = best['shared_concepts']

            # Generate insight
            insight = self.generate_insight(source_lens, target_lens, distance, shared_concepts)

            # Calculate weight based on combined score (0.80-0.95 range)
            # Combined score ranges from ~0.45 (min) to ~0.95 (max)
            # Map to weight range 0.80-0.95
            weight = 0.80 + (combined_score - 0.45) * 0.30  # Maps 0.45-0.95 to 0.80-0.95
            weight = max(0.80, min(0.95, round(weight, 2)))  # Clamp to range

            contrast = {
                'source_id': source_lens['id'],
                'target_id': target_lens['id'],
                'weight': weight,
                'type': 'contrast',
                'insight': insight,
                'metadata': {
                    'distance': round(distance, 3),
                    'dialectic_score': round(dialectic_score, 3),
                    'combined_score': round(combined_score, 3),
                    'shared_concepts': shared_concepts,
                    'generated_by': 'generate_contrasts_json.py'
                }
            }

            new_contrasts.append(contrast)

            logger.info(f"  → {target_lens['name']} (dist: {distance:.3f}, dial: {dialectic_score:.2f}, score: {combined_score:.3f}, weight: {weight})")

        return new_contrasts

    def save_contrasts(self, contrasts: List[Dict], output_file: str = OUTPUT_FILE):
        """Save generated contrasts to JSON file"""
        output = {
            'generated_count': len(contrasts),
            'new_contrasts': contrasts,
            'instructions': {
                'review': 'Review the contrasts above and edit/remove any that are not high quality',
                'merge': f'python scripts/merge_contrasts.py {output_file}'
            }
        }

        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)

        logger.info(f"\n✅ Generated {len(contrasts)} new contrasts")
        logger.info(f"📄 Saved to: {output_file}")
        logger.info(f"\n📋 Next steps:")
        logger.info(f"1. Review {output_file}")
        logger.info(f"2. Edit/remove low-quality contrasts")
        logger.info(f"3. Run: python scripts/merge_contrasts.py {output_file}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Generate contrast relationships')
    parser.add_argument('--limit', type=int, help='Process only first N lenses')
    parser.add_argument('--output', default=OUTPUT_FILE, help='Output JSON file')

    args = parser.parse_args()

    try:
        generator = ContrastGenerator()
        contrasts = generator.generate_contrasts(limit=args.limit)
        generator.save_contrasts(contrasts, output_file=args.output)
    except Exception as e:
        logger.error(f"Failed to generate contrasts: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
