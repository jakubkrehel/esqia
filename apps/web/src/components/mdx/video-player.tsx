"use client";

import { IconFullscreen1 } from "central-icons/IconFullscreen1";
import { IconPause } from "central-icons/IconPause";
import { IconPlay } from "central-icons/IconPlay";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import Swap from "@/components/swap";
import Video from "@/components/video";
import { useTimedState } from "@/hooks/use-timed-state";
import { useVideoElementState } from "@/hooks/use-video-element-state";
import { cn } from "@/lib/utils";

const CONTROL_BUTTON_CLASS =
  "interactive shrink-0 rounded-lg bg-transparent text-white hover-hover:hover:bg-white/15";

const KEYBOARD_STEP = 5;

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface VideoPlayerProps
  extends Omit<
    React.VideoHTMLAttributes<HTMLVideoElement>,
    "src" | "width" | "height" | "className"
  > {
  className?: string;
  height?: number;
  src: string;
  width?: number;
}

function PlayPauseIcon({
  isPlaying,
  size,
}: {
  isPlaying: boolean;
  size: string;
}) {
  return (
    <Swap value={isPlaying ? "pause" : "play"}>
      {isPlaying ? (
        <IconPause className={cn(size, "will-change-transform")} />
      ) : (
        <IconPlay className={cn(size, "mr-px will-change-transform")} />
      )}
    </Swap>
  );
}

interface VideoScrubberProps {
  max: number;
  onSeek: (time: number) => void;
  onSeekEnd: () => void;
  onSeekStart: () => void;
  value: number;
}

function VideoScrubber({
  value,
  max,
  onSeekStart,
  onSeek,
  onSeekEnd,
}: VideoScrubberProps) {
  const duration = Number.isFinite(max) && max > 0 ? max : 0;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, value / duration)) : 0;

  return (
    <div className="has-focus-visible:focus-ring relative flex h-2 grow items-center">
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white opacity-30" />
      <div
        className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white"
        style={{ clipPath: `inset(0 ${(1 - ratio) * 100}% 0 0 round 9999px)` }}
      />
      <input
        aria-label="Seek"
        className="absolute inset-x-0 -top-2 h-6 w-full cursor-crosshair touch-none opacity-0"
        disabled={duration === 0}
        max={duration || 1}
        min={0}
        onBlur={onSeekEnd}
        onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            onSeek(
              Math.min(duration, Math.max(0, value + direction * KEYBOARD_STEP))
            );
          }
        }}
        onLostPointerCapture={onSeekEnd}
        onPointerCancel={onSeekEnd}
        onPointerDown={(event) => {
          if (event.button === 0) {
            event.currentTarget.setPointerCapture(event.pointerId);
            onSeekStart();
          }
        }}
        onPointerUp={onSeekEnd}
        step="any"
        type="range"
        value={ratio * duration}
      />
    </div>
  );
}

interface VideoSpeedControlProps {
  onChange: (rate: number) => void;
  rate: number;
}

function VideoSpeedControl({ onChange, rate }: VideoSpeedControlProps) {
  return (
    <select
      aria-label="Playback speed"
      className={cn(
        CONTROL_BUTTON_CLASS,
        "h-6.5 cursor-pointer appearance-none px-1.5 text-center font-[450] font-sans text-xs tabular-nums"
      )}
      onChange={(e) => onChange(Number(e.target.value))}
      value={rate}
    >
      {RATES.map((value) => (
        <option key={value} value={value}>
          {value}×
        </option>
      ))}
    </select>
  );
}

export default function VideoPlayer({
  src,
  className,
  width,
  height,
  ...rest
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const {
    isPlaying,
    currentTime,
    duration,
    seek,
    toggle,
    beginSeeking,
    endSeeking,
    playbackRate,
    setPlaybackRate,
  } = useVideoElementState(videoRef);

  const [showIndicator, flashIndicator, hideIndicator] = useTimedState(
    false,
    1000
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!(video && prefersReducedMotion)) {
      return;
    }
    video.pause();
  }, [prefersReducedMotion]);

  const handleToggle = () => {
    toggle();
    if (isPlaying) {
      flashIndicator(true);
    } else {
      hideIndicator();
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const swallow = () => undefined;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(swallow);
    } else {
      container.requestFullscreen().catch(swallow);
    }
  };

  const remaining = Math.max(0, duration - currentTime);
  const computedAspect = width && height ? `${width} / ${height}` : undefined;

  return (
    <div
      className={cn(
        "group relative w-full select-none overflow-hidden rounded-2xl",
        className
      )}
      ref={containerRef}
      style={{ aspectRatio: computedAspect }}
    >
      <Video
        {...rest}
        autoPlay={!prefersReducedMotion}
        className="absolute inset-0 h-full w-full object-contain"
        ref={videoRef}
        src={src}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border-overlay"
      />

      <button
        aria-label={isPlaying ? "Pause video" : "Play video"}
        className="absolute inset-0 bottom-11 z-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-4 [@media(hover:none)]:bottom-0"
        onClick={handleToggle}
        type="button"
      />

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div
          className={cn(
            "grid size-16 place-items-center rounded-full bg-black/25 text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-200 ease-out will-change-transform group-hover:opacity-100",
            showIndicator && "opacity-100",
            !isPlaying && "[@media(hover:none)]:opacity-100"
          )}
        >
          <PlayPauseIcon isPlaying={isPlaying} size="size-7" />
        </div>
      </div>

      <div className="gradient-ease-out pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-has-focus-visible:opacity-100" />

      <div className="absolute inset-x-2 bottom-2 z-10 flex h-9 translate-y-2 items-center gap-2 px-2 opacity-0 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 has-focus-visible:translate-y-0 has-focus-visible:opacity-100">
        <button
          aria-label={isPlaying ? "Pause video" : "Play video"}
          className={cn(
            CONTROL_BUTTON_CLASS,
            "grid size-6.5 place-items-center will-change-transform"
          )}
          onClick={handleToggle}
          type="button"
        >
          <PlayPauseIcon isPlaying={isPlaying} size="size-4" />
        </button>
        <span className="shrink-0 font-[450] text-white text-xs tabular-nums">
          {formatDuration(currentTime)}
        </span>
        <VideoScrubber
          max={duration}
          onSeek={seek}
          onSeekEnd={endSeeking}
          onSeekStart={beginSeeking}
          value={currentTime}
        />
        <span className="shrink-0 font-[450] text-white text-xs tabular-nums">
          {formatDuration(remaining)}
        </span>
        <VideoSpeedControl onChange={setPlaybackRate} rate={playbackRate} />
        <button
          aria-label="Toggle fullscreen"
          className={cn(
            CONTROL_BUTTON_CLASS,
            "grid size-6.5 place-items-center"
          )}
          onClick={toggleFullscreen}
          type="button"
        >
          <IconFullscreen1 className="size-4" />
        </button>
      </div>
    </div>
  );
}
