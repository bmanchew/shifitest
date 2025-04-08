import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from './Form';
import { Input } from './Input';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  control: any;
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Enhanced form field with consistent validation feedback
 */
export function FormField({
  control,
  name,
  label,
  description,
  placeholder,
  type = 'text',
  disabled = false,
  className,
}: FormFieldProps) {
  return (
    <FormItem className={className}>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          {...control.register(name)}
          className={cn({
            'border-red-500 focus-visible:ring-red-500': control.formState.errors[name],
          })}
          aria-invalid={!!control.formState.errors[name]}
          aria-describedby={`${name}-description ${name}-error`}
        />
      </FormControl>
      {description && (
        <FormDescription id={`${name}-description`}>
          {description}
        </FormDescription>
      )}
      <FormMessage id={`${name}-error`} />
    </FormItem>
  );
}