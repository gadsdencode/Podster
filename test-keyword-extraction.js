// Test script to verify keyword extraction functionality
const testTranscript = `
Welcome to this tutorial on React hooks. Today we'll be learning about useState, useEffect, and custom hooks.
React is a JavaScript library for building user interfaces. It was created by Facebook and is now maintained by Meta.
We'll start with useState, which is the most basic hook for managing state in functional components.
Then we'll move on to useEffect, which handles side effects like API calls and subscriptions.
Finally, we'll create our own custom hooks to share logic between components.
`;

async function testKeywordExtraction() {
  try {
    console.log('Testing keyword extraction...');
    
    const response = await fetch('http://localhost:5000/api/analyze-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        transcript: testTranscript,
        includeDefinitions: true,
        includeInsights: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('Keyword extraction successful!');
    console.log('Keywords found:', result.keywords?.length || 0);
    console.log('Categories:', Object.keys(result.categories || {}));
    
    if (result.keywords && result.keywords.length > 0) {
      console.log('\nSample keywords:');
      result.keywords.slice(0, 5).forEach(kw => {
        console.log(`- ${kw.keyword} (${kw.category}, confidence: ${kw.confidence})`);
        if (kw.definition) {
          console.log(`  Definition: ${kw.definition.substring(0, 100)}...`);
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error testing keyword extraction:', error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testKeywordExtraction()
    .then(() => console.log('\nTest completed successfully!'))
    .catch(error => {
      console.error('\nTest failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testKeywordExtraction }; 