import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Star, Grid3X3 } from "lucide-react";

interface CategoryTabsProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  favoritesCount: number;
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
  showFavorites,
  onToggleFavorites,
  favoritesCount,
}: CategoryTabsProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {/* Favorites Button */}
        <Button
          variant={showFavorites ? "default" : "outline"}
          size="sm"
          onClick={onToggleFavorites}
          className="gap-1 shrink-0"
        >
          <Star className={`h-3 w-3 ${showFavorites ? "fill-current" : ""}`} />
          Favorites
          {favoritesCount > 0 && (
            <span className="ml-1 text-xs opacity-70">({favoritesCount})</span>
          )}
        </Button>

        {/* All Categories Button */}
        <Button
          variant={selectedCategory === "all" && !showFavorites ? "default" : "outline"}
          size="sm"
          onClick={() => {
            onSelectCategory("all");
            if (showFavorites) onToggleFavorites();
          }}
          className="gap-1 shrink-0"
        >
          <Grid3X3 className="h-3 w-3" />
          All
        </Button>

        {/* Category Buttons */}
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category && !showFavorites ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onSelectCategory(category);
              if (showFavorites) onToggleFavorites();
            }}
            className="shrink-0"
          >
            {category}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
