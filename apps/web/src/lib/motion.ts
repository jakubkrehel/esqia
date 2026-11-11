import type { TargetAndTransition, Transition } from "motion/react";

export const SPRING: Transition = {
  bounce: 0,
  duration: 0.35,
  type: "spring",
};

export const SPRING_FAST: Transition = {
  bounce: 0,
  duration: 0.3,
  type: "spring",
};

export const SPRING_MEDIUM: Transition = {
  bounce: 0,
  duration: 0.5,
  type: "spring",
};

export const SPRING_SLOW: Transition = {
  bounce: 0,
  duration: 0.6,
  type: "spring",
};

export const SPRING_SLOWEST: Transition = {
  bounce: 0,
  duration: 1,
  type: "spring",
};

export const REST: TargetAndTransition = {
  filter: "blur(0px)",
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
};

export const POP: TargetAndTransition = {
  filter: "blur(4px)",
  opacity: 0,
  scale: 0.5,
};

export const FADE: TargetAndTransition = { opacity: 0 };

export const POP_SMALL: TargetAndTransition = { ...POP, scale: 0.25 };
