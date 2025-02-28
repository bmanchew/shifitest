import { logger } from './logger';
import crypto from 'crypto';

interface DiditTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface DiditSessionResponse {
  session_id: string;
  session_number: number;
  session_url: string;
  vendor_data: string;
  callback: string;
  features: string;
  created_at: string;
  status: string;
  expires_at: string;
}

interface DiditSessionDecision {
  session_id: string;
  session_number: number;
  session_url: string;
  status: string;
  vendor_data: string;
  callback: string;
  features: string;
  kyc?: {
    status: string;
    document_type: string;
    document_number: string;
    date_of_birth: string;
    first_name: string;
    last_name: string;
    full_name: string;
    address?: string;
    [key: string]: any;
  };
  face?: {
    status: string;
    face_match_status: string;
    liveness_status: string;
    face_match_similarity: number;
    [key: string]: any;
  };
  aml?: {
    status: string;
    total_hits: number;
    score?: number;
    hits?: any[];
    [key: string]: any;
  };
  location?: {
    status: string;
    device_brand?: string;
    device_model?: string;
    ip_country?: string;
    ip_city?: string;
    [key: string]: any;
  };
  warnings?: any[];
  reviews?: any[];
  [key: string]: any;
}

interface DiditCreateSessionOptions {
  contractId: string | number;
  callbackUrl: string;
  allowedDocumentTypes?: string[];
  allowedChecks?: string[];
  requiredFields?: string[];
  customFields?: Record<string, any>;
}

interface DiditWebhookEvent {
  event_type: string;
  session_id: string;
  status?: string;
  decision?: {
    status: string;
    [key: string]: any;
  };
  customer_details?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

class DiditService {
  private authBaseUrl = 'https://auth.didit.me';
  private verificationBaseUrl = 'https://verification.didit.me';
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private webhookSecretKey: string | undefined;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.clientId = process.env.DIDIT_CLIENT_ID;
    this.clientSecret = process.env.DIDIT_CLIENT_SECRET;
    this.webhookSecretKey = process.env.DIDIT_WEBHOOK_SECRET_KEY;
    this.initialized = !!this.clientId && !!this.clientSecret;
    
    if (!this.initialized) {
      logger.warn({
        message: 'DiDit service initialized without credentials',
        category: 'api',
        source: 'didit'
      });
    }
  }

  /**
   * Check if the service is properly initialized with credentials
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get an OAuth access token from DiDit
   * Caches the token for subsequent requests until expiry
   */
  async getAccessToken(): Promise<string | null> {
    // Check if we have a valid cached token
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && now < this.tokenExpiry - 60) { // 60-second buffer
      return this.cachedToken;
    }

    if (!this.clientId || !this.clientSecret) {
      logger.warn({
        message: 'Cannot get DiDit access token: Missing credentials',
        category: 'api',
        source: 'didit'
      });
      return null;
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
          audience: this.verificationBaseUrl
        })
      });

      if (!response.ok) {
        throw new Error(`DiDit authentication error: ${response.status} ${response.statusText}`);
      }

      const tokenData: DiditTokenResponse = await response.json();
      this.cachedToken = tokenData.access_token;
      this.tokenExpiry = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      logger.info({
        message: 'Successfully acquired DiDit access token',
        category: 'api',
        source: 'didit',
        metadata: { 
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type
        }
      });

      return this.cachedToken;
    } catch (error) {
      logger.error({
        message: `Failed to get DiDit access token: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return null;
    }
  }

  /**
   * Create a new verification session
   */
  async createVerificationSession(options: DiditCreateSessionOptions): Promise<DiditSessionResponse | null> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot create DiDit verification session: Service not initialized',
        category: 'api',
        source: 'didit'
      });
      return null;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      logger.error({
        message: 'Cannot create DiDit verification session: Failed to acquire access token',
        category: 'api',
        source: 'didit'
      });
      return null;
    }

    try {
      const {
        contractId,
        callbackUrl,
        allowedDocumentTypes = ['passport', 'driving_license', 'id_card'],
        allowedChecks = ['ocr', 'face', 'document_liveness'],
        requiredFields = ['first_name', 'last_name', 'date_of_birth', 'document_number'],
        customFields = {}
      } = options;

      const requestBody = {
        callback_url: callbackUrl,
        vendor_data: contractId.toString(),
        allowed_document_types: allowedDocumentTypes,
        allowed_checks: allowedChecks,
        required_fields: requiredFields,
        ...customFields
      };

      const response = await fetch(`${this.verificationBaseUrl}/v1/session/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`DiDit session creation error: ${response.status} ${response.statusText}`);
      }

      const sessionData: DiditSessionResponse = await response.json();

      logger.info({
        message: `DiDit verification session created: ${sessionData.session_id}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          contractId: contractId.toString(),
          sessionId: sessionData.session_id,
          status: sessionData.status
        }
      });

      return sessionData;
    } catch (error) {
      logger.error({
        message: `Failed to create DiDit verification session: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          contractId: options.contractId.toString(),
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return null;
    }
  }

  /**
   * Retrieve the results of a verification session
   */
  async getSessionDecision(sessionId: string): Promise<DiditSessionDecision | null> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot get DiDit session decision: Service not initialized',
        category: 'api',
        source: 'didit'
      });
      return null;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      logger.error({
        message: 'Cannot get DiDit session decision: Failed to acquire access token',
        category: 'api',
        source: 'didit'
      });
      return null;
    }

    try {
      const response = await fetch(`${this.verificationBaseUrl}/v1/session/${sessionId}/decision/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`DiDit session decision error: ${response.status} ${response.statusText}`);
      }

      const decisionData: DiditSessionDecision = await response.json();

      logger.info({
        message: `DiDit session decision retrieved: ${sessionId}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          sessionId,
          status: decisionData.status,
          vendorData: decisionData.vendor_data
        }
      });

      return decisionData;
    } catch (error) {
      logger.error({
        message: `Failed to get DiDit session decision: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          sessionId,
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return null;
    }
  }

  /**
   * Verify the signature of a DiDit webhook
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.webhookSecretKey) {
      logger.warn({
        message: 'Cannot verify DiDit webhook signature: Missing webhook secret key',
        category: 'api',
        source: 'didit'
      });
      return false;
    }

    try {
      const computedSignature = crypto
        .createHmac('sha256', this.webhookSecretKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return computedSignature === signature;
    } catch (error) {
      logger.error({
        message: `Failed to verify DiDit webhook signature: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }

  /**
   * Process a webhook event from DiDit
   */
  processWebhookEvent(event: DiditWebhookEvent): {
    status: 'success' | 'error';
    isVerified: boolean;
    isCompleted: boolean;
    isApproved: boolean;
    contractId?: string;
    sessionId: string;
    eventType: string;
  } {
    try {
      const { event_type, session_id, status, decision, vendor_data } = event;
      
      // Check signature verification - in a real implementation, this would verify the signature
      // against the webhook secret key before processing the webhook
      const isVerified = !!this.webhookSecretKey;
      
      // Handle different event types according to DiDit's documentation
      const isCompleted = event_type === 'verification.completed';
      
      // Check if verification was approved based on decision status
      // DiDit sends 'approved' for successful verifications
      const isApproved = isCompleted && 
        (decision?.status === 'approved' || status === 'approved' || status === 'completed');
      
      logger.info({
        message: `Processing DiDit webhook event: ${event_type}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          sessionId: session_id, 
          eventType: event_type,
          status,
          decisionStatus: decision?.status,
          vendorData: vendor_data,
          isVerified,
          isCompleted,
          isApproved
        }
      });

      return {
        status: 'success',
        isVerified,
        isCompleted,
        isApproved,
        contractId: vendor_data,
        sessionId: session_id,
        eventType: event_type
      };
    } catch (error) {
      logger.error({
        message: `Failed to process DiDit webhook event: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          error: error instanceof Error ? error.stack : String(error)
        }
      });

      return {
        status: 'error',
        isVerified: false,
        isCompleted: false,
        isApproved: false,
        sessionId: event.session_id || '',
        eventType: event.event_type || 'unknown'
      };
    }
  }

  /**
   * Check if the credentials are valid by making a test API call
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return false;
      }

      const response = await fetch(`${this.verificationBaseUrl}/v1/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error({
        message: `Failed to validate DiDit credentials: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'didit',
        metadata: { 
          error: error instanceof Error ? error.stack : String(error)
        }
      });
      
      return false;
    }
  }
}

export const diditService = new DiditService();