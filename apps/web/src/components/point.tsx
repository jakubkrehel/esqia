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
      className="absolute top-0 left-[calc((1lh-1.75rem)/2)] flex h-lh items-center"
      data-point=""
    >
      <span className="flex size-7 rounded-lg bg-preview-bg p-0.75 shadow-custom">
        <span className="flex flex-1 items-center justify-center rounded-[5px] bg-gray-200 shadow-custom">
          <Icon className="size-3.5 text-gray-1100" />
        </span>
      </span>
    </span>
  );
}
