import { analyzeKeywords, type KeywordHighlight } from "./lib/keyword-analyzer";

// Test transcript with technical, concept, and controversial terms - made longer to test full analysis
const testTranscript = `
In this episode, we discuss machine learning and neural networks in the context of artificial intelligence development. 
John Smith explains how deep learning algorithms work and their applications in natural language processing. 
We also cover React components, TypeScript interfaces, and modern web development practices.
The conversation touches on database optimization, API design patterns, and cloud computing infrastructure.

We also explore controversial topics like DEI initiatives in tech companies, climate change policies, 
and the debate around socialism versus capitalism in economic systems. The discussion includes 
perspectives on diversity equity inclusion programs and their effectiveness in the workplace.

Moving into the technical deep dive, we examine microservices architecture and containerization with Docker.
The speakers discuss Kubernetes orchestration, DevOps practices, and continuous integration pipelines.
There's extensive coverage of frontend frameworks including Angular, Vue.js, and the React ecosystem.
Backend technologies like Node.js, Python Flask, and Java Spring Boot are also analyzed.

The conversation shifts to data science topics including pandas, NumPy, and scikit-learn libraries.
Machine learning models, neural network architectures, and deep learning frameworks like TensorFlow and PyTorch
are discussed in detail. The speakers cover supervised learning, unsupervised learning, and reinforcement learning.

Security considerations include OAuth authentication, JWT tokens, and encryption protocols.
The discussion covers cybersecurity threats, penetration testing, and vulnerability assessments.
Network security, firewalls, and intrusion detection systems are also examined.

Cloud platforms like AWS, Azure, and Google Cloud Platform are compared in terms of services and pricing.
Serverless computing, lambda functions, and edge computing concepts are explored.
The speakers discuss scalability patterns, load balancing, and distributed systems architecture.

Database technologies range from traditional SQL databases like PostgreSQL and MySQL
to NoSQL solutions including MongoDB, Cassandra, and Redis for caching.
Data warehousing, ETL processes, and big data analytics with Apache Spark are covered.

The episode concludes with discussions about emerging technologies including blockchain,
cryptocurrency, quantum computing, and artificial general intelligence.
Ethical considerations around AI bias, privacy concerns, and the future of work are debated.
`;

// Test function for complete transcript analysis
export async function testCompleteTranscriptAnalysis() {
  try {
    console.log("Testing complete transcript analysis with enhanced coverage...");
    console.log(`Test transcript length: ${testTranscript.length} characters`);
    
    // Test with enhanced analysis (default behavior)
    const enhancedResult = await analyzeKeywords(testTranscript, (status, progress) => {
      console.log(`Progress: ${progress}% - ${status}`);
    });
    
    console.log("Complete Analysis Results:");
    console.log("Total keywords:", enhancedResult.keywords.length);
    
    // Check analysis metadata
    if (enhancedResult.analysisMetadata) {
      console.log("Analysis Metadata:", enhancedResult.analysisMetadata);
      console.log("AI Analysis Succeeded:", enhancedResult.analysisMetadata.aiAnalysisSucceeded);
      console.log("Analysis Method:", enhancedResult.analysisMetadata.analysisMethod);
      console.log("Transcript Length:", enhancedResult.analysisMetadata.transcriptLength);
      console.log("Chunks Processed:", enhancedResult.analysisMetadata.chunksProcessed);
      console.log("Total Chunks:", enhancedResult.analysisMetadata.totalChunks);
      console.log("Coverage:", enhancedResult.analysisMetadata.coverage ? 
        `${Math.round(enhancedResult.analysisMetadata.coverage * 100)}%` : 'Unknown');
      console.log("Analysis Strategy:", enhancedResult.analysisMetadata.analysisStrategy);
    }
    
    // Check for different types of keywords
    const technicalKeywords = enhancedResult.keywords.filter(k => k.category === 'technical');
    const conceptKeywords = enhancedResult.keywords.filter(k => k.category === 'concept');
    const nameKeywords = enhancedResult.keywords.filter(k => k.category === 'name');
    const keywordsWithDefinitions = enhancedResult.keywords.filter(k => k.definition);
    const balancedDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'balanced');
    const factualDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'factual');
    const biographicalDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'biographical');
    
    console.log("Technical keywords:", technicalKeywords.length);
    console.log("Concept keywords:", conceptKeywords.length);
    console.log("Name keywords:", nameKeywords.length);
    console.log("Keywords with AI definitions:", keywordsWithDefinitions.length);
    console.log("Balanced definitions (controversial topics):", balancedDefinitions.length);
    console.log("Factual definitions (technical terms):", factualDefinitions.length);
    console.log("Biographical definitions (people):", biographicalDefinitions.length);
    
    // Test keyword distribution throughout transcript
    console.log("\nTesting keyword distribution throughout transcript:");
    const transcriptSections = [
      { name: "Beginning (0-25%)", start: 0, end: Math.floor(testTranscript.length * 0.25) },
      { name: "Early Middle (25-50%)", start: Math.floor(testTranscript.length * 0.25), end: Math.floor(testTranscript.length * 0.5) },
      { name: "Late Middle (50-75%)", start: Math.floor(testTranscript.length * 0.5), end: Math.floor(testTranscript.length * 0.75) },
      { name: "End (75-100%)", start: Math.floor(testTranscript.length * 0.75), end: testTranscript.length }
    ];
    
    transcriptSections.forEach(section => {
      const keywordsInSection = enhancedResult.keywords.filter(keyword => 
        keyword.positions.some(pos => pos.start >= section.start && pos.start < section.end)
      );
      console.log(`${section.name}: ${keywordsInSection.length} keywords found`);
    });
    
    // Check for specific keywords that should be found throughout
    const expectedKeywords = [
      'machine learning', 'React', 'Docker', 'AWS', 'PostgreSQL', 'blockchain'
    ];
    
    console.log("\nChecking for expected keywords throughout transcript:");
    expectedKeywords.forEach(expected => {
      const found = enhancedResult.keywords.find(k => 
        k.keyword.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(k.keyword.toLowerCase())
      );
      console.log(`${expected}: ${found ? '✅ Found' : '❌ Not found'}`);
    });
    
    // Validation
    const hasGoodCoverage = enhancedResult.analysisMetadata?.coverage ? 
      enhancedResult.analysisMetadata.coverage > 0.8 : false;
    const hasKeywordsFromAllSections = transcriptSections.every(section => {
      const keywordsInSection = enhancedResult.keywords.filter(keyword => 
        keyword.positions.some(pos => pos.start >= section.start && pos.start < section.end)
      );
      return keywordsInSection.length > 0;
    });
    
    console.log("\n--- Complete Analysis Test Results ---");
    console.log("✅ Has substantial keyword count:", enhancedResult.keywords.length > 20);
    console.log("✅ Good transcript coverage:", hasGoodCoverage);
    console.log("✅ Keywords found in all sections:", hasKeywordsFromAllSections);
    console.log("✅ AI analysis succeeded:", enhancedResult.analysisMetadata?.aiAnalysisSucceeded || false);
    console.log("✅ Has balanced definitions:", balancedDefinitions.length > 0);
    console.log("✅ Has factual definitions:", factualDefinitions.length > 0);
    
    return {
      result: enhancedResult,
      success: hasGoodCoverage && hasKeywordsFromAllSections && enhancedResult.keywords.length > 20,
      coverage: enhancedResult.analysisMetadata?.coverage || 0,
      keywordDistribution: transcriptSections.map(section => ({
        section: section.name,
        keywordCount: enhancedResult.keywords.filter(keyword => 
          keyword.positions.some(pos => pos.start >= section.start && pos.start < section.end)
        ).length
      }))
    };
    
  } catch (error) {
    console.error("Complete analysis test failed:", error);
    return { success: false, error };
  }
}

// Test very long transcript handling
export async function testVeryLongTranscript() {
  // Create a very long transcript by repeating the test content
  const longTranscript = testTranscript.repeat(10); // ~20k characters
  
  console.log("Testing very long transcript analysis...");
  console.log(`Long transcript length: ${longTranscript.length} characters`);
  
  try {
    const result = await analyzeKeywords(longTranscript, (status, progress) => {
      console.log(`Long transcript progress: ${progress}% - ${status}`);
    });
    
    console.log("Long Transcript Results:");
    console.log("Keywords found:", result.keywords.length);
    console.log("Coverage:", result.analysisMetadata?.coverage ? 
      `${Math.round(result.analysisMetadata.coverage * 100)}%` : 'Unknown');
    console.log("Analysis strategy:", result.analysisMetadata?.analysisStrategy);
    
    return {
      success: result.keywords.length > 0,
      strategy: result.analysisMetadata?.analysisStrategy,
      coverage: result.analysisMetadata?.coverage
    };
  } catch (error) {
    console.error("Long transcript test failed:", error);
    return { success: false, error };
  }
}

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
    const nameKeywords = enhancedResult.keywords.filter(k => k.category === 'name');
    const keywordsWithDefinitions = enhancedResult.keywords.filter(k => k.definition);
    const balancedDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'balanced');
    const factualDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'factual');
    const biographicalDefinitions = enhancedResult.keywords.filter(k => k.definitionType === 'biographical');
    
    console.log("Technical keywords:", technicalKeywords.length);
    console.log("Concept keywords:", conceptKeywords.length);
    console.log("Name keywords:", nameKeywords.length);
    console.log("Keywords with AI definitions:", keywordsWithDefinitions.length);
    console.log("Balanced definitions (controversial topics):", balancedDefinitions.length);
    console.log("Factual definitions (technical terms):", factualDefinitions.length);
    console.log("Biographical definitions (people):", biographicalDefinitions.length);
    
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

    // Display examples of biographical definitions
    console.log("\nExamples of BIOGRAPHICAL definitions (people):");
    biographicalDefinitions.slice(0, 3).forEach(keyword => {
      console.log(`- ${keyword.keyword} (${keyword.category}): ${keyword.definition}`);
      
      // Check if definition provides specific information about the person
      const hasSpecificInfo = keyword.definition && 
                             !keyword.definition.includes('Person, company, or proper noun') &&
                             !keyword.definition.includes('Unable to retrieve') &&
                             keyword.definition.length > 30;
      
      if (hasSpecificInfo) {
        console.log(`  ✅ Good: This provides specific information about the person`);
      } else {
        console.warn(`  ⚠️ WARNING: This may not provide adequate detail about the person!`);
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
    const hasBiographicalDefinitions = biographicalDefinitions.length > 0;
    
    console.log("\n--- Test Results ---");
    console.log("✅ Has keywords with definitions:", keywordsWithDefinitions.length > 0);
    console.log("✅ Definitions are substantial:", hasProperDefinitions);
    console.log("✅ Has balanced definitions for controversial topics:", hasBalancedDefinitions);
    console.log("✅ Has factual definitions for technical terms:", hasFactualDefinitions);
    console.log("✅ Has biographical definitions for people:", hasBiographicalDefinitions);
    console.log("✅ AI analysis succeeded:", enhancedResult.analysisMetadata?.aiAnalysisSucceeded || false);
    
    return {
      enhanced: enhancedResult,
      basic: basicResult,
      success: hasProperDefinitions && hasBalancedDefinitions && hasBiographicalDefinitions,
      aiSucceeded: enhancedResult.analysisMetadata?.aiAnalysisSucceeded || false,
      balancedCount: balancedDefinitions.length,
      factualCount: factualDefinitions.length,
      biographicalCount: biographicalDefinitions.length
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
      positions: [{ start: 40, end: 50 }],
      definition: "John Smith is a software engineer and AI researcher mentioned as the lead developer of the machine learning framework discussed in this episode.",
      definitionType: "biographical"
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

// Test person identification specifically
export async function testPersonIdentification() {
  const testTranscriptWithPeople = `
In this episode, we interview Elon Musk about his work at Tesla and SpaceX. 
John Smith, the lead engineer at OpenAI, discusses machine learning advances.
We also hear from Sarah Johnson, a data scientist at Google, about neural networks.
The conversation includes insights from Tim Cook regarding Apple's AI strategy.
Mark Zuckerberg shares his thoughts on the metaverse and virtual reality.
`;

  try {
    console.log("Testing person identification with biographical definitions...");
    
    const result = await analyzeKeywords(testTranscriptWithPeople, (status, progress) => {
      console.log(`Person ID Progress: ${progress}% - ${status}`);
    });
    
    const nameKeywords = result.keywords.filter(k => k.category === 'name');
    const biographicalDefinitions = result.keywords.filter(k => k.definitionType === 'biographical');
    
    console.log("Person Identification Results:");
    console.log("Names found:", nameKeywords.length);
    console.log("Biographical definitions:", biographicalDefinitions.length);
    
    // Check each person found
    console.log("\nPeople identified:");
    nameKeywords.forEach(person => {
      console.log(`- ${person.keyword}:`);
      if (person.definition) {
        console.log(`  Definition: ${person.definition}`);
        console.log(`  Type: ${person.definitionType}`);
        
        // Check if it's a proper biographical definition
        const isGeneric = person.definition.includes('Person, company, or proper noun') ||
                         person.definition.includes('Unable to retrieve');
        
        if (isGeneric) {
          console.warn(`  ⚠️ WARNING: Generic definition - not specific enough!`);
        } else {
          console.log(`  ✅ Good: Specific biographical information provided`);
        }
      } else {
        console.warn(`  ❌ No definition generated`);
      }
    });
    
    // Expected people in the test transcript
    const expectedPeople = ['Elon Musk', 'John Smith', 'Sarah Johnson', 'Tim Cook', 'Mark Zuckerberg'];
    
    console.log("\nExpected vs Found:");
    expectedPeople.forEach(expected => {
      const found = nameKeywords.find(k => 
        k.keyword.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(k.keyword.toLowerCase())
      );
      console.log(`${expected}: ${found ? '✅ Found' : '❌ Not found'}`);
    });
    
    const success = nameKeywords.length > 0 && 
                   biographicalDefinitions.length > 0 &&
                   biographicalDefinitions.some(p => 
                     p.definition && 
                     !p.definition.includes('Person, company, or proper noun') &&
                     p.definition.length > 30
                   );
    
    console.log("\n--- Person Identification Test Results ---");
    console.log("✅ Names identified:", nameKeywords.length > 0);
    console.log("✅ Biographical definitions generated:", biographicalDefinitions.length > 0);
    console.log("✅ Specific (non-generic) definitions:", success);
    
    return {
      success,
      namesFound: nameKeywords.length,
      biographicalDefinitions: biographicalDefinitions.length,
      people: nameKeywords
    };
    
  } catch (error) {
    console.error("Person identification test failed:", error);
    return { success: false, error };
  }
}

// Test function for optimized analysis performance
export async function testOptimizedAnalysis() {
  try {
    console.log("Testing optimized AI analysis with improved chunking and parallel processing...");
    
    const startTime = Date.now();
    const result = await analyzeKeywords(testTranscript, (status, progress) => {
      console.log(`Optimized Progress: ${progress}% - ${status}`);
    });
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log("Optimized Analysis Results:");
    console.log("Total keywords:", result.keywords.length);
    console.log("Processing time:", `${processingTime}ms`);
    
    // Check analysis metadata for optimization metrics
    if (result.analysisMetadata) {
      console.log("Optimization Metadata:", result.analysisMetadata);
      console.log("AI Analysis Succeeded:", result.analysisMetadata.aiAnalysisSucceeded);
      console.log("Coverage:", result.analysisMetadata.coverage ? 
        `${Math.round(result.analysisMetadata.coverage * 100)}%` : 'Unknown');
      console.log("Failed Chunks:", result.analysisMetadata.failedChunks || 0);
      console.log("Analysis Strategy:", result.analysisMetadata.analysisStrategy);
      
      // Test coverage quality
      const coverage = result.analysisMetadata.coverage || 0;
      const failedChunks = result.analysisMetadata.failedChunks || 0;
      
      console.log("\n--- Optimization Test Results ---");
      console.log("✅ High coverage achieved:", coverage >= 0.9);
      console.log("✅ Low failure rate:", failedChunks <= 1);
      console.log("✅ Reasonable processing time:", processingTime < 180000); // Under 3 minutes
      console.log("✅ AI analysis succeeded:", result.analysisMetadata.aiAnalysisSucceeded);
      
      return {
        success: coverage >= 0.8 && result.analysisMetadata.aiAnalysisSucceeded,
        coverage,
        failedChunks,
        processingTime,
        aiSucceeded: result.analysisMetadata.aiAnalysisSucceeded
      };
    }
    
    return { success: false, error: "No metadata available" };
    
  } catch (error) {
    console.error("Optimized analysis test failed:", error);
    return { success: false, error };
  }
}

// Test timeout handling and partial results
export async function testTimeoutHandling() {
  // Create a very long transcript to test timeout scenarios
  const veryLongTranscript = testTranscript.repeat(20); // ~40k characters
  
  console.log("Testing timeout handling and partial results...");
  console.log(`Very long transcript length: ${veryLongTranscript.length} characters`);
  
  try {
    // Use a shorter timeout to test timeout handling
    const result = await analyzeKeywords(veryLongTranscript, (status, progress) => {
      console.log(`Timeout test progress: ${progress}% - ${status}`);
    }, 30000); // 30 second timeout
    
    console.log("Timeout Test Results:");
    console.log("Keywords found:", result.keywords.length);
    
    if (result.analysisMetadata) {
      console.log("Coverage achieved:", result.analysisMetadata.coverage ? 
        `${Math.round(result.analysisMetadata.coverage * 100)}%` : 'Unknown');
      console.log("Analysis method:", result.analysisMetadata.analysisMethod);
      
      // Even with timeout, we should get some results
      const hasResults = result.keywords.length > 0;
      const hasPartialCoverage = result.analysisMetadata.coverage && result.analysisMetadata.coverage > 0;
      
      console.log("\n--- Timeout Handling Test Results ---");
      console.log("✅ Got results despite timeout:", hasResults);
      console.log("✅ Has partial coverage info:", hasPartialCoverage);
      console.log("✅ Graceful degradation:", result.analysisMetadata.analysisMethod !== undefined);
      
      return {
        success: hasResults,
        coverage: result.analysisMetadata.coverage || 0,
        method: result.analysisMetadata.analysisMethod
      };
    }
    
    return { success: result.keywords.length > 0 };
    
  } catch (error) {
    console.error("Timeout handling test failed:", error);
    return { success: false, error };
  }
}

// Test function for keyword quality control
export async function testKeywordQualityControl() {
  try {
    console.log("Testing keyword quality control to prevent single characters and meaningless terms...");
    
    // Create a test transcript that might produce low-quality keywords
    const testTranscriptWithNoise = `
In this episode, we discuss machine learning and AI. The speaker mentions React, a popular JavaScript framework.
John Smith explains how APIs work. We also cover database optimization and cloud computing.
The conversation includes words like: a, b, c, the, and, or, but, is, it, be, do, go.
Technical terms include: HTTP, JSON, SQL, Docker, Kubernetes, TypeScript.
People mentioned: Sarah Johnson, Tim Cook, Elon Musk.
Concepts covered: scalability, performance, security, optimization.
`;
    
    console.log(`Test transcript length: ${testTranscriptWithNoise.length} characters`);
    
    const result = await analyzeKeywords(testTranscriptWithNoise, (status, progress) => {
      console.log(`Quality test progress: ${progress}% - ${status}`);
    });
    
    console.log("Quality Control Test Results:");
    console.log("Total keywords found:", result.keywords.length);
    
    // Check for quality issues
    const qualityIssues = {
      singleCharacters: result.keywords.filter(k => k.keyword.length === 1),
      twoCharacters: result.keywords.filter(k => k.keyword.length === 2 && k.category !== 'name'),
      stopWords: result.keywords.filter(k => {
        const stopWords = ['the', 'and', 'or', 'but', 'is', 'it', 'be', 'do', 'go', 'a', 'an'];
        return stopWords.includes(k.keyword.toLowerCase());
      }),
      lowConfidence: result.keywords.filter(k => k.confidence < 0.3),
      purelyNumeric: result.keywords.filter(k => /^\d+$/.test(k.keyword)),
      meaninglessFragments: result.keywords.filter(k => {
        const meaningless = ['m', 'n', 'x', 'y', 'z', 'i', 'o', 'u'];
        return meaningless.includes(k.keyword.toLowerCase());
      })
    };
    
    console.log("\n--- Quality Issues Found ---");
    console.log("Single characters:", qualityIssues.singleCharacters.length);
    if (qualityIssues.singleCharacters.length > 0) {
      console.log("  Examples:", qualityIssues.singleCharacters.map(k => k.keyword).slice(0, 5));
    }
    
    console.log("Two characters (non-names):", qualityIssues.twoCharacters.length);
    if (qualityIssues.twoCharacters.length > 0) {
      console.log("  Examples:", qualityIssues.twoCharacters.map(k => k.keyword).slice(0, 5));
    }
    
    console.log("Stop words:", qualityIssues.stopWords.length);
    if (qualityIssues.stopWords.length > 0) {
      console.log("  Examples:", qualityIssues.stopWords.map(k => k.keyword).slice(0, 5));
    }
    
    console.log("Low confidence (<0.3):", qualityIssues.lowConfidence.length);
    console.log("Purely numeric:", qualityIssues.purelyNumeric.length);
    console.log("Meaningless fragments:", qualityIssues.meaninglessFragments.length);
    
    // Check for good quality keywords
    const goodKeywords = {
      technical: result.keywords.filter(k => k.category === 'technical'),
      names: result.keywords.filter(k => k.category === 'name'),
      concepts: result.keywords.filter(k => k.category === 'concept'),
      withDefinitions: result.keywords.filter(k => k.definition),
      highConfidence: result.keywords.filter(k => k.confidence >= 0.7)
    };
    
    console.log("\n--- Quality Keywords Found ---");
    console.log("Technical terms:", goodKeywords.technical.length);
    if (goodKeywords.technical.length > 0) {
      console.log("  Examples:", goodKeywords.technical.map(k => k.keyword).slice(0, 5));
    }
    
    console.log("Names:", goodKeywords.names.length);
    if (goodKeywords.names.length > 0) {
      console.log("  Examples:", goodKeywords.names.map(k => k.keyword).slice(0, 3));
    }
    
    console.log("Concepts:", goodKeywords.concepts.length);
    if (goodKeywords.concepts.length > 0) {
      console.log("  Examples:", goodKeywords.concepts.map(k => k.keyword).slice(0, 3));
    }
    
    console.log("With definitions:", goodKeywords.withDefinitions.length);
    console.log("High confidence (≥0.7):", goodKeywords.highConfidence.length);
    
    // Validation criteria
    const hasNoSingleCharacters = qualityIssues.singleCharacters.length === 0;
    const hasNoStopWords = qualityIssues.stopWords.length === 0;
    const hasNoMeaninglessFragments = qualityIssues.meaninglessFragments.length === 0;
    const hasGoodKeywords = goodKeywords.technical.length > 0 || goodKeywords.names.length > 0;
    const hasMinimumQuality = qualityIssues.lowConfidence.length < result.keywords.length * 0.3; // Less than 30% low confidence
    
    console.log("\n--- Quality Control Test Results ---");
    console.log("✅ No single characters:", hasNoSingleCharacters);
    console.log("✅ No stop words:", hasNoStopWords);
    console.log("✅ No meaningless fragments:", hasNoMeaninglessFragments);
    console.log("✅ Has quality keywords:", hasGoodKeywords);
    console.log("✅ Minimum quality threshold:", hasMinimumQuality);
    
    const overallSuccess = hasNoSingleCharacters && hasNoStopWords && hasNoMeaninglessFragments && hasGoodKeywords && hasMinimumQuality;
    
    console.log("🎯 Overall Quality Control:", overallSuccess ? "PASSED" : "FAILED");
    
    if (!overallSuccess) {
      console.warn("⚠️ Quality control issues detected! The system may still be highlighting low-quality keywords.");
    } else {
      console.log("✅ Quality control working properly - only meaningful keywords are highlighted!");
    }
    
    return {
      success: overallSuccess,
      qualityIssues,
      goodKeywords,
      totalKeywords: result.keywords.length,
      aiSucceeded: result.analysisMetadata?.aiAnalysisSucceeded || false
    };
    
  } catch (error) {
    console.error("Quality control test failed:", error);
    return { success: false, error };
  }
}

// Test specific problematic cases
export async function testProblematicCases() {
  console.log("Testing specific problematic cases that should be filtered out...");
  
  const problematicTranscript = `
The letter m is important. We also discuss a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z.
Common words: the, and, or, but, is, it, be, do, go, we, me, he, she, his, her, him, you, your, my, our, us.
Numbers: 1, 2, 3, 4, 5, 123, 456, 789.
Special characters: @, #, $, %, ^, &, *, (, ), -, +, =, [, ], {, }, |, \\, :, ;, ", ', <, >, ,, ., ?, /, ~, \`.
But we also have good terms like machine learning, React, JavaScript, Docker, and John Smith.
`;
  
  try {
    const result = await analyzeKeywords(problematicTranscript, (status, progress) => {
      console.log(`Problematic cases test: ${progress}% - ${status}`);
    });
    
    console.log("Problematic Cases Test Results:");
    console.log("Keywords found:", result.keywords.length);
    
    // Check what got through
    const problematicKeywords = result.keywords.filter(k => {
      const keyword = k.keyword.toLowerCase();
      return keyword.length <= 2 || 
             /^[a-z]$/.test(keyword) || 
             ['the', 'and', 'or', 'but', 'is', 'it', 'be', 'do', 'go'].includes(keyword) ||
             /^\d+$/.test(keyword) ||
             /^[^a-zA-Z0-9\s]+$/.test(keyword);
    });
    
    const goodKeywords = result.keywords.filter(k => {
      const keyword = k.keyword.toLowerCase();
      return ['machine learning', 'react', 'javascript', 'docker', 'john smith'].some(good => 
        keyword.includes(good) || good.includes(keyword)
      );
    });
    
    console.log("Problematic keywords that got through:", problematicKeywords.length);
    if (problematicKeywords.length > 0) {
      console.log("  Examples:", problematicKeywords.map(k => `"${k.keyword}"`).slice(0, 10));
    }
    
    console.log("Good keywords found:", goodKeywords.length);
    if (goodKeywords.length > 0) {
      console.log("  Examples:", goodKeywords.map(k => `"${k.keyword}"`));
    }
    
    const success = problematicKeywords.length === 0 && goodKeywords.length > 0;
    
    console.log("🎯 Problematic Cases Test:", success ? "PASSED" : "FAILED");
    
    return {
      success,
      problematicCount: problematicKeywords.length,
      goodCount: goodKeywords.length,
      problematicKeywords: problematicKeywords.map(k => k.keyword),
      goodKeywords: goodKeywords.map(k => k.keyword)
    };
    
  } catch (error) {
    console.error("Problematic cases test failed:", error);
    return { success: false, error };
  }
}

// Make functions available in browser
if (typeof window !== 'undefined') {
  (window as any).testCompleteTranscriptAnalysis = testCompleteTranscriptAnalysis;
  (window as any).testVeryLongTranscript = testVeryLongTranscript;
  (window as any).testEnhancedAnalysis = testEnhancedAnalysis;
  (window as any).testPersonIdentification = testPersonIdentification;
  (window as any).testOptimizedAnalysis = testOptimizedAnalysis;
  (window as any).testTimeoutHandling = testTimeoutHandling;
  (window as any).testTooltipGeneration = testTooltipGeneration;
  (window as any).testControversialTermDetection = testControversialTermDetection;
  (window as any).testKeywordQualityControl = testKeywordQualityControl;
  (window as any).testProblematicCases = testProblematicCases;
  console.log("Complete transcript analysis tests available:");
  console.log("- window.testCompleteTranscriptAnalysis() - Test full transcript coverage");
  console.log("- window.testVeryLongTranscript() - Test very long transcript handling");
  console.log("- window.testEnhancedAnalysis() - Test balanced vs factual definitions");
  console.log("- window.testPersonIdentification() - Test biographical definitions for people");
  console.log("- window.testOptimizedAnalysis() - Test optimized chunking and parallel processing");
  console.log("- window.testTimeoutHandling() - Test timeout handling and partial results");
  console.log("- window.testTooltipGeneration() - Test tooltip content with definition types");
  console.log("- window.testControversialTermDetection() - Test controversial term detection");
  console.log("- window.testKeywordQualityControl() - Test keyword quality control");
  console.log("- window.testProblematicCases() - Test specific problematic cases");
} 