import https from 'https';
import http from 'http';

// Define type for node errors
interface NodeError extends Error {
  code?: string;
  errno?: number;
}

/**
 * A helper function to test basic connectivity to a URL
 * This can be used to diagnose connectivity issues with external APIs
 */
export async function testConnectivity(url: string): Promise<{ success: boolean; message: string; details?: any }> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          success: res.statusCode !== undefined && res.statusCode < 400,
          message: `Connection successful to ${url} with status ${res.statusCode}`,
          details: {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data.length > 100 ? data.substring(0, 100) + '...' : data
          }
        });
      });
    });
    
    req.on('error', (err: NodeError) => {
      resolve({
        success: false,
        message: `Failed to connect to ${url}: ${err.message}`,
        details: {
          error: err.message,
          code: err.code,
          errno: err.errno
        }
      });
    });
    
    // Set a timeout to avoid hanging
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        message: `Connection to ${url} timed out after 5 seconds`,
        details: {
          error: 'Connection timed out',
          code: 'TIMEOUT'
        }
      });
    });
    
    req.end();
  });
}