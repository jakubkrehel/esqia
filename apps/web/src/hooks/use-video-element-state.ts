"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

export function useVideoElementState(
  videoRef: RefObject<HTMLVideoElement | null>
) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setRate] = useState(1);
  const seekingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const sync = () => {
      setIsPlaying(!video.paused);
      setRate(video.playbackRate);
      if (Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };
    const onTimeUpdate = () => {
      if (!seekingRef.current) {
        setCurrentTime(video.currentTime);
      }
    };

    sync();
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("ratechange", sync);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("ratechange", sync);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [videoRef]);

  return {
    beginSeeking() {
      seekingRef.current = true;
    },
    currentTime,
    duration,
    endSeeking() {
      seekingRef.current = false;
    },
    isPlaying,
    playbackRate,
    seek(time: number) {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.currentTime = time;
      setCurrentTime(time);
    },
    setPlaybackRate(rate: number) {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = rate;
      }
    },
    toggle() {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      if (video.paused) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    },
  };
}
