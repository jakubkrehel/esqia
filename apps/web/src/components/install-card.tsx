"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { GithubIcon } from "@/components/icons";

const COMMANDS = {
  bun: "bun add -d esqia",
  npm: "npm install -D esqia",
  pnpm: "pnpm add -D esqia",
  yarn: "yarn add -D esqia",
} as const;

type Manager = keyof typeof COMMANDS;

const MANAGERS: Manager[] = ["npm", "pnpm", "yarn", "bun"];

const PROGRAM_COLOR =
  "text-[color(display-p3_0.391345_0.215644_0.853560)] dark:text-[color(display-p3_0.615613_0.445256_1)]";
const ARG_COLOR =
  "text-[color(display-p3_0.259723_0.647032_0.276349)] dark:text-[color(display-p3_0.451324_0.823458_0.446819)]";

function ManagerSwitch({
  onChange,
  value,
}: {
  onChange: (manager: Manager) => void;
  value: Manager;
}) {
  return (
    <div
      aria-label="Package manager"
      className="relative grid h-11 select-none sm:flex-1 grid-cols-4 rounded-xl bg-preview-bg p-1 shadow-custom"
      role="radiogroup"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-gray-200 shadow-custom transition-transform duration-300 ease-standard"
        style={{ translate: `${MANAGERS.indexOf(value) * 100}% 0` }}
      />
      {MANAGERS.map((manager) => (
        <label
          className={`interactive relative flex cursor-pointer items-center justify-center rounded-lg font-medium text-sm has-focus-visible:outline-2 has-focus-visible:outline-gray-1100 hover-hover:hover:text-gray-1200 ${manager === value ? "text-gray-1200" : "text-gray-1100"}`}
          key={manager}
        >
          <input
            checked={manager === value}
            className="sr-only"
            name="manager"
            onChange={() => onChange(manager)}
            type="radio"
            value={manager}
          />
          {manager}
        </label>
      ))}
    </div>
  );
}

export function InstallCard() {
  const [manager, setManager] = useState<Manager>("pnpm");
  const command = COMMANDS[manager];
  const [program, ...args] = command.split(" ");

  return (
    <div className="flex w-full flex-col gap-1 rounded-2xl p-1 shadow-custom">
      <div className="flex w-full flex-col gap-1 sm:flex-row">
        <ManagerSwitch onChange={setManager} value={manager} />
        <a
          className="interactive flex h-11 select-none items-center justify-center gap-1.5 rounded-xl bg-preview-bg px-5 font-medium text-gray-1200 shadow-custom hover-hover:hover:bg-gray-200 sm:flex-1"
          href="https://github.com/jakubkrehel/esqia"
          rel="noopener"
          target="_blank"
        >
          <GithubIcon className="size-5 text-gray-1100" />
          GitHub
        </a>
      </div>
      <div className="flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-preview-bg pr-1 pl-4 shadow-custom">
        <code className="flex-1 truncate bg-transparent font-mono text-sm">
          <span className={PROGRAM_COLOR}>{program}</span>
          <span className={ARG_COLOR}> {args.join(" ")}</span>
        </code>
        <CopyButton
          className="size-9 rounded-lg"
          iconClassName="size-4.5"
          label="Copy command"
          text={command}
        />
      </div>
    </div>
  );
}
