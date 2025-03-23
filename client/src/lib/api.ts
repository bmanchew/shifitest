
// API utility functions for the application

/**
 * Fetch payment schedule data for a customer
 * @param customerId - The ID of the customer
 * @returns Promise with the payment schedule data
 */
export const fetchPaymentSchedule = async (customerId: string) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`);
  if (!response.ok) {
    throw new Error(`Failed to fetch payment schedule: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Update payment schedule for a customer
 * @param customerId - The ID of the customer
 * @param scheduleData - The updated schedule data
 * @returns Promise with the updated payment schedule
 */
export const updatePaymentSchedule = async (customerId: string, scheduleData: any) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  });
  if (!response.ok) {
    throw new Error(`Failed to update payment schedule: ${response.statusText}`);
  }
  return response.json();
};
