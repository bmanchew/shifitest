import React, { ReactNode } from 'react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Control } from "react-hook-form";

interface CheckboxFormFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  description?: string | ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function CheckboxFormField({
  control,
  name,
  label,
  description,
  disabled = false,
  required = false,
  className,
}: CheckboxFormFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`${className || ''} flex flex-row items-start space-x-3 space-y-0 p-1 rounded-md`}>
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="text-sm font-normal">
              {label} {required && <span className="text-red-500">*</span>}
            </FormLabel>
            {description && (
              <FormDescription className="text-xs">
                {description}
              </FormDescription>
            )}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}