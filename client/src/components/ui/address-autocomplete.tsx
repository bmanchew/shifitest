import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useLoadScript } from '@react-google-maps/api';

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
    googleMapsApiKey: import.meta.env.GOOGLE_MAPS_API_KEY as string,
    libraries,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialize Google Places Autocomplete
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
      types: ["address"],
    });

    // Add listener for place selection
    const listener = autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address, place);
        onAddressSelect?.(place);
      }
    });

    return () => {
      // Clean up listener
      if (google && google.maps) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [isLoaded, onChange, onAddressSelect]);

  if (loadError) {
    console.error("Error loading Google Maps:", loadError);
    // Fallback to regular input if Google Maps fails to load
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        required={required}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isLoaded ? placeholder : "Loading..."}
      className={className}
      disabled={!isLoaded}
      required={required}
    />
  );
}

export default AddressAutocomplete;