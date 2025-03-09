export async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Clone the response before reading the body
    const clonedRes = res.clone();
    const text = await clonedRes.text();
    throw new Error(text);
  }
  return res;
}

export async function apiRequest<T>(
  method: string,
  url: string,
  data?: any,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });

  // Clone the response before checking if it's OK
  const responseForError = res.clone();

  try {
    if (!res.ok) {
      const errorText = await responseForError.text();
      throw new Error(errorText);
    }

    return await res.json();
  } catch (error) {
    // If JSON parsing fails or there's any other error
    if (!error.message.includes('body stream already read')) {
      console.error('API request error:', error);
    }
    throw error;
  }
}