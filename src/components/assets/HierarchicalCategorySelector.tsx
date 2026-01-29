import { useState, useEffect, useMemo } from "react";
import { Plus, X, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const CATEGORY_TYPES = [
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
  { value: "spare_parts", label: "Spare Parts" },
];

type Category = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type CategoryLevel = {
  id: string;
  selectedId: string | null;
  search: string;
  open: boolean;
};

interface HierarchicalCategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string | null, categoryPath: Category[]) => void;
  initialCategoryType?: string;
  disabled?: boolean;
}

export function HierarchicalCategorySelector({
  value,
  onChange,
  initialCategoryType,
  disabled = false,
}: HierarchicalCategorySelectorProps) {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoryType, setCategoryType] = useState<string>(initialCategoryType || "");
  const [levels, setLevels] = useState<CategoryLevel[]>([
    { id: "level-0", selectedId: null, search: "", open: false },
  ]);
  const [loading, setLoading] = useState(true);

  // Fetch all categories once
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type, parent_id")
        .eq("status", "active")
        .order("name");

      if (!error && data) {
        setAllCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  // Initialize from existing value when editing
  useEffect(() => {
    if (value && allCategories.length > 0 && !categoryType) {
      const category = allCategories.find((c) => c.id === value);
      if (category) {
        // Build the path from leaf to root
        const path: Category[] = [];
        let current: Category | undefined = category;
        while (current) {
          path.unshift(current);
          current = allCategories.find((c) => c.id === current?.parent_id);
        }

        if (path.length > 0) {
          setCategoryType(path[0].type);
          const newLevels: CategoryLevel[] = path.map((cat, index) => ({
            id: `level-${index}`,
            selectedId: cat.id,
            search: "",
            open: false,
          }));
          // Check if there are children for the last selected category
          const hasChildren = allCategories.some((c) => c.parent_id === path[path.length - 1].id);
          if (hasChildren) {
            newLevels.push({
              id: `level-${path.length}`,
              selectedId: null,
              search: "",
              open: false,
            });
          }
          setLevels(newLevels);
        }
      }
    }
  }, [value, allCategories]);

  // Filter categories by type
  const categoriesByType = useMemo(() => {
    if (!categoryType) return [];
    return allCategories.filter((c) => c.type === categoryType);
  }, [allCategories, categoryType]);

  // Get categories for a specific level (based on parent)
  const getCategoriesForLevel = (levelIndex: number): Category[] => {
    if (levelIndex === 0) {
      // Root categories (no parent)
      return categoriesByType.filter((c) => !c.parent_id);
    }
    const parentId = levels[levelIndex - 1]?.selectedId;
    if (!parentId) return [];
    return categoriesByType.filter((c) => c.parent_id === parentId);
  };

  // Handle category type change
  const handleTypeChange = (type: string) => {
    setCategoryType(type);
    setLevels([{ id: "level-0", selectedId: null, search: "", open: false }]);
    onChange(null, []);
  };

  // Handle category selection at a specific level
  const handleCategorySelect = (levelIndex: number, categoryId: string) => {
    const newLevels = [...levels];
    
    // Update the selected category at this level
    newLevels[levelIndex] = {
      ...newLevels[levelIndex],
      selectedId: categoryId,
      open: false,
    };

    // Remove all levels after this one
    newLevels.splice(levelIndex + 1);

    // Check if selected category has children
    const hasChildren = categoriesByType.some((c) => c.parent_id === categoryId);
    if (hasChildren) {
      newLevels.push({
        id: `level-${levelIndex + 1}`,
        selectedId: null,
        search: "",
        open: false,
      });
    }

    setLevels(newLevels);

    // Build the category path and notify parent
    const path = newLevels
      .filter((l) => l.selectedId)
      .map((l) => allCategories.find((c) => c.id === l.selectedId)!)
      .filter(Boolean);

    // The final selected category is the deepest selected one
    const finalCategoryId = newLevels[newLevels.length - 1]?.selectedId || categoryId;
    onChange(finalCategoryId, path);
  };

  // Add a new sub-category level
  const addSubCategoryLevel = () => {
    const lastLevel = levels[levels.length - 1];
    if (!lastLevel?.selectedId) return;

    const hasChildren = categoriesByType.some((c) => c.parent_id === lastLevel.selectedId);
    if (hasChildren) {
      setLevels([
        ...levels,
        {
          id: `level-${levels.length}`,
          selectedId: null,
          search: "",
          open: false,
        },
      ]);
    }
  };

  // Remove a level
  const removeLevel = (levelIndex: number) => {
    if (levelIndex === 0) return; // Can't remove the first level
    
    const newLevels = levels.slice(0, levelIndex);
    setLevels(newLevels);

    // Update the selected category
    const lastSelected = newLevels[newLevels.length - 1]?.selectedId;
    const path = newLevels
      .filter((l) => l.selectedId)
      .map((l) => allCategories.find((c) => c.id === l.selectedId)!)
      .filter(Boolean);
    onChange(lastSelected, path);
  };

  // Toggle popover for a level
  const toggleLevelOpen = (levelIndex: number, open: boolean) => {
    const newLevels = [...levels];
    newLevels[levelIndex] = { ...newLevels[levelIndex], open };
    setLevels(newLevels);
  };

  // Update search for a level
  const updateLevelSearch = (levelIndex: number, search: string) => {
    const newLevels = [...levels];
    newLevels[levelIndex] = { ...newLevels[levelIndex], search };
    setLevels(newLevels);
  };

  // Get filtered categories for a level based on search
  const getFilteredCategories = (levelIndex: number): Category[] => {
    const categories = getCategoriesForLevel(levelIndex);
    const search = levels[levelIndex]?.search?.toLowerCase() || "";
    if (!search) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(search));
  };

  // Check if we can add more levels
  const canAddLevel = () => {
    const lastLevel = levels[levels.length - 1];
    if (!lastLevel?.selectedId) return false;
    return categoriesByType.some((c) => c.parent_id === lastLevel.selectedId);
  };

  // Get the selected category name for a level
  const getSelectedCategoryName = (levelIndex: number): string => {
    const selectedId = levels[levelIndex]?.selectedId;
    if (!selectedId) return "";
    return allCategories.find((c) => c.id === selectedId)?.name || "";
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading categories...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Category Type Selection */}
      <div className="space-y-2">
        <Label>Category Type</Label>
        <Select value={categoryType} onValueChange={handleTypeChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select category type" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hierarchical Category Selection */}
      {categoryType && (
        <div className="space-y-3">
          {/* Category Path Display */}
          {levels.some((l) => l.selectedId) && (
            <div className="flex items-center gap-1 flex-wrap">
              {levels
                .filter((l) => l.selectedId)
                .map((level, idx) => (
                  <div key={level.id} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <Badge variant="secondary" className="text-xs">
                      {getSelectedCategoryName(idx)}
                    </Badge>
                  </div>
                ))}
            </div>
          )}

          {/* Category Level Selectors */}
          {levels.map((level, levelIndex) => {
            const categories = getFilteredCategories(levelIndex);
            const availableCategories = getCategoriesForLevel(levelIndex);
            
            // Don't show level if previous level has no selection (except first level)
            if (levelIndex > 0 && !levels[levelIndex - 1]?.selectedId) {
              return null;
            }

            // Don't show if no categories available at this level
            if (availableCategories.length === 0 && levelIndex > 0) {
              return null;
            }

            return (
              <div key={level.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {levelIndex === 0 ? "Category" : `Sub-category Level ${levelIndex}`}
                  </Label>
                  <Popover
                    open={level.open}
                    onOpenChange={(open) => toggleLevelOpen(levelIndex, open)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={level.open}
                        className="w-full justify-between font-normal"
                        disabled={disabled || (levelIndex > 0 && !levels[levelIndex - 1]?.selectedId)}
                      >
                        {level.selectedId
                          ? getSelectedCategoryName(levelIndex)
                          : `Select ${levelIndex === 0 ? "category" : "sub-category"}...`}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search categories..."
                          value={level.search}
                          onValueChange={(search) => updateLevelSearch(levelIndex, search)}
                        />
                        <CommandList>
                          <CommandEmpty>No categories found.</CommandEmpty>
                          <CommandGroup>
                            {categories.map((category) => (
                              <CommandItem
                                key={category.id}
                                value={category.name}
                                onSelect={() => handleCategorySelect(levelIndex, category.id)}
                                className="cursor-pointer"
                              >
                                <span
                                  className={cn(
                                    level.selectedId === category.id && "font-semibold"
                                  )}
                                >
                                  {category.name}
                                </span>
                                {categoriesByType.some((c) => c.parent_id === category.id) && (
                                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {levelIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => removeLevel(levelIndex)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {/* Add Sub-category Button */}
          {canAddLevel() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={addSubCategoryLevel}
              disabled={disabled}
            >
              <Plus className="h-4 w-4" />
              Add Sub-category
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
