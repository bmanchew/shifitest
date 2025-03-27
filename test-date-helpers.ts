// Import the date helpers to test
import { sortByDateDesc } from './server/utils/dateHelpers';

// Test data with createdAt dates
const testData = [
  { id: 1, createdAt: new Date('2023-01-01') },
  { id: 2, createdAt: new Date('2023-03-15') },
  { id: 3, createdAt: new Date('2023-02-10') },
  { id: 4, createdAt: null as Date | null },
  { id: 5, createdAt: new Date('2023-04-20') }
];

// Sort the data using our function
const sortedData = [...testData].sort(sortByDateDesc);

// Print results
console.log("Original data:");
console.log(testData.map(item => `ID: ${item.id}, Date: ${item.createdAt}`));
console.log("\nSorted data (newest first):");
console.log(sortedData.map(item => `ID: ${item.id}, Date: ${item.createdAt}`));