# ShiFi Tester Support Ticket Contract Integration

## Overview

This document explains how support tickets are now integrated with contracts in the ShiFi Tester system. Each support ticket can either be associated with a specific contract or marked as a general, non-contract related issue.

## Implementation Details

### Schema Changes

Support tickets now include a `contractId` field that can be:
- A valid contract ID number when the ticket is related to a specific contract
- `null` when the ticket represents a general issue not related to any specific contract

### User Interface

The ticket submission form now provides two paths for users:

1. **Contract-Related Issues**: Users can select a specific contract from their list of contracts. The contract selector provides:
   - Clear identification with contract number
   - Contract status indicator with appropriate color-coding
   - Customer name associated with the contract

2. **Non-Contract Issues**: Users can select "Not Contract Related" from the contract dropdown for general inquiries or issues not tied to a specific contract.

### Backend Processing

- All tickets are logged with their contract association status (specific contract ID or "Not Contract Related")
- SMS notifications and email communications include contract information when applicable
- The analytics dashboard categorizes tickets by contract status for better reporting

## Usage Guidelines

### For Merchants

When submitting a new support ticket:
1. If your issue relates to a specific contract, select that contract from the dropdown
2. If your issue is not related to any specific contract (e.g., account issues, general questions), select "Not Contract Related"
3. Complete the remaining ticket fields as usual

### For Administrators

When viewing or managing tickets:
1. Contract-related tickets will display the associated contract information
2. Tickets marked as "Not Contract Related" will be clearly identified as general issues
3. You can filter the ticket list by contract ID or show only general (non-contract) tickets

## Benefits

- **Improved Organization**: Clear separation between contract-specific and general issues
- **Better Analytics**: More accurate reporting on which contracts generate support issues
- **Enhanced Communication**: Support agents immediately know if they need to reference contract details
- **Efficient Routing**: Tickets can be automatically assigned to agents based on contract expertise

## Technical Implementation

The contract integration spans multiple components:

- **Frontend**: TicketSubmissionForm.tsx handles the UI for selecting contracts or marking as non-contract
- **Backend**: communications.ts and support-tickets.ts handle storage and retrieval of contract associations
- **Notifications**: SMS and email templates include contract details when relevant
- **Database**: The supportTickets table includes a nullable contractId field