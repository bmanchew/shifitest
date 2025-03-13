// Throw an error if the response is not OK
export const throwIfResNotOk = async (res: Response) => {
  if (!res.ok) {
    // Try to get more information about the error from the response body
    let errorText = '';
    try {
      const errorData = await res.clone().json();
      errorText = errorData.message || JSON.stringify(errorData);
    } catch (e) {
      try {
        errorText = await res.clone().text();
      } catch (textError) {
        errorText = `Status: ${res.status}`;
      }
    }

    throw new Error(`API error ${res.status}: ${errorText}`);
  }
  return res;
};

// Make an API request with proper error handling
export const apiRequest = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  body?: any
): Promise<T> => {
  // Build the request options
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies with the request
  };

  // Add the request body for methods that support it
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    // Make the request
    const res = await fetch(url, options);
    await throwIfResNotOk(res);

    // Return the response data
    return await res.json() as T;
  } catch (error) {
    console.error(`Error in API request to ${url}:`, error);
    throw error;
  }
};