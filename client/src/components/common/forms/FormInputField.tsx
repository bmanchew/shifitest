import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control } from "react-hook-form";

interface FormInputFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  type?: string;
  disabled?: boolean;
}

export function FormInputField({
  control,
  name,
  label,
  placeholder,
  description,
  type = "text",
  disabled = false,
}: FormInputFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input 
              placeholder={placeholder} 
              type={type} 
              disabled={disabled} 
              {...field} 
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}