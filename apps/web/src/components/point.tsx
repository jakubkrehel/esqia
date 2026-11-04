import {
  CursorClickIcon,
  DifferenceIcon,
  MagicWandIcon,
  ReorderIcon,
  TextSelectIcon,
} from "@/components/icons";

const ICONS = {
  cursor: CursorClickIcon,
  diff: DifferenceIcon,
  drag: ReorderIcon,
  slash: MagicWandIcon,
  text: TextSelectIcon,
};

export function Point({ icon }: { icon: keyof typeof ICONS }) {
  const Icon = ICONS[icon];
  return (
    <span
      className="absolute top-0 left-0 flex h-lh items-center"
      data-point=""
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-gray-300">
        <Icon className="size-4 text-gray-1100" />
      </span>
    </span>
  );
}
