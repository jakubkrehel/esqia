import { IconArrowsZoom } from "central-icons/IconArrowsZoom";
import { IconColumnWideAdd } from "central-icons/IconColumnWideAdd";
import { IconCursorClick } from "central-icons/IconCursorClick";
import { IconDifferenceModified } from "central-icons/IconDifferenceModified";
import { IconFontStyle } from "central-icons/IconFontStyle";
import { IconFormsCircleSquare } from "central-icons/IconFormsCircleSquare";
import { IconMultiMedia } from "central-icons/IconMultiMedia";

const ICONS = {
  components: IconFormsCircleSquare,
  cursor: IconCursorClick,
  diff: IconDifferenceModified,
  drag: IconArrowsZoom,
  media: IconMultiMedia,
  slash: IconColumnWideAdd,
  text: IconFontStyle,
};

export function Point({ icon }: { icon: keyof typeof ICONS }) {
  const Icon = ICONS[icon];
  return (
    <span
      className="absolute top-0 -left-px flex h-lh items-center"
      data-point=""
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-preview-bg shadow-custom">
        <span className="flex size-5.5 items-center justify-center rounded-5 bg-gray-200 shadow-custom">
          <Icon className="size-3.5 text-gray-1100" />
        </span>
      </span>
    </span>
  );
}
