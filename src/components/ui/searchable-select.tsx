"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
};

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  allowNone?: boolean;
  noneLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  allowNone = false,
  noneLabel = "None",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);
  const displayValue = selectedOption?.label ?? (value === "none" && allowNone ? noneLabel : null);

  // Auto-scroll to selected item when dropdown opens
  React.useEffect(() => {
    if (open && value && listRef.current) {
      // Small delay to ensure the list is rendered
      const timer = setTimeout(() => {
        const selectedElement = listRef.current?.querySelector('[data-selected="true"]');
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          {displayValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList ref={listRef}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onValueChange("none");
                    setOpen(false);
                  }}
                  data-selected={value === "none"}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "none" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {noneLabel}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  data-selected={value === option.value}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.subtitle && (
                      <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
