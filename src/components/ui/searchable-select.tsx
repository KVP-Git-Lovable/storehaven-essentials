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
  disabled?: boolean;
  /** Overrides the string cmdk uses to match search input. Falls back to label. */
  searchValue?: string;
  /** Optional custom node to render inside the item (overrides label rendering). */
  labelNode?: React.ReactNode;
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
        const selectedElement = listRef.current?.querySelector(`[data-value="${value}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, value]);

  // Handle wheel scroll properly
  React.useEffect(() => {
    if (!listRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      const element = listRef.current;
      if (!element) return;

      const { scrollHeight, clientHeight, scrollTop } = element;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight;

      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
        return;
      }

      e.preventDefault();
      element.scrollTop += e.deltaY;
    };

    listRef.current.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      listRef.current?.removeEventListener("wheel", handleWheel);
    };
  }, [open]);

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
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 overflow-visible" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList ref={listRef} className="max-h-[240px] overflow-hidden" style={{ overflowY: "auto" }}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onValueChange("none");
                    setOpen(false);
                  }}
                  data-value="none"
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
                  value={option.searchValue ?? option.label}
                  disabled={option.disabled}
                  onSelect={() => {
                    if (option.disabled) return;
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  data-value={option.value}
                  className={cn(option.disabled && "opacity-50 cursor-not-allowed")}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.labelNode ?? option.label}</span>
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
