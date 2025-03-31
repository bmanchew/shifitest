
/**
 * Contract Helper Utilities
 * 
 * This module provides utility functions for handling contract-related operations,
 * such as ID validation, parsing, and manipulation. It ensures consistent handling
 * of contract IDs throughout the application, handling various input formats and
 * edge cases.
 * 
 * @module ContractHelpers
 */

/**
 * Safely parses and validates a contract ID from various input formats
 * 
 * This function handles contract IDs that might come from different sources (URL parameters,
 * JSON data, query strings) and ensures they're properly converted to a numeric format.
 * It includes comprehensive error handling and validation to prevent invalid IDs from
 * causing issues downstream.
 * 
 * @param contractId - The contract ID to validate and parse
 * @returns A valid number representing the contract ID, or null if the input is invalid or missing
 * 
 * @example
 * // Parse from a string (e.g., from URL params)
 * const id1 = validateContractId("123"); // Returns 123
 * 
 * // Handle numeric input
 * const id2 = validateContractId(456); // Returns 456
 * 
 * // Handle invalid input
 * const id3 = validateContractId("abc"); // Returns null
 * const id4 = validateContractId(null); // Returns null
 * const id5 = validateContractId(undefined); // Returns null
 * 
 * @throws Catches and logs any errors during parsing but doesn't propagate them
 */
export function validateContractId(contractId: string | number | undefined | null): number | null {
  if (contractId === undefined || contractId === null) {
    return null;
  }
  
  let contractIdNum: number;
  
  try {
    // Handle different input types properly
    if (typeof contractId === 'string') {
      contractIdNum = parseInt(contractId);
    } else if (typeof contractId === 'number') {
      contractIdNum = contractId;
    } else {
      contractIdNum = parseInt(String(contractId));
    }

    if (isNaN(contractIdNum)) {
      return null;
    }
    
    return contractIdNum;
  } catch (parseError) {
    console.error("Contract ID parse error:", parseError);
    return null;
  }
}
