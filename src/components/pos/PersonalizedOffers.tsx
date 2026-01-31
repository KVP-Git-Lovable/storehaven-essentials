import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Tag, ArrowRight } from "lucide-react";

interface Offer {
  id: string;
  name: string;
  description: string;
  displayMessage: string;
  discountType: string;
  discountValue: number;
  productIds?: string[];
}

interface PersonalizedOffersProps {
  offers: Offer[];
  onApplyOffer: (offer: Offer) => void;
  onAddProduct?: (productId: string) => void;
}

export function PersonalizedOffers({
  offers,
  onApplyOffer,
  onAddProduct,
}: PersonalizedOffersProps) {
  if (offers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" />
        Personalized Offers for You
      </div>
      <div className="space-y-2">
        {offers.slice(0, 3).map((offer) => (
          <Card
            key={offer.id}
            className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => onApplyOffer(offer)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3 w-3 text-primary" />
                    <span className="font-medium text-sm truncate">{offer.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {offer.discountType === "percentage"
                        ? `${offer.discountValue}% OFF`
                        : offer.discountType === "free_item"
                        ? "FREE"
                        : `₹${offer.discountValue} OFF`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {offer.displayMessage || offer.description}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
