
/**
 * Helper functions for contract ID handling
 */

/**
 * Safely parses and validates a contract ID
 * @param contractId - The contract ID to validate (string, number, or undefined)
 * @returns - A valid number or null if invalid
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
