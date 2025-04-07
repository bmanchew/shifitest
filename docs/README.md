# ShiFi Platform Documentation

## Overview

The ShiFi platform is a cutting-edge fintech solution that enables merchants to offer financing options to their customers through a secure, blockchain-enhanced platform. This documentation provides comprehensive information about the platform's architecture, components, and development processes.

## Documentation Structure

This documentation is organized into several sections:

- [Architecture](architecture.md): Overall system architecture and design patterns
- [Database](database.md): Database schema and data flow
- [API](api.md): API endpoints and usage
- [Components](components.md): UI component documentation
- [Utilities](utils.md): Utility functions documentation
- [Workflow](workflow.md): Development workflows and processes
- [Support Ticket Contract Integration](ticket-contract-integration.txt): Documentation for the support ticket contract integration feature

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the development server: `npm run dev`

## Key Features

### Merchant Financing Platform

The core of the ShiFi platform enables merchants to:
- Create financing contracts for customers
- Manage contract lifecycle
- Process payments
- Request contract cancellations
- View financial reports and analytics

### Blockchain Integration

The platform leverages blockchain technology to:
- Tokenize financing contracts
- Create immutable records of agreements
- Enable transparent tracking of contract status
- Ensure data integrity through distributed ledger

### AI-Powered Financial Insights

The Financial Sherpa feature (currently hidden) provides:
- AI-powered financial assistant for customers
- Voice-based interaction using OpenAI's Realtime API
- Personalized financial guidance
- Contract and payment explanations

### Multi-Tenant Architecture

The platform supports multiple user roles:
- Merchants: Businesses offering financing
- Customers: End users receiving financing
- Admins: Platform administrators
- Sales Representatives: Business development

### Secure Communication Channels
Integrated communication features include:
- In-app notifications
- Email notifications
- SMS alerts
- Structured messaging system

### Support Ticket System
- Support ticket creation and management
- Ticket categorization with AI
- Knowledge base integration
- Support agent assignment and routing
- Real-time chat via Intercom
- Contract-specific ticket association
- Analytics dashboard for support performance

## Development Guidelines

### Code Structure

The application follows a clean, modular structure:
- `client/`: React frontend code
- `server/`: Express backend code
- `shared/`: Shared types and utilities
- `docs/`: Documentation

### Key Technologies

The platform is built with:
- TypeScript for type safety
- React for the frontend UI
- Express.js for the backend API
- PostgreSQL for data storage
- Drizzle ORM for database access
- Tailwind CSS for styling
- React Query for data fetching

### Testing

The repository includes various test scripts for:
- API functionality
- Contract workflows
- Notification systems
- Third-party integrations

## External Integrations

The platform integrates with:

- **Plaid**: For banking connections, account verification, and payments
- **Stripe**: For payment processing
- **Twilio**: For SMS notifications
- **SendGrid**: For email communications
- **OpenAI**: For AI-powered financial guidance
- **Ethereum**: For blockchain contract tokenization

## Contributing

When contributing to the platform:
1. Follow the established architecture patterns
2. Use consistent coding styles
3. Add appropriate documentation
4. Include tests for new features
5. Follow the [workflow](workflow.md) guidelines