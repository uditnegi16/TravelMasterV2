import { Chip } from "../ui/Chip";
import { helpCategories } from "./help.data";

interface HelpCategoriesProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function HelpCategories({ activeId, onSelect }: HelpCategoriesProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <Chip active={activeId === null} onClick={() => onSelect(null)}>
        All topics
      </Chip>

      {helpCategories.map((cat) => (
        <Chip
          key={cat.id}
          active={activeId === cat.id}
          icon={<cat.icon className="h-3.5 w-3.5" />}
          onClick={() => onSelect(cat.id)}
        >
          {cat.label}
        </Chip>
      ))}
    </div>
  );
}
