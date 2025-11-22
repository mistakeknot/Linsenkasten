/**
 * Iterative Refinement Module
 *
 * Implements quality-gated iterative improvement of lens applications.
 * Based on Sequential Thinking pattern: reflect → improve → validate → repeat.
 *
 * Process:
 * 1. Apply lens → generate initial beliefs
 * 2. Evaluate quality
 * 3. If quality < threshold → refine with more evidence/specificity
 * 4. Re-evaluate
 * 5. Repeat max 3 iterations or until threshold met
 *
 * Stops when:
 * - Quality threshold reached (default: 0.7)
 * - Max iterations reached (default: 3)
 * - No improvement between iterations
 */

import { evaluateWithOverall, meetsQualityThreshold, getQualityFeedback } from './quality-evaluation.js';
import { generateBeliefStatements, extractProblemSignals } from './belief-statements.js';

/**
 * Refine lens application iteratively until quality threshold met
 *
 * @param {Object} params - Refinement parameters
 * @param {string} params.lens - Lens name
 * @param {string} params.problem_context - Problem description
 * @param {Object} params.lens_definition - Full lens metadata
 * @param {number} params.quality_threshold - Min acceptable quality (default: 0.7)
 * @param {number} params.max_iterations - Max refinement attempts (default: 3)
 * @returns {Object} Refined application with quality scores and iteration history
 */
function refineApplication({
  lens,
  problem_context,
  lens_definition,
  quality_threshold = 0.7,
  max_iterations = 3
}) {
  const iterations = [];
  let currentApplication = null;
  let currentQuality = null;

  // Initial application
  const initialBeliefs = generateBeliefStatements(lens, problem_context, lens_definition);
  currentApplication = {
    lens,
    belief_statements: initialBeliefs,
    problem_context
  };

  currentQuality = evaluateWithOverall(currentApplication);

  iterations.push({
    iteration: 1,
    belief_statements: initialBeliefs,
    quality: currentQuality,
    action: 'initial_generation'
  });

  // Check if initial quality is acceptable
  if (meetsQualityThreshold(currentQuality, quality_threshold)) {
    return {
      lens,
      belief_statements: initialBeliefs,
      quality: currentQuality,
      iterations_taken: 1,
      iterations_history: iterations,
      threshold_met: true
    };
  }

  // Iterative refinement
  for (let i = 2; i <= max_iterations; i++) {
    // Get feedback for improvement
    const feedback = getQualityFeedback(currentQuality);

    if (feedback.length === 0) {
      // No clear feedback, stop iterating
      break;
    }

    // Apply refinements
    const refinedBeliefs = applyRefinements(
      currentApplication.belief_statements,
      feedback,
      problem_context
    );

    // Re-evaluate
    const refinedApplication = {
      lens,
      belief_statements: refinedBeliefs,
      problem_context
    };

    const refinedQuality = evaluateWithOverall(refinedApplication);

    iterations.push({
      iteration: i,
      belief_statements: refinedBeliefs,
      quality: refinedQuality,
      action: `refined_based_on_${feedback.map(f => f.dimension).join('_')}`,
      feedback_applied: feedback
    });

    // Check for improvement
    const improvement = refinedQuality.overall - currentQuality.overall;

    if (improvement <= 0.01) {
      // No meaningful improvement, stop
      break;
    }

    // Update current
    currentApplication = refinedApplication;
    currentQuality = refinedQuality;

    // Check if threshold met
    if (meetsQualityThreshold(currentQuality, quality_threshold)) {
      return {
        lens,
        belief_statements: refinedBeliefs,
        quality: currentQuality,
        iterations_taken: i,
        iterations_history: iterations,
        threshold_met: true
      };
    }
  }

  // Max iterations reached without meeting threshold
  return {
    lens,
    belief_statements: currentApplication.belief_statements,
    quality: currentQuality,
    iterations_taken: iterations.length,
    iterations_history: iterations,
    threshold_met: false
  };
}

/**
 * Apply refinements based on quality feedback
 */
function applyRefinements(beliefs, feedback, problemContext) {
  const refinedBeliefs = beliefs.map(belief => {
    let refined = { ...belief };

    feedback.forEach(fb => {
      switch (fb.dimension) {
        case 'specificity':
          refined = addSpecificity(refined, problemContext);
          break;
        case 'novelty':
          refined = enhanceNovelty(refined);
          break;
        case 'actionability':
          refined = improveActionability(refined);
          break;
        case 'coherence':
          refined = strengthenCoherence(refined);
          break;
      }
    });

    return refined;
  });

  return refinedBeliefs;
}

/**
 * Add specificity to belief
 */
function addSpecificity(belief, problemContext) {
  const signals = extractProblemSignals(problemContext);
  const refined = { ...belief };

  // Add numbers from problem context if not present
  if (signals.numbers.length > 0 && !/\d+/.test(refined.belief)) {
    // Reference specific numbers
    const example = signals.numbers[0];
    if (!refined.evidence.includes(example)) {
      refined.evidence = `${refined.evidence} (e.g., ${example})`;
    }
  }

  // Make implications more specific
  if (refined.implications && refined.implications.length > 0) {
    refined.implications = refined.implications.map(imp => {
      // Add measurement/timeline if missing
      if (!/measure|metric|week|month|day/.test(imp)) {
        // Add measurement suggestion
        return `${imp} (measure impact before/after)`;
      }
      return imp;
    });
  }

  // Add specificity markers to reasoning
  if (refined.reasoning && !/specific|concrete|particular/.test(refined.reasoning)) {
    refined.reasoning = `Specifically: ${refined.reasoning}`;
  }

  return refined;
}

/**
 * Enhance novelty of belief
 */
function enhanceNovelty(belief) {
  const refined = { ...belief };

  // Add reframing language if not present
  if (!/isn't|not about|actually|real|root/.test(refined.belief)) {
    refined.belief = `The real issue: ${refined.belief}`;
  }

  // Add structural/systemic framing
  if (!/layer|structure|system|pattern/.test(refined.reasoning)) {
    refined.reasoning = `${refined.reasoning}. This is a structural pattern, not an isolated incident.`;
  }

  return refined;
}

/**
 * Improve actionability of belief
 */
function improveActionability(belief) {
  const refined = { ...belief };

  // Ensure implications start with action verbs
  if (refined.implications && refined.implications.length > 0) {
    refined.implications = refined.implications.map(imp => {
      const actionVerbs = ['identify', 'measure', 'test', 'build', 'examine', 'profile', 'validate', 'check'];
      const startsWithAction = actionVerbs.some(verb =>
        imp.toLowerCase().startsWith(verb)
      );

      if (!startsWithAction) {
        // Prepend appropriate action verb
        if (/data|metric|number/.test(imp.toLowerCase())) {
          return `Measure: ${imp}`;
        } else if (/layer|structure|system/.test(imp.toLowerCase())) {
          return `Examine: ${imp}`;
        } else {
          return `Identify: ${imp}`;
        }
      }

      return imp;
    });

    // Add at least one validation step
    const hasValidation = refined.implications.some(imp =>
      /validate|test|verify|confirm|measure/.test(imp.toLowerCase())
    );

    if (!hasValidation && refined.implications.length < 5) {
      refined.implications.push('Validate hypothesis with small experiment before full implementation');
    }
  }

  return refined;
}

/**
 * Strengthen coherence of belief
 */
function strengthenCoherence(belief) {
  const refined = { ...belief };

  // Add logical connector to reasoning if missing
  if (!/because|since|therefore|thus|given/.test(refined.reasoning)) {
    refined.reasoning = `Because ${refined.reasoning.toLowerCase()}`;
  }

  // Ensure evidence supports belief
  if (refined.evidence && !refined.reasoning.toLowerCase().includes(refined.evidence.toLowerCase().substring(0, 20))) {
    refined.reasoning = `${refined.reasoning} (Evidence: ${refined.evidence})`;
  }

  // Add confidence justification if high confidence
  if (refined.confidence >= 0.75 && !/strong|clear|multiple|consistent/.test(refined.reasoning)) {
    refined.reasoning = `${refined.reasoning}. Multiple signals support this conclusion.`;
  }

  return refined;
}

/**
 * Batch refine multiple lens applications
 *
 * @param {Array} applications - Multiple lens applications
 * @param {Object} options - Refinement options
 * @returns {Array} Refined applications
 */
function batchRefine(applications, options = {}) {
  return applications.map(app =>
    refineApplication({
      lens: app.lens,
      problem_context: app.problem_context,
      lens_definition: app.lens_definition,
      ...options
    })
  );
}

/**
 * Get refinement summary
 *
 * @param {Object} refinementResult - Result from refineApplication
 * @returns {Object} Human-readable summary
 */
function getRefinementSummary(refinementResult) {
  const {
    lens,
    quality,
    iterations_taken,
    threshold_met,
    iterations_history
  } = refinementResult;

  const initialQuality = iterations_history[0]?.quality?.overall || 0;
  const finalQuality = quality.overall;
  const improvement = finalQuality - initialQuality;

  return {
    lens,
    iterations_taken,
    threshold_met,
    initial_quality: initialQuality.toFixed(2),
    final_quality: finalQuality.toFixed(2),
    improvement: improvement.toFixed(2),
    improvement_percentage: ((improvement / initialQuality) * 100).toFixed(1) + '%',
    quality_breakdown: quality,
    message: threshold_met ?
      `✅ Quality threshold met after ${iterations_taken} iteration(s)` :
      `⚠️ Quality threshold not met after ${iterations_taken} iteration(s) (final: ${finalQuality.toFixed(2)})`
  };
}

export {
  refineApplication,
  batchRefine,
  getRefinementSummary
};
