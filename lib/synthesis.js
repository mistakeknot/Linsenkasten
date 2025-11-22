/**
 * Synthesis Module
 *
 * Inspired by AutoTRIZ Module 4: Structured solution reports.
 * Combines multiple lens applications into coherent, actionable solutions.
 *
 * Takes insights from different lenses and synthesizes them into:
 * - Problem reframe
 * - Root cause analysis
 * - Key insights (per lens)
 * - Recommended actions (sequenced)
 * - Trade-offs and validation criteria
 *
 * Output format: Structured markdown for clarity
 */

/**
 * Synthesize solution from multiple lens applications
 *
 * @param {Object} params - Synthesis parameters
 * @param {string} params.problem - Original problem description
 * @param {Array} params.lenses_applied - Lens applications with beliefs
 * @param {string} params.thinking_mode - Mode used (optional)
 * @returns {string} Structured markdown solution report
 */
function synthesizeSolution({ problem, lenses_applied, thinking_mode }) {
  // Extract all beliefs and organize
  const allBeliefs = extractBeliefs(lenses_applied);

  // Generate problem reframe
  const reframe = generateReframe(problem, allBeliefs, lenses_applied);

  // Identify root cause
  const rootCause = identifyRootCause(allBeliefs);

  // Extract key insights per lens
  const insights = extractKeyInsights(lenses_applied);

  // Generate recommended actions
  const actions = generateActions(allBeliefs);

  // Identify trade-offs
  const tradeoffs = identifyTradeoffs(allBeliefs);

  // Format as markdown
  return formatSolutionReport({
    problem,
    reframe,
    rootCause,
    insights,
    actions,
    tradeoffs,
    thinking_mode,
    lenses_applied
  });
}

/**
 * Extract all beliefs from lens applications
 */
function extractBeliefs(lenses_applied) {
  return lenses_applied.flatMap(app =>
    (app.belief_statements || []).map(b => ({
      ...b,
      lens: app.lens
    }))
  );
}

/**
 * Generate problem reframe
 *
 * Synthesize highest-confidence beliefs into new problem statement
 */
function generateReframe(problem, allBeliefs, lenses_applied) {
  const lensNames = lenses_applied.map(app => app.lens).join(' + ');

  // Find highest-confidence reframing beliefs
  const reframingBeliefs = allBeliefs
    .filter(b => b.confidence >= 0.65)
    .filter(b =>
      /isn't|not about|actually|real issue|root cause|reframe/i.test(b.belief)
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  if (reframingBeliefs.length === 0) {
    return `Through ${lensNames}: This problem has structural/systemic dimensions beyond the surface symptoms.`;
  }

  const reframes = reframingBeliefs.map(b => b.belief);
  return `Through ${lensNames}: ${reframes.join('. ')}.`;
}

/**
 * Identify root cause from beliefs
 */
function identifyRootCause(allBeliefs) {
  // Look for beliefs mentioning root cause, layer, system, structure
  const rootCauseBeliefs = allBeliefs.filter(b =>
    /root cause|underlying|systemic|structural|layer|actually/i.test(b.belief) ||
    /root cause|underlying|systemic/i.test(b.reasoning)
  );

  if (rootCauseBeliefs.length === 0) {
    return null;
  }

  // Return highest-confidence root cause belief
  const topBelief = rootCauseBeliefs
    .sort((a, b) => b.confidence - a.confidence)[0];

  return {
    statement: topBelief.belief,
    evidence: topBelief.evidence,
    lens: topBelief.lens
  };
}

/**
 * Extract key insights per lens
 */
function extractKeyInsights(lenses_applied) {
  return lenses_applied.map(app => {
    const topBeliefs = (app.belief_statements || [])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2); // Top 2 insights per lens

    return {
      lens: app.lens,
      insights: topBeliefs.map(b => ({
        belief: b.belief,
        confidence: b.confidence,
        reasoning: b.reasoning
      }))
    };
  });
}

/**
 * Generate recommended actions from implications
 */
function generateActions(allBeliefs) {
  // Collect all implications
  const allImplications = allBeliefs.flatMap(b =>
    (b.implications || []).map(imp => ({
      action: imp,
      lens: b.lens,
      confidence: b.confidence
    }))
  );

  // Deduplicate similar actions
  const uniqueActions = deduplicateActions(allImplications);

  // Sequence actions (immediate vs short-term vs long-term)
  const sequenced = sequenceActions(uniqueActions);

  return sequenced;
}

/**
 * Deduplicate similar actions
 */
function deduplicateActions(implications) {
  const seen = new Set();
  const unique = [];

  implications.forEach(imp => {
    // Normalize action for comparison
    const normalized = imp.action.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    // Check if similar action already exists
    const similar = Array.from(seen).some(existing => {
      const similarity = calculateSimilarity(normalized, existing);
      return similarity > 0.7; // 70% similar threshold
    });

    if (!similar) {
      seen.add(normalized);
      unique.push(imp);
    }
  });

  return unique;
}

/**
 * Simple similarity calculation
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Sequence actions by timeframe
 */
function sequenceActions(actions) {
  const immediate = [];
  const shortTerm = [];
  const longTerm = [];

  actions.forEach(action => {
    const text = action.action.toLowerCase();

    // Immediate: measurement, profiling, validation
    if (/measure|profile|check|validate|examine|assess|identify/i.test(text)) {
      immediate.push(action);
    }
    // Long-term: build, implement, migrate, redesign
    else if (/build|implement|migrate|redesign|refactor|replace/i.test(text)) {
      longTerm.push(action);
    }
    // Short-term: everything else
    else {
      shortTerm.push(action);
    }
  });

  return {
    immediate: immediate.slice(0, 3), // Top 3
    short_term: shortTerm.slice(0, 4), // Top 4
    long_term: longTerm.slice(0, 3)   // Top 3
  };
}

/**
 * Identify trade-offs from beliefs
 */
function identifyTradeoffs(allBeliefs) {
  const tradeoffs = [];

  // Look for trade-off language
  allBeliefs.forEach(belief => {
    const text = `${belief.belief} ${belief.reasoning} ${(belief.implications || []).join(' ')}`;

    if (/trade-?off|cost|downside|risk|versus|vs|but/i.test(text)) {
      tradeoffs.push({
        context: belief.belief,
        lens: belief.lens
      });
    }
  });

  return tradeoffs.slice(0, 3); // Top 3 trade-offs
}

/**
 * Format solution report as markdown
 */
function formatSolutionReport({
  problem,
  reframe,
  rootCause,
  insights,
  actions,
  tradeoffs,
  thinking_mode,
  lenses_applied
}) {
  const sections = [];

  // Header
  sections.push('# Solution Synthesis\n');

  if (thinking_mode) {
    sections.push(`**Thinking Mode:** ${thinking_mode}\n`);
  }

  const lensNames = lenses_applied.map(app => app.lens).join(', ');
  sections.push(`**Lenses Applied:** ${lensNames}\n`);

  // Problem Reframe
  sections.push('\n## Problem Reframe\n');
  sections.push(reframe + '\n');

  // Root Cause
  if (rootCause) {
    sections.push('\n## Root Cause\n');
    sections.push(`**[From ${rootCause.lens}]** ${rootCause.statement}\n`);
    if (rootCause.evidence) {
      sections.push(`\n*Evidence:* ${rootCause.evidence}\n`);
    }
  }

  // Key Insights
  sections.push('\n## Key Insights\n');
  insights.forEach(({ lens, insights: lensInsights }) => {
    if (lensInsights.length > 0) {
      sections.push(`\n### Through ${lens}:\n`);
      lensInsights.forEach((insight, idx) => {
        sections.push(`${idx + 1}. **${insight.belief}**\n`);
        sections.push(`   - *Reasoning:* ${insight.reasoning}\n`);
        sections.push(`   - *Confidence:* ${(insight.confidence * 100).toFixed(0)}%\n`);
      });
    }
  });

  // Recommended Actions
  sections.push('\n## Recommended Actions\n');

  if (actions.immediate.length > 0) {
    sections.push('\n### Immediate (Days 1-7):\n');
    actions.immediate.forEach((action, idx) => {
      sections.push(`${idx + 1}. ${action.action}\n`);
    });
  }

  if (actions.short_term.length > 0) {
    sections.push('\n### Short-term (Weeks 2-4):\n');
    actions.short_term.forEach((action, idx) => {
      sections.push(`${idx + 1}. ${action.action}\n`);
    });
  }

  if (actions.long_term.length > 0) {
    sections.push('\n### Long-term (Months 2-6):\n');
    actions.long_term.forEach((action, idx) => {
      sections.push(`${idx + 1}. ${action.action}\n`);
    });
  }

  // Trade-offs
  if (tradeoffs.length > 0) {
    sections.push('\n## Trade-offs to Consider\n');
    tradeoffs.forEach((tradeoff, idx) => {
      sections.push(`${idx + 1}. **[${tradeoff.lens}]** ${tradeoff.context}\n`);
    });
  }

  // Validation
  sections.push('\n## Validation Strategy\n');
  sections.push('Before full implementation:\n');
  sections.push('1. Test core hypothesis with small experiment\n');
  sections.push('2. Measure baseline metrics\n');
  sections.push('3. Define success criteria\n');
  sections.push('4. Set decision points for pivot/persevere\n');

  return sections.join('');
}

/**
 * Quick synthesis for single lens
 */
function quickSynthesize(lens, beliefs, problem) {
  const topBelief = beliefs
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!topBelief) {
    return `No high-confidence insights generated for ${lens}.`;
  }

  const implications = (topBelief.implications || []).slice(0, 3);

  return `**Through ${lens}:** ${topBelief.belief}

**Next Steps:**
${implications.map((imp, idx) => `${idx + 1}. ${imp}`).join('\n')}`;
}

module.exports = {
  synthesizeSolution,
  quickSynthesize
};
