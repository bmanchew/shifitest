/**
 * Fixed version of the getAllContracts method
 * Removes all instances of row.cancellation_requested_at
 */

// Inside getAllContracts method:
const contractsWithDefaults = result.rows.map(row => {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    amount: row.amount,
    interestRate: row.interest_rate,
    status: row.status,
    // Provide both termMonths and term fields for compatibility
    termMonths: row.term_months,
    term: row.term_months, // For backwards compatibility
    
    // Dates
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: null, // Not in the query but expected in the interface
    startDate: null, // Not in the query but expected in the interface
    endDate: null, // Not in the query but expected in the interface
    
    // Financial fields
    downPayment: row.down_payment || 0,
    financedAmount: row.financed_amount || 0,
    monthlyPayment: row.monthly_payment || 0,
    
    // Status fields
    currentStep: row.current_step || 'terms',
    archived: row.archived || false,
    archivedAt: row.archived_at || null,
    archivedReason: row.archived_reason || null,
    
    // Contact info
    phoneNumber: row.phone_number || null,
    salesRepId: row.sales_rep_id || null,
    
    // Blockchain fields
    purchasedByShifi: row.purchased_by_shifi || false,
    tokenizationStatus: row.tokenization_status || null,
    tokenId: row.token_id || null,
    smartContractAddress: row.smart_contract_address || null,
    tokenizationError: row.tokenization_error || null,
    blockchainTransactionHash: row.blockchain_transaction_hash || null,
    blockNumber: row.block_number || null,
    tokenizationDate: row.tokenization_date || null,
    tokenMetadata: row.token_metadata || null,
    
    // Cancellation fields
    cancellationRequestedAt: null, // Field doesn't exist in DB yet
    
    // Additional frontend expected fields
    type: 'custom' // Default contract type
  };
});

// Inside getContractsByMerchantId method:
const contractsWithDefaults = minimalResults.map(contract => {
  return {
    ...contract,
    // Add the term field that maps to termMonths for backwards compatibility
    term: contract.termMonths || 0,
    // Add default values for fields not in our minimal query
    completedAt: null,
    downPayment: 0,
    financedAmount: contract.amount || 0,
    monthlyPayment: 0,
    currentStep: "completed",
    archived: false,
    archivedAt: null,
    archivedReason: null,
    phoneNumber: null,
    salesRepId: null,
    purchasedByShifi: false,
    tokenizationStatus: "pending",
    tokenId: null,
    smartContractAddress: null,
    tokenizationError: null,
    blockchainTransactionHash: null, 
    blockNumber: null,
    tokenizationDate: null,
    tokenMetadata: null,
    // Cancellation fields
    cancellationRequestedAt: null, // Field doesn't exist in DB yet
    // Additional frontend expected fields
    updatedAt: null,
    startDate: null,
    endDate: null,
    type: 'custom'
  };
});

// Inside getContractsByCustomerId method:
// (Similar to getContractsByMerchantId, add the cancellationRequestedAt: null field)

// Inside getContractsByPhoneNumber method:
// (Similar to getContractsByMerchantId, add the cancellationRequestedAt: null field)

// Inside getContract method:
// Replace:
// cancellationRequestedAt: row.cancellation_requested_at || null,
// With:
// cancellationRequestedAt: null, // Field doesn't exist in DB yet

// Inside getContractByNumber method:
// Replace:
// cancellationRequestedAt: row.cancellation_requested_at || null,
// With:
// cancellationRequestedAt: null, // Field doesn't exist in DB yet