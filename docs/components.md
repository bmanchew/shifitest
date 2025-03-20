# Component Documentation

## Layout Components

### AdminLayout
- **Purpose**: Main layout wrapper for admin sections
- **Props**: 
  - children: ReactNode - Content to be rendered within layout
- **Key Features**:
  - Navigation sidebar with admin-specific routes
  - User session management with automatic redirect on session expiry
  - Admin-specific routing guards using AuthContext
  - Error boundary implementation for component error handling
  - Responsive design with mobile navigation toggle
- **State Management**:
  - isOpen: Controls mobile navigation visibility
  - userSession: Tracks current admin session
- **Context Usage**:
  - AuthContext for user authentication state
  - ThemeContext for dark/light mode toggling
- **Event Handlers**:
  - handleNavigationToggle: Manages mobile menu state
  - handleSessionExpiry: Handles expired sessions
  - handleProfileClick: Manages profile dropdown

### MerchantLayout  
- **Purpose**: Layout wrapper for merchant portal
- **Props**: 
  - children: ReactNode - Content to be rendered within layout
  - merchantId?: number - Optional merchant identifier
- **Key Features**:
  - Merchant-specific navigation menu
  - Contract management toolset
  - Profile settings and preferences
  - Real-time notifications integration
  - Performance metrics display
- **State Management**:
  - merchantData: Stores merchant profile information
  - notifications: Tracks unread notifications
  - activeContracts: Monitors current contract status
- **API Integration**:
  - Merchant profile data fetching
  - Contract status updates
  - Notification polling
- **Security Features**:
  - Route-based access control
  - Data encryption for sensitive information
  - Session management

## Core Components

### SendApplication
- **Purpose**: Handles customer application flow
- **Props**: 
  - merchantId: number - Merchant identifier
  - onComplete: () => void - Completion callback
  - initialData?: ApplicationData - Optional pre-filled data
- **State Management**:
  - currentStep: applicationStepEnum - Tracks current application step
  - formData: ApplicationData - Stores form input data
  - validationErrors: ValidationErrors - Tracks form validation state
  - isSubmitting: boolean - Controls submission state
- **Step Handlers**:
  - handleTermsAcceptance: Processes terms agreement
  - handleKYCVerification: Manages identity verification
  - handleBankConnection: Processes Plaid integration
  - handlePaymentSetup: Configures payment schedule
  - handleContractSigning: Manages document signing
- **Validation Logic**:
  - Input field validation with error messages
  - Step completion requirements
  - Data format verification
- **Integration Points**:
  - DiDit KYC verification
  - Plaid bank account linking
  - ThanksRoger contract signing
  - Pre-Fi credit check
- **Error Handling**:
  - API error management
  - Validation error display
  - Progress recovery
- **Analytics**:
  - Step completion tracking
  - Error rate monitoring
  - Conversion analytics

### MerchantDashboard
- **Purpose**: Main merchant control panel
- **Features**:
  - Contract overview with status tracking
  - Performance metrics visualization
  - Customer management interface
  - Payment tracking system
  - Document management center
- **Data Display**:
  - Contract status cards
  - Performance charts
  - Customer activity feed
  - Payment history table
- **Interactive Elements**:
  - Quick action buttons
  - Filter controls
  - Search functionality
  - Export options
- **Real-time Updates**:
  - WebSocket integration for live data
  - Notification system
  - Status changes
- **Performance Optimization**:
  - Data caching
  - Lazy loading
  - Pagination implementation

## Authentication Components

### Login
- **Purpose**: User authentication interface
- **State Management**:
  - email: string - User email input
  - password: string - Password input
  - isLoading: boolean - Loading state
  - errors: ValidationErrors - Input validation errors
- **Features**:
  - Role-based login paths
  - Session management
  - Remember me functionality
  - Password reset flow
- **Security Measures**:
  - Input sanitization
  - Rate limiting
  - CSRF protection
  - Password strength validation
- **Error Handling**:
  - Invalid credentials
  - Network errors
  - Account lockout
  - Session conflicts

## Context Providers

### AuthContext
- **Purpose**: Global authentication state management
- **Props**: 
  - children: ReactNode - Child components
- **Provided Values**:
  - user: User - Current user data
  - login: (email, password) => Promise - Authentication handler
  - logout: () => void - Session termination
  - isAuthenticated: boolean - Authentication status
  - refreshToken: () => Promise - Token refresh handler
  - updateUser: (data: Partial<User>) => Promise - User data update
- **Security Features**:
  - Token management
  - Session persistence
  - Role-based access control
  - Automatic token refresh
- **Error States**:
  - Authentication failures
  - Token expiration
  - Network errors
  - Invalid permissions

## Integration Components

### PlaidLink
- **Purpose**: Bank account linking interface
- **Props**:
  - onSuccess: (publicToken) => void - Success callback
  - onExit: () => void - Exit handler
  - merchantId?: number - Optional merchant identifier
- **Features**:
  - Secure bank connection
  - Account selection interface
  - Token management system
  - Error recovery flow
- **Security Measures**:
  - OAuth implementation
  - Data encryption
  - Token rotation
  - Secure storage
- **Event Handling**:
  - Connection success
  - Connection failure
  - User exit
  - Token expiration

### DiditVerification
- **Purpose**: Identity verification interface
- **Props**:
  - sessionId: string - Verification session identifier
  - onComplete: (verificationResult) => void - Completion handler
  - customerId: number - Customer identifier
- **Features**:
  - Document verification
  - Facial recognition
  - Identity confirmation
  - Progress tracking
- **Integration Points**:
  - Camera access
  - Document upload
  - API communication
  - Status updates
- **Error Handling**:
  - Document rejection
  - Verification failure
  - Technical issues
  - Timeout management