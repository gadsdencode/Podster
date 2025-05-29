import { analyzeKeywords, type KeywordHighlight } from "./lib/keyword-analyzer";

// Test transcript with technical, concept, and controversial terms
const testTranscript = `
In this episode, we discuss machine learning and neural networks in the context of artificial intelligence development. 
John Smith explains how deep learning algorithms work and their applications in natural language processing. 
We also cover React components, TypeScript interfaces, and modern web development practices.
The conversation touches on database optimization, API design patterns, and cloud computing infrastructure.

We also explore controversial topics like DEI initiatives in tech companies, climate change policies, 
and the debate around socialism versus capitalism in economic systems. The discussion includes 
perspectives on diversity equity inclusion programs and their effectiveness in the workplace.
`;

// Test function for enhanced analysis with controversial terms
export async function testEnhancedAnalysis() {
  try {
    console.log("Testing AI-powered keyword analysis with balanced definitions for controversial terms...");
    
    // Test with enhanced analysis (default behavior)
    const enhancedResult = await analyzeKeywords(testTranscript, (status, progress) => {
      console.log(`Progress: ${progress}% - ${status}`);
    });
    
    console.log("Enhanced Analysis Results:");
    console.log("Total keywords:", enhancedResult.keywords.length);
    
    // Check analysis metadata
    if (enhancedResult.analysisMetadata) {
      console.log("Analysis Metadata:", enhancedResult.analysisMetadata);
      console.log("AI Analysis Succeeded:", enhancedResult.analysisMetadata.aiAnalysisSucceeded);
      console.log("Analysis Method:", enhancedResult.analysisMetadata.analysisMethod);
    }
    
    // Check for different types of keywords
    const technicalKeywords = enhancedResult.keywords.filter(k => k.category === 'technical');
    const conceptKeywords = enhancedResult.keywords.filter(k => k.category === 'concept');
    const keywordsWithDefinitions = enhancedResult.keywords.filter(k => k.definition);
    const balancedDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'balanced');
    const factualDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'factual');
    
    console.log("Technical keywords:", technicalKeywords.length);
    console.log("Concept keywords:", conceptKeywords.length);
    console.log("Keywords with AI definitions:", keywordsWithDefinitions.length);
    console.log("Balanced definitions (controversial topics):", balancedDefinitions.length);
    console.log("Factual definitions (technical terms):", factualDefinitions.length);
    
    // Display examples of balanced definitions
    console.log("\nExamples of BALANCED definitions (controversial topics):");
    balancedDefinitions.slice(0, 3).forEach(keyword => {
      console.log(`- ${keyword.keyword} (${keyword.category}): ${keyword.definition}`);
      
      // Check if definition includes multiple perspectives
      const hasMultiplePerspectives = keyword.definition?.includes('supporters') || 
                                     keyword.definition?.includes('critics') ||
                                     keyword.definition?.includes('while') ||
                                     keyword.definition?.includes('however');
      
      if (hasMultiplePerspectives) {
        console.log(`  ✅ Good: This appears to present multiple perspectives`);
      } else {
        console.warn(`  ⚠️ WARNING: This may not be truly balanced!`);
      }
    });
    
    // Display examples of factual definitions
    console.log("\nExamples of FACTUAL definitions (technical terms):");
    factualDefinitions.slice(0, 3).forEach(keyword => {
      console.log(`- ${keyword.keyword} (${keyword.category}): ${keyword.definition}`);
      
      // Check if definition is factual (not frequency info)
      const isFrequencyInfo = keyword.definition?.includes('appears') || 
                             keyword.definition?.includes('frequency') ||
                             keyword.definition?.includes('times') ||
                             /\d+/.test(keyword.definition || ''); // Contains numbers
      
      if (isFrequencyInfo) {
        console.warn(`  ⚠️ WARNING: This looks like frequency information, not a definition!`);
      } else {
        console.log(`  ✅ Good: This appears to be a proper factual definition`);
      }
    });
    
    // Test basic analysis for comparison
    console.log("\n--- Testing basic analysis for comparison ---");
    const basicResult = await analyzeKeywords(testTranscript, undefined, 30000, {
      includeDefinitions: false,
      includeInsights: false
    });
    
    console.log("Basic Analysis Results:");
    console.log("Total keywords:", basicResult.keywords.length);
    console.log("Keywords with definitions:", basicResult.keywords.filter(k => k.definition).length);
    
    // Validation
    const hasProperDefinitions = keywordsWithDefinitions.length > 0 && 
                                keywordsWithDefinitions.some(k => 
                                  k.definition && 
                                  k.definition.length > 20 && 
                                  !k.definition.includes('frequency') &&
                                  !k.definition.includes('appears')
                                );
    
    const hasBalancedDefinitions = balancedDefinitions.length > 0;
    const hasFactualDefinitions = factualDefinitions.length > 0;
    
    console.log("\n--- Test Results ---");
    console.log("✅ Has keywords with definitions:", keywordsWithDefinitions.length > 0);
    console.log("✅ Definitions are substantial:", hasProperDefinitions);
    console.log("✅ Has balanced definitions for controversial topics:", hasBalancedDefinitions);
    console.log("✅ Has factual definitions for technical terms:", hasFactualDefinitions);
    console.log("✅ AI analysis succeeded:", enhancedResult.analysisMetadata?.aiAnalysisSucceeded || false);
    
    return {
      enhanced: enhancedResult,
      basic: basicResult,
      success: hasProperDefinitions && hasBalancedDefinitions,
      aiSucceeded: enhancedResult.analysisMetadata?.aiAnalysisSucceeded || false,
      balancedCount: balancedDefinitions.length,
      factualCount: factualDefinitions.length
    };
    
  } catch (error) {
    console.error("Test failed:", error);
    return { success: false, error, aiSucceeded: false };
  }
}

// Test tooltip generation with different definition types
export function testTooltipGeneration() {
  const sampleKeywords: KeywordHighlight[] = [
    {
      keyword: "machine learning",
      category: "technical",
      confidence: 0.95,
      positions: [{ start: 0, end: 16 }],
      definition: "A subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.",
      definitionType: "factual"
    },
    {
      keyword: "DEI",
      category: "concept",
      confidence: 0.88,
      positions: [{ start: 20, end: 23 }],
      definition: "A framework aimed at creating fair treatment and full participation for all people. Supporters argue it addresses systemic inequalities and promotes fairness, while critics contend it can lead to reverse discrimination and divisive identity politics.",
      definitionType: "balanced"
    },
    {
      keyword: "leadership",
      category: "concept",
      confidence: 0.82,
      positions: [{ start: 25, end: 35 }],
      definition: "The ability to guide, influence, and direct others toward achieving common goals.",
      definitionType: "descriptive"
    },
    {
      keyword: "John Smith",
      category: "name",
      confidence: 0.92,
      positions: [{ start: 40, end: 50 }]
      // Names don't get definitions
    }
  ];
  
  console.log("Sample keywords for tooltip testing with definition types:");
  sampleKeywords.forEach(keyword => {
    const defType = keyword.definitionType ? ` (${keyword.definitionType})` : '';
    console.log(`- ${keyword.keyword} (${keyword.category}${defType}): ${keyword.definition || 'No definition'}`);
  });
  
  return sampleKeywords;
}

// Test controversial term detection
export function testControversialTermDetection() {
  const testTerms = [
    'DEI', 'diversity equity inclusion', 'machine learning', 'climate change',
    'socialism', 'React', 'neural networks', 'capitalism', 'TypeScript',
    'critical race theory', 'API', 'feminism', 'database'
  ];
  
  console.log("Testing controversial term detection:");
  testTerms.forEach(term => {
    // This would need to be implemented in the backend, but we can simulate
    const controversial = ['DEI', 'diversity equity inclusion', 'climate change', 
                          'socialism', 'capitalism', 'critical race theory', 'feminism'];
    const isControversial = controversial.some(ct => 
      term.toLowerCase().includes(ct.toLowerCase()) || 
      ct.toLowerCase().includes(term.toLowerCase())
    );
    
    console.log(`- ${term}: ${isControversial ? '⚖️ Controversial (needs balanced definition)' : '📚 Standard (factual definition)'}`);
  });
}

// Make functions available in browser
if (typeof window !== 'undefined') {
  (window as any).testEnhancedAnalysis = testEnhancedAnalysis;
  (window as any).testTooltipGeneration = testTooltipGeneration;
  (window as any).testControversialTermDetection = testControversialTermDetection;
  console.log("Enhanced AI definition tests available:");
  console.log("- window.testEnhancedAnalysis() - Test balanced vs factual definitions");
  console.log("- window.testTooltipGeneration() - Test tooltip content with definition types");
  console.log("- window.testControversialTermDetection() - Test controversial term detection");
} 