#!/bin/bash
# Update all instances of the Avatar component with enhanced styling
sed -i 's/Avatar className="h-16 w-16 mb-4 bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-200 shadow-md"/Avatar className="h-16 w-16 mb-4 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-md"/g' client/src/components/customer/AIFinancialSherpa.tsx
sed -i 's/AvatarFallback className="text-indigo-700"/AvatarFallback className="text-white"/g' client/src/components/customer/AIFinancialSherpa.tsx
sed -i 's/Bot size={32} strokeWidth={1.5}/Bot size={32} strokeWidth={1.25}/g' client/src/components/customer/AIFinancialSherpa.tsx

# Also update the small avatar in the header
sed -i 's/Avatar className="h-10 w-10 bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-200"/Avatar className="h-10 w-10 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-sm"/g' client/src/components/customer/AIFinancialSherpa.tsx
sed -i 's/Bot size={20} strokeWidth={1.5}/Bot size={20} strokeWidth={1.25}/g' client/src/components/customer/AIFinancialSherpa.tsx