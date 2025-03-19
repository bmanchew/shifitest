
import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useLoadScript } from '@react-google-maps/api';
import { cn } from '@/lib/utils';

const libraries: ("places")[] = ["places"];

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, placeDetails?: google.maps.places.PlaceResult) => void;
  onAddressSelect?: (placeDetails: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter address",
  className,
  required
}: AddressAutocompleteProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialize Google Places Autocomplete
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
      types: ["address"],
    });

    // Style the autocomplete dropdown
    if (wrapperRef.current) {
      const pacContainer = wrapperRef.current.getElementsByClassName('pac-container')[0] as HTMLElement;
      if (pacContainer) {
        pacContainer.style.borderRadius = '0.5rem';
        pacContainer.style.border = '1px solid #e2e8f0';
        pacContainer.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        pacContainer.style.marginTop = '4px';
      }
    }

    // Add listener for place selection
    const listener = autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address, place);
        onAddressSelect?.(place);
      }
    });

    return () => {
      if (google && google.maps) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isLoaded, onChange, onAddressSelect]);

  if (loadError) {
    console.error("Error loading Google Maps:", loadError);
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("border-red-300", className)}
        required={required}
      />
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoaded ? placeholder : "Loading..."}
        className={cn(
          "transition-all duration-200",
          isLoaded ? "border-input" : "border-gray-300 bg-gray-50",
          className
        )}
        disabled={!isLoaded}
        required={required}
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
