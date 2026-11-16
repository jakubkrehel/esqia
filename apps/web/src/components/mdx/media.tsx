import NextImage, { type ImageProps } from "next/image";
import VideoPlayer from "@/components/mdx/video-player";

type MDXImageProps = Omit<ImageProps, "alt" | "fill" | "height" | "width"> & {
  alt?: string;
  height?: string | number;
  width?: string | number;
};

type MDXVideoProps = Omit<
  React.VideoHTMLAttributes<HTMLVideoElement>,
  "height" | "src" | "width"
> & {
  height?: string | number;
  src: string;
  width?: string | number;
};

function toPixels(value: string | number | undefined): number | undefined {
  return typeof value === "string" ? Number.parseInt(value, 10) : value;
}

export function MDXBlockImage({
  alt = "",
  width,
  height,
  sizes = "(min-width: 688px) 592px, calc(100vw - 48px)",
  ...rest
}: MDXImageProps) {
  return (
    <span
      className="relative block w-full select-none overflow-hidden rounded-2xl border-overlay"
      data-media=""
    >
      <NextImage
        {...rest}
        alt={alt}
        height={toPixels(height) ?? 630}
        sizes={sizes}
        width={toPixels(width) ?? 1200}
      />
    </span>
  );
}

export function MDXBlockVideo({
  className,
  src,
  width,
  height,
  ...rest
}: MDXVideoProps) {
  return (
    <div className="my-8 w-full">
      <VideoPlayer
        {...rest}
        className={className}
        height={toPixels(height)}
        src={src}
        width={toPixels(width)}
      />
    </div>
  );
}
