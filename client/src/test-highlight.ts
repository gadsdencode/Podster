// Test script for the highlightText function
import { highlightText, type KeywordHighlight } from "./lib/keyword-analyzer";

// Sample text
const text = "This is some sample text about decaf coffee and other topics.";

// Sample keywords
const keywords: KeywordHighlight[] = [
  {
    keyword: "decaf coffee",
    category: "concept",
    confidence: 0.85,
    positions: [
      {
        start: 29,
        end: 41
      }
    ]
  }
];

// Run test
const highlighted = highlightText(text, keywords);
console.log("Original text:", text);
console.log("Highlighted text:", highlighted);

// Check if it's working properly
const expectedPattern = 'title="concept (85% confidence)">decaf coffee</span>';
console.log("Contains expected pattern:", highlighted.includes(expectedPattern));

// Display the actual HTML that would be rendered
console.log("\nActual HTML (inspect for proper attribute rendering):");
console.log(highlighted);

// Export to show in browser
export const testOutput = {
  original: text,
  highlighted: highlighted
}; 