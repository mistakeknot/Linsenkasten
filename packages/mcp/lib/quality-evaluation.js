/**
 * Quality Evaluation Module
 *
 * Implements 4-criteria scoring for lens applications.
 * Based on Creative Problem Solving (CPS) framework component 4.
 *
 * No LLM calls - uses pattern-based heuristics to assess:
 * 1. Specificity: Concrete details vs vague platitudes
 * 2. Novelty: Original insights vs generic advice
 * 3. Actionability: Clear next steps vs abstract concepts
 * 4. Coherence: Logical flow and structure
 *
 * Enables quality gates for iterative refinement.
 */

/**
 * Evaluate quality of lens application
 *
 * @param {Object} application - Lens application object
 * @param {string} application.lens - Lens name
 * @param {Array} application.belief_statements - Generated beliefs
 * @param {string} application.problem_context - Original problem
 * @returns {Object} Quality scores (0-1 scale)
 */
function evaluateQuality(application) {
  const { lens, belief_statements = [], problem_context = '' } = application;

  // Convert beliefs to text for analysis
  const beliefText = belief_statements
    .map(b => `${b.belief} ${b.reasoning} ${b.implications.join(' ')}`)
    .join(' ');

  const combinedText = `${beliefText} ${problem_context}`;

  return {
    specificity: evaluateSpecificity(beliefText, belief_statements),
    novelty: evaluateNovelty(beliefText, lens),
    actionability: evaluateActionability(belief_statements),
    coherence: evaluateCoherence(belief_statements, beliefText),
    overall: 0 // Computed after individual scores
  };
}

/**
 * Evaluate Specificity (0-1)
 *
 * High specificity indicators:
 * - Numbers, percentages, timelines
 * - Specific tool/method names
 * - Concrete examples
 * - Named entities (layers, components, metrics)
 *
 * Low specificity indicators:
 * - Vague terms (improve, optimize, consider)
 * - Generic advice (best practices, balance)
 * - Abstract concepts without grounding
 */
function evaluateSpecificity(text, beliefs) {
  let score = 0.3; // Baseline

  // Check for numbers and metrics
  const numberMatches = text.match(/\d+%|\d+ms|\d+x|\d+ weeks|\d+ months/gi) || [];
  score += Math.min(0.2, numberMatches.length * 0.05);

  // Check for specific terminology
  const specificTerms = [
    /layer|tier|level/gi,
    /component|module|system/gi,
    /metric|measure|score/gi,
    /timeline|deadline|week|month/gi,
    /specific|concrete|particular/gi,
    /\$\d+k|\$\d+M/gi // Dollar amounts
  ];

  specificTerms.forEach(pattern => {
    if (pattern.test(text)) score += 0.05;
  });

  // Check implications for concrete actions
  const hasConcreteImplications = beliefs.some(b =>
    b.implications && b.implications.length > 2 &&
    b.implications.some(imp => /\d+|specific|exactly|measure/.test(imp))
  );
  if (hasConcreteImplications) score += 0.15;

  // Check evidence specificity
  const hasSpecificEvidence = beliefs.some(b =>
    b.evidence && typeof b.evidence === 'string' &&
    /\d+|data|measured|observed/.test(b.evidence)
  );
  if (hasSpecificEvidence) score += 0.1;

  // Penalize vague language
  const vagueTerms = /(improve|better|optimize|enhance|consider|think about|maybe|possibly)/gi;
  const vagueCount = (text.match(vagueTerms) || []).length;
  score -= Math.min(0.15, vagueCount * 0.03);

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate Novelty (0-1)
 *
 * High novelty indicators:
 * - Lens-specific terminology
 * - Reframing language
 * - Counter-intuitive insights
 * - Structural analysis
 *
 * Low novelty indicators:
 * - Generic best practices
 * - Obvious advice
 * - Common platitudes
 */
function evaluateNovelty(text, lensName) {
  let score = 0.2; // Baseline (assumes some novelty from lens application)

  // Lens application depth
  const lensTerms = {
    'Pace Layering': /fast layer|slow layer|temporal|pace mismatch|layer speed/gi,
    'Leverage Points': /leverage|multiplicative|high-impact|intervention point/gi,
    'System Boundaries': /boundary|inside control|outside control|sphere of influence/gi,
    'Feedback Loops': /feedback loop|reinforcing|balancing|vicious cycle|virtuous/gi,
    'Explore vs Exploit': /explore|exploit|learn|optimize|uncertainty/gi,
    'Bottleneck Theory': /bottleneck|constraint|theory of constraints|throughput/gi
  };

  const relevantPatterns = lensTerms[lensName] || /lens|framework|perspective/gi;
  const lensMatches = (text.match(relevantPatterns) || []).length;
  score += Math.min(0.25, lensMatches * 0.05);

  // Reframing language
  const reframingTerms = [
    /isn't|not about|actually|real issue|root cause/gi,
    /reframe|rethink|reconceive|reconsider/gi,
    /breakthrough|insight|revelation/gi,
    /hidden|underlying|systemic/gi
  ];

  reframingTerms.forEach(pattern => {
    if (pattern.test(text)) score += 0.08;
  });

  // Structural analysis
  if (/architecture|structure|pattern|dynamic/.test(text)) score += 0.1;

  // Counter-intuitive signals
  if (/counter-intuitive|paradox|opposite|inverse/.test(text)) score += 0.15;

  // Penalize generic advice
  const genericPhrases = [
    /best practice/gi,
    /industry standard/gi,
    /common approach/gi,
    /typical solution/gi,
    /find balance/gi
  ];

  genericPhrases.forEach(pattern => {
    if (pattern.test(text)) score -= 0.08;
  });

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate Actionability (0-1)
 *
 * High actionability indicators:
 * - Clear action verbs
 * - Step-by-step sequences
 * - Decision criteria
 * - Testable outcomes
 *
 * Low actionability indicators:
 * - Abstract recommendations
 * - No clear next steps
 * - Missing implementation details
 */
function evaluateActionability(beliefs) {
  let score = 0.2; // Baseline

  // Check for implications (actionable steps)
  const totalImplications = beliefs.reduce((sum, b) =>
    sum + (b.implications ? b.implications.length : 0), 0
  );
  score += Math.min(0.3, totalImplications * 0.05);

  // Check for action verbs in implications
  const actionVerbs = /^(identify|map|measure|test|build|create|fix|change|implement|examine|profile|validate|check)/i;
  const actionableImplications = beliefs.reduce((count, b) =>
    count + (b.implications || []).filter(imp => actionVerbs.test(imp)).length, 0
  );
  score += Math.min(0.25, actionableImplications * 0.06);

  // Check for decision criteria
  const allText = beliefs.map(b => b.implications?.join(' ') || '').join(' ');
  if (/if|when|threshold|criteria|measure/.test(allText)) score += 0.1;

  // Check for testable outcomes
  if (/validate|test|measure|verify|confirm/.test(allText)) score += 0.1;

  // Check for sequenced steps
  if (/first|then|next|after|week \d+|step \d+/i.test(allText)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate Coherence (0-1)
 *
 * High coherence indicators:
 * - Logical connectors
 * - Consistent reasoning
 * - Clear structure
 * - Supporting evidence
 *
 * Low coherence indicators:
 * - Contradictions
 * - Missing links
 * - Fragmented ideas
 */
function evaluateCoherence(beliefs, text) {
  let score = 0.4; // Baseline (assumes some coherence)

  // Belief count (more beliefs = potential for better coverage, but also fragmentation risk)
  const beliefCount = beliefs.length;
  if (beliefCount >= 1 && beliefCount <= 3) {
    score += 0.15; // Sweet spot
  } else if (beliefCount > 5) {
    score -= 0.1; // Too many may be fragmented
  }

  // Logical connectors
  const connectors = [
    /because|since|therefore|thus|hence/gi,
    /this means|this suggests|this indicates/gi,
    /as a result|consequently/gi,
    /given that|assuming/gi
  ];

  connectors.forEach(pattern => {
    if (pattern.test(text)) score += 0.05;
  });

  // Evidence support
  const hasEvidence = beliefs.every(b => b.evidence && b.evidence.length > 0);
  if (hasEvidence) score += 0.15;

  // Reasoning traces
  const hasReasoning = beliefs.every(b => b.reasoning && b.reasoning.length > 20);
  if (hasReasoning) score += 0.1;

  // Confidence scores present
  const hasConfidence = beliefs.every(b => typeof b.confidence === 'number');
  if (hasConfidence) score += 0.05;

  // Check for contradictions (simple heuristic)
  const hasNo = text.match(/\bnot\b|\bno\b|\bnever\b/gi) || [];
  const hasYes = text.match(/\byes\b|\balways\b|\bmust\b/gi) || [];
  if (hasNo.length > 3 && hasYes.length > 3) {
    score -= 0.1; // Potential contradiction
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Compute overall quality score
 *
 * Weighted average of 4 criteria
 */
function computeOverall(scores) {
  const weights = {
    specificity: 0.25,
    novelty: 0.30,
    actionability: 0.25,
    coherence: 0.20
  };

  const overall = (
    scores.specificity * weights.specificity +
    scores.novelty * weights.novelty +
    scores.actionability * weights.actionability +
    scores.coherence * weights.coherence
  );

  return parseFloat(overall.toFixed(2));
}

/**
 * Full quality evaluation with overall score
 *
 * @param {Object} application - Lens application
 * @returns {Object} Quality scores including overall
 */
function evaluateWithOverall(application) {
  const scores = evaluateQuality(application);
  scores.overall = computeOverall(scores);

  // Round individual scores
  scores.specificity = parseFloat(scores.specificity.toFixed(2));
  scores.novelty = parseFloat(scores.novelty.toFixed(2));
  scores.actionability = parseFloat(scores.actionability.toFixed(2));
  scores.coherence = parseFloat(scores.coherence.toFixed(2));

  return scores;
}

/**
 * Check if quality meets threshold
 *
 * @param {Object} scores - Quality scores
 * @param {number} threshold - Minimum acceptable overall score (default: 0.7)
 * @returns {boolean} True if quality is acceptable
 */
function meetsQualityThreshold(scores, threshold = 0.7) {
  return scores.overall >= threshold;
}

/**
 * Get quality feedback for improvement
 *
 * @param {Object} scores - Quality scores
 * @returns {Array} Suggestions for improvement
 */
function getQualityFeedback(scores) {
  const feedback = [];

  if (scores.specificity < 0.6) {
    feedback.push({
      dimension: 'specificity',
      issue: 'Too vague or abstract',
      suggestions: [
        'Add specific numbers, metrics, or timelines',
        'Name concrete tools, methods, or components',
        'Include measurable outcomes',
        'Provide specific examples or evidence'
      ]
    });
  }

  if (scores.novelty < 0.6) {
    feedback.push({
      dimension: 'novelty',
      issue: 'Generic or conventional thinking',
      suggestions: [
        'Apply lens-specific terminology more deeply',
        'Identify counter-intuitive or structural insights',
        'Reframe the problem from first principles',
        'Challenge underlying assumptions'
      ]
    });
  }

  if (scores.actionability < 0.6) {
    feedback.push({
      dimension: 'actionability',
      issue: 'Unclear next steps',
      suggestions: [
        'Start implications with action verbs (identify, measure, test)',
        'Provide step-by-step sequences',
        'Define decision criteria or thresholds',
        'Include validation or testing steps'
      ]
    });
  }

  if (scores.coherence < 0.6) {
    feedback.push({
      dimension: 'coherence',
      issue: 'Fragmented or poorly connected ideas',
      suggestions: [
        'Use logical connectors (because, therefore, this means)',
        'Ensure all beliefs have evidence and reasoning',
        'Keep focus on 2-3 core insights',
        'Check for contradictions'
      ]
    });
  }

  return feedback;
}

export {
  evaluateQuality,
  evaluateWithOverall,
  meetsQualityThreshold,
  getQualityFeedback,
  computeOverall
};
