# Components Documentation

This document provides detailed documentation for the UI components used in the ShiFi platform.

## Component Architecture

The application's component architecture follows a hierarchical structure:

```
client/src/
├── components/            # All reusable components
│   ├── ui/                # Core UI components (shadcn-based)
│   ├── layout/            # Layout components (wrappers, containers)
│   ├── common/            # Shared components used across user types
│   ├── customer/          # Customer-specific components
│   ├── merchant/          # Merchant-specific components
│   └── admin/             # Admin-specific components
└── pages/                 # Page components that use the components above
    ├── auth/              # Authentication pages
    ├── landing/           # Public marketing pages
    ├── customer/          # Customer pages
    ├── merchant/          # Merchant pages
    └── admin/             # Admin pages
```

## Core UI Components

### Button (`components/ui/button.tsx`)

The Button component is a versatile button element that supports various styles, sizes, and variants.

```tsx
import { Button } from "@/components/ui/button";

// Examples
<Button>Default Button</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="destructive">Destructive Button</Button>
<Button size="sm">Small Button</Button>
<Button disabled>Disabled Button</Button>
```

**Props:**
- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
- `size`: "default" | "sm" | "lg" | "icon"
- `asChild`: boolean - When true, the component passes props to its child
- Plus all standard button HTML attributes

### Input (`components/ui/input.tsx`)

The Input component is a styled input element with consistent styling.

```tsx
import { Input } from "@/components/ui/input";

// Examples
<Input placeholder="Email address" />
<Input type="password" placeholder="Password" />
<Input disabled placeholder="Disabled input" />
```

**Props:**
- All standard input HTML attributes

### Card (`components/ui/card.tsx`)

The Card component is a container with predefined styling for displaying content in a card format.

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Example
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

**Subcomponents:**
- `CardHeader`: Container for the card title and description
- `CardTitle`: The title of the card
- `CardDescription`: A description below the title
- `CardContent`: The main content area of the card
- `CardFooter`: Container for actions at the bottom of the card

### Form (`components/ui/form.tsx`)

The Form component wraps React Hook Form with styled form elements.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Example
const formSchema = z.object({
  username: z.string().min(2).max(50),
});

function ProfileForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="username" {...field} />
              </FormControl>
              <FormDescription>
                Your display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

**Subcomponents:**
- `FormField`: Connects form control with validation
- `FormItem`: Container for form elements
- `FormLabel`: Label for form controls
- `FormControl`: Wrapper for form input elements
- `FormDescription`: Additional description text
- `FormMessage`: Displays validation error messages

### Select (`components/ui/select.tsx`)

The Select component provides a dropdown selection control.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Example
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
    <SelectItem value="orange">Orange</SelectItem>
  </SelectContent>
</Select>
```

**Subcomponents:**
- `SelectTrigger`: The button that opens the dropdown
- `SelectValue`: Displays the selected value
- `SelectContent`: Container for the dropdown items
- `SelectItem`: Individual selectable options

### Dialog (`components/ui/dialog.tsx`)

The Dialog component creates modal dialogs.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Example
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        This is a dialog description.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">Dialog content goes here</div>
    <DialogFooter>
      <Button>Save Changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Subcomponents:**
- `DialogTrigger`: Element that opens the dialog
- `DialogContent`: Container for dialog content
- `DialogHeader`: Container for dialog title and description
- `DialogTitle`: Dialog title
- `DialogDescription`: Dialog description
- `DialogFooter`: Container for dialog actions

### Toast (`components/ui/toast.tsx` & `components/ui/toaster.tsx`)

The Toast component displays temporary notifications.

```tsx
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Example
function ToastDemo() {
  const { toast } = useToast();

  return (
    <>
      <Button
        onClick={() => {
          toast({
            title: "Success",
            description: "Operation completed successfully",
          });
        }}
      >
        Show Toast
      </Button>
      <Toaster />
    </>
  );
}
```

**Main Elements:**
- `useToast`: Hook for creating toasts
- `Toaster`: Component to be placed once in the app to display toasts

## Layout Components

### PageContainer (`components/layout/PageContainer.tsx`)

Provides consistent padding and max-width for page content.

```tsx
import { PageContainer } from "@/components/layout/PageContainer";

// Example
<PageContainer>
  <h1>Page Title</h1>
  <p>Page content goes here</p>
</PageContainer>
```

### DashboardLayout (`components/layout/DashboardLayout.tsx`)

Common layout for dashboard pages with sidebar and header.

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Example
<DashboardLayout>
  <h1>Dashboard Content</h1>
</DashboardLayout>
```

**Subcomponents:**
- `Sidebar`: Navigation sidebar
- `Header`: Top header with user menu and notifications
- `MainContent`: Main content area

## Customer Components

### CustomerDashboard (`components/customer/Dashboard.tsx`)

The main dashboard for customers showing contracts and financial overview.

```tsx
import { CustomerDashboard } from "@/components/customer/Dashboard";

// Usage in pages
function CustomerDashboardPage() {
  return <CustomerDashboard />;
}
```

### ContractDetail (`components/customer/ContractDetail.tsx`)

Displays detailed information about a customer's financing contract.

```tsx
import { ContractDetail } from "@/components/customer/ContractDetail";

// Example
<ContractDetail contractId={123} />
```

**Props:**
- `contractId`: number - ID of the contract to display

### PaymentHistory (`components/customer/PaymentHistory.tsx`)

Displays a history of payments for a customer's contract.

```tsx
import { PaymentHistory } from "@/components/customer/PaymentHistory";

// Example
<PaymentHistory contractId={123} />
```

**Props:**
- `contractId`: number - ID of the contract

### MakePayment (`components/customer/MakePayment.tsx`)

Form for customers to make payments on their contracts.

```tsx
import { MakePayment } from "@/components/customer/MakePayment";

// Example
<MakePayment 
  contractId={123} 
  onSuccess={() => console.log("Payment successful")} 
/>
```

**Props:**
- `contractId`: number - ID of the contract
- `onSuccess`: function - Callback for successful payment

### AIFinancialSherpa (`components/customer/AIFinancialSherpa.tsx`)

AI-powered financial assistant component (currently hidden in the UI).

```tsx
import { AIFinancialSherpa } from "@/components/customer/AIFinancialSherpa";

// Example
<AIFinancialSherpa 
  customerId={123} 
  customerName="John Doe" 
  financialData={financialDataObject} 
/>
```

**Props:**
- `customerId`: number - ID of the customer
- `customerName`: string - Name of the customer
- `financialData`: object - Additional financial context data

## Merchant Components

### MerchantDashboard (`components/merchant/Dashboard.tsx`)

Main dashboard for merchants showing contracts, customers, and financial data.

```tsx
import { MerchantDashboard } from "@/components/merchant/Dashboard";

// Usage in pages
function MerchantDashboardPage() {
  return <MerchantDashboard />;
}
```

### CreateContract (`components/merchant/CreateContract.tsx`)

Form for merchants to create new financing contracts.

```tsx
import { CreateContract } from "@/components/merchant/CreateContract";

// Example
<CreateContract 
  onSuccess={(contractId) => console.log(`Contract ${contractId} created`)} 
/>
```

**Props:**
- `onSuccess`: function - Callback for successful contract creation

### ContractList (`components/merchant/ContractList.tsx`)

Displays a list of contracts for a merchant with filtering options.

```tsx
import { ContractList } from "@/components/merchant/ContractList";

// Example
<ContractList 
  status="active" 
  onContractSelect={(id) => console.log(`Selected contract ${id}`)} 
/>
```

**Props:**
- `status`: "all" | "active" | "pending" | "completed" | "cancelled" - Filter by status
- `onContractSelect`: function - Callback when a contract is selected

### CustomerManagement (`components/merchant/CustomerManagement.tsx`)

Interface for merchants to manage their customers.

```tsx
import { CustomerManagement } from "@/components/merchant/CustomerManagement";

// Example
<CustomerManagement />
```

### RequestCancellation (`components/merchant/RequestCancellation.tsx`)

Form for merchants to request cancellation of a contract.

```tsx
import { RequestCancellation } from "@/components/merchant/RequestCancellation";

// Example
<RequestCancellation 
  contractId={123} 
  onSuccess={() => console.log("Cancellation requested")} 
/>
```

**Props:**
- `contractId`: number - ID of the contract
- `onSuccess`: function - Callback for successful cancellation request

## Admin Components

### AdminDashboard (`components/admin/Dashboard.tsx`)

Main dashboard for platform administrators.

```tsx
import { AdminDashboard } from "@/components/admin/Dashboard";

// Usage in pages
function AdminDashboardPage() {
  return <AdminDashboard />;
}
```

### MerchantList (`components/admin/MerchantList.tsx`)

Displays a list of merchants with management options.

```tsx
import { MerchantList } from "@/components/admin/MerchantList";

// Example
<MerchantList 
  onMerchantSelect={(id) => console.log(`Selected merchant ${id}`)} 
/>
```

**Props:**
- `onMerchantSelect`: function - Callback when a merchant is selected

### CancellationRequests (`components/admin/CancellationRequests.tsx`)

Interface for admins to manage contract cancellation requests.

```tsx
import { CancellationRequests } from "@/components/admin/CancellationRequests";

// Example
<CancellationRequests />
```

### BlockchainTokenization (`components/admin/BlockchainTokenization.tsx`)

Interface for admins to manage blockchain tokenization of contracts.

```tsx
import { BlockchainTokenization } from "@/components/admin/BlockchainTokenization";

// Example
<BlockchainTokenization />
```

### SystemStats (`components/admin/SystemStats.tsx`)

Displays system-wide statistics and metrics.

```tsx
import { SystemStats } from "@/components/admin/SystemStats";

// Example
<SystemStats period="month" />
```

**Props:**
- `period`: "day" | "week" | "month" | "year" - Time period for statistics

## Common Components

### NotificationCenter (`components/common/NotificationCenter.tsx`)

Displays and manages user notifications.

```tsx
import { NotificationCenter } from "@/components/common/NotificationCenter";

// Example
<NotificationCenter />
```

### CommunicationPanel (`components/common/CommunicationPanel.tsx`)

Messaging interface for communication between users.

```tsx
import { CommunicationPanel } from "@/components/common/CommunicationPanel";

// Example
<CommunicationPanel 
  receiverId={123} 
  receiverType="customer" 
/>
```

**Props:**
- `receiverId`: number - ID of the message recipient
- `receiverType`: "admin" | "merchant" | "customer" - Type of recipient

### ContractCard (`components/common/ContractCard.tsx`)

Card component displaying summary information about a contract.

```tsx
import { ContractCard } from "@/components/common/ContractCard";

// Example
<ContractCard 
  contract={contractObject} 
  onClick={() => console.log("Contract clicked")} 
/>
```

**Props:**
- `contract`: object - Contract data object
- `onClick`: function - Click handler

### SearchFilter (`components/common/SearchFilter.tsx`)

Search and filtering component for lists.

```tsx
import { SearchFilter } from "@/components/common/SearchFilter";

// Example
<SearchFilter 
  filters={[
    { id: "status", label: "Status", options: ["Active", "Pending", "Completed"] }
  ]} 
  onFilterChange={(filters) => console.log("Filters changed", filters)} 
  onSearch={(term) => console.log("Search term:", term)} 
/>
```

**Props:**
- `filters`: array - Available filter options
- `onFilterChange`: function - Callback when filters change
- `onSearch`: function - Callback when search term changes

### DataTable (`components/common/DataTable.tsx`)

Reusable table component with sorting, pagination, and filtering.

```tsx
import { DataTable } from "@/components/common/DataTable";

// Example
<DataTable 
  columns={columnsDefinition} 
  data={dataArray} 
  pagination={{ pageSize: 10 }} 
/>
```

**Props:**
- `columns`: array - Column definitions
- `data`: array - Data to display
- `pagination`: object - Pagination options

## Authentication Components

### LoginForm (`components/auth/LoginForm.tsx`)

Form for user authentication.

```tsx
import { LoginForm } from "@/components/auth/LoginForm";

// Example
<LoginForm 
  userType="merchant" 
  onSuccess={() => console.log("Login successful")} 
/>
```

**Props:**
- `userType`: "admin" | "merchant" | "customer" - Type of user
- `onSuccess`: function - Callback for successful login

### PasswordResetForm (`components/auth/PasswordResetForm.tsx`)

Form for resetting user passwords.

```tsx
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

// Example
<PasswordResetForm 
  token="reset-token-here" 
  onSuccess={() => console.log("Password reset successful")} 
/>
```

**Props:**
- `token`: string - Password reset token
- `onSuccess`: function - Callback for successful password reset

### MagicLinkForm (`components/auth/MagicLinkForm.tsx`)

Form for passwordless authentication using magic links.

```tsx
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";

// Example
<MagicLinkForm 
  userType="customer" 
  onSuccess={() => console.log("Magic link sent")} 
/>
```

**Props:**
- `userType`: "admin" | "merchant" | "customer" - Type of user
- `onSuccess`: function - Callback for successful magic link request

## Integration Components

### PlaidLink (`components/integrations/PlaidLink.tsx`)

Component for connecting bank accounts via Plaid.

```tsx
import { PlaidLink } from "@/components/integrations/PlaidLink";

// Example
<PlaidLink 
  onSuccess={(publicToken) => console.log("Plaid connected", publicToken)} 
  onExit={() => console.log("Plaid flow exited")} 
/>
```

**Props:**
- `onSuccess`: function - Callback when Plaid connection is successful
- `onExit`: function - Callback when user exits Plaid flow

### StripePaymentForm (`components/integrations/StripePaymentForm.tsx`)

Form for processing payments via Stripe.

```tsx
import { StripePaymentForm } from "@/components/integrations/StripePaymentForm";

// Example
<StripePaymentForm 
  amount={500} 
  onSuccess={(paymentId) => console.log("Payment successful", paymentId)} 
/>
```

**Props:**
- `amount`: number - Payment amount in cents
- `onSuccess`: function - Callback for successful payment

### BlockchainViewer (`components/integrations/BlockchainViewer.tsx`)

Component for viewing blockchain transaction details.

```tsx
import { BlockchainViewer } from "@/components/integrations/BlockchainViewer";

// Example
<BlockchainViewer 
  contractId={123} 
  transactionHash="0x1234567890abcdef" 
/>
```

**Props:**
- `contractId`: number - ID of the contract
- `transactionHash`: string - Blockchain transaction hash

## Component Best Practices

### Accessibility

All components are designed with accessibility in mind:
- All interactive elements are keyboard accessible
- Form inputs have associated labels
- Proper ARIA attributes are used where necessary
- Color contrast meets WCAG standards

### Composition

Components are designed to be composable:
- Smaller components can be combined to build larger ones
- Props are used for customization
- Sensible defaults are provided for all props
- Components are context-aware when needed

### Performance

Performance considerations are built into components:
- Memoization is used for expensive calculations
- Components only re-render when necessary
- Large components use code-splitting
- Lists are virtualized for large datasets

### Error Handling

Components handle errors gracefully:
- Form validation provides clear error messages
- Network errors are displayed to the user
- Fallback UI is shown during loading states
- Error boundaries catch and display component errors

## Design System Integration

Components adhere to the design system defined in `theme.json`, which includes:
- Color palette
- Typography scale
- Spacing system
- Border radius
- Shadows and elevation

The theme is implemented through Tailwind CSS with configuration in `tailwind.config.ts`.

## Storybook Documentation

Component stories are defined in Storybook format for documentation and testing. Example structure:

```tsx
// button.stories.tsx
import { Button } from "./button";

export default {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
  },
};

export const Default = {
  args: {
    children: "Button",
  },
};

export const Destructive = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
};
```

For detailed component documentation, run Storybook with `npm run storybook`.