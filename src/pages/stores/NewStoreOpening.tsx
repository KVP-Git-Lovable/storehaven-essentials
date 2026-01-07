import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";

const checklistCategories = [
  {
    id: "legal",
    title: "Legal & Compliance",
    items: [
      { id: "1", label: "Trade License obtained", completed: true },
      { id: "2", label: "GST Registration", completed: true },
      { id: "3", label: "Fire NOC", completed: false },
      { id: "4", label: "Shop & Establishment Act Registration", completed: true },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure Setup",
    items: [
      { id: "5", label: "Electrical wiring completed", completed: true },
      { id: "6", label: "HVAC installation", completed: true },
      { id: "7", label: "Flooring completed", completed: true },
      { id: "8", label: "Signage installed", completed: false },
    ],
  },
  {
    id: "equipment",
    title: "Equipment & Assets",
    items: [
      { id: "9", label: "POS systems installed", completed: true },
      { id: "10", label: "Security cameras setup", completed: false },
      { id: "11", label: "Display fixtures installed", completed: true },
      { id: "12", label: "Inventory management system", completed: false },
    ],
  },
  {
    id: "staffing",
    title: "Staffing & Training",
    items: [
      { id: "13", label: "Store manager hired", completed: true },
      { id: "14", label: "Staff recruitment completed", completed: false },
      { id: "15", label: "Training completed", completed: false },
      { id: "16", label: "Uniforms distributed", completed: false },
    ],
  },
];

export default function NewStoreOpening() {
  const totalItems = checklistCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  const completedItems = checklistCategories.reduce(
    (acc, cat) => acc + cat.items.filter((item) => item.completed).length,
    0
  );
  const progressPercent = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">New Store Opening Checklist</h1>
        <p className="text-muted-foreground">Track progress for new store launches</p>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Overall Progress</h3>
            <p className="text-sm text-muted-foreground">
              {completedItems} of {totalItems} tasks completed
            </p>
          </div>
          <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      <Accordion type="multiple" defaultValue={["legal", "infrastructure"]} className="space-y-4">
        {checklistCategories.map((category) => {
          const categoryCompleted = category.items.filter((i) => i.completed).length;
          return (
            <AccordionItem
              key={category.id}
              value={category.id}
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{category.title}</span>
                  <span className="text-sm text-muted-foreground">
                    ({categoryCompleted}/{category.items.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {category.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox checked={item.completed} />
                      <span className={item.completed ? "text-muted-foreground line-through" : ""}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
