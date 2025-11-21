# Changelog

All notable changes to linsenkasten-mcp will be documented in this file.

## [1.0.1] - 2025-01-21

### Improved
- **Semantic search now works properly**: Search queries now use OpenAI embeddings + pgvector for true semantic similarity instead of keyword matching
- **Better search results**: Queries like "decision making", "leadership", and "systems thinking" now return highly relevant lenses
- **No breaking changes**: All existing commands work the same, just better results

### Technical Details
- API backend now uses `search_lenses_by_embedding()` for semantic search
- Typical search now returns 10-30 relevant results vs. 0-2 with keyword matching
- All creative navigation tools (journey, bridge, neighborhood, contrasts) continue to work perfectly

## [1.0.0] - 2025-01-20

### Added
- Initial release with MCP server and CLI tool
- 8 creative thinking commands (search, journey, bridge, central, neighborhood, contrasts, random, get)
- Integration with FLUX lens database (256+ lenses)
- Graph-based conceptual navigation
