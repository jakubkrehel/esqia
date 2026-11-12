import {
  ComponentsIcon,
  CursorClickIcon,
  DifferenceIcon,
  InsertBlockIcon,
  MediaIcon,
  MoveIcon,
  TextIcon,
} from "@/components/icons";

const ICONS = {
  components: ComponentsIcon,
  cursor: CursorClickIcon,
  diff: DifferenceIcon,
  drag: MoveIcon,
  media: MediaIcon,
  slash: InsertBlockIcon,
  text: TextIcon,
};

export function Point({ icon }: { icon: keyof typeof ICONS }) {
  const Icon = ICONS[icon];
  return (
    <span
      className="absolute top-0 left-0 flex h-lh items-center"
      data-point=""
    >
      <span className="flex size-7 rounded-lg bg-preview-bg p-0.5 shadow-custom">
        <span className="flex flex-1 items-center justify-center rounded-md bg-gray-200 shadow-custom">
          <Icon className="size-4 text-gray-1100" />
        </span>
      </span>
    </span>
  );
}
