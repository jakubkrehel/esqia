"use client";

import { IconClaudeai } from "central-icons/IconClaudeai";
import { IconCursor } from "central-icons/IconCursor";
import { IconOpenaiCodex } from "central-icons/IconOpenaiCodex";
import { Fragment, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { NpmIcon } from "@/components/icons";

const COMMANDS = {
  bun: "bun add -d esqia",
  npm: "npm install -D esqia",
  pnpm: "pnpm add -D esqia",
  yarn: "yarn add -D esqia",
} as const;

type Manager = keyof typeof COMMANDS;

const MANAGERS: Manager[] = ["npm", "pnpm", "yarn", "bun"];

const PROMPT = [
  "Set up esqia, an inline MDX editor for Next.js, in this project. Its docs are at https://github.com/jakubkrehel/esqia.",
  "",
  "1. Install `esqia` as a dev dependency with the package manager this project uses.",
  '2. In the Next.js config, add `"esqia/remark"` as the last remark plugin of the `@next/mdx` setup, only when `process.env.NODE_ENV === "development"`, and wrap the exported config with `withEsqia` from `esqia/next`: `export default withEsqia(withMDX(nextConfig))`.',
  '3. In the root layout, render `<Esqia />` from `esqia` in development only: `{process.env.NODE_ENV === "development" && <Esqia />}`.',
  "4. If the site uses `remark-smartypants`, pass the same settings as `smartypants` in the second argument of `withEsqia`.",
  '5. Esqia\'s button sits in the bottom-left corner, where Next.js puts its dev indicator. Move the indicator with `devIndicators: { position: "bottom-right" }`.',
  "",
  "Esqia edits the MDX that `@next/mdx` renders. If this project does not use it, say so instead of adding it. Change nothing else, and finish by telling me to run the dev server and press ⌘⌥E on a page with MDX content.",
].join("\n");

const AGENTS = [
  { Icon: IconClaudeai, name: "Claude" },
  { Icon: IconOpenaiCodex, name: "Codex" },
  { Icon: IconCursor, name: "Cursor" },
];

const PROGRAM_COLOR =
  "text-[color(display-p3_0.391345_0.215644_0.853560)] dark:text-[color(display-p3_0.615613_0.445256_1)]";
const ARG_COLOR =
  "text-[color(display-p3_0.259723_0.647032_0.276349)] dark:text-[color(display-p3_0.451324_0.823458_0.446819)]";

const LINKS = [
  {
    href: "https://www.npmjs.com/package/esqia",
    Icon: NpmIcon,
    label: "npm",
  },
];

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
  const [manager, setManager] = useState<Manager>("npm");
  const command = COMMANDS[manager];
  const [program, ...args] = command.split(" ");

  return (
    <div className="mb-6 flex w-full flex-col gap-1 rounded-2xl p-1 shadow-custom">
      <div className="flex w-full flex-col-reverse gap-1 sm:flex-row">
        <ManagerSwitch onChange={setManager} value={manager} />
        <div className="flex gap-1 sm:flex-1">
          {LINKS.map(({ href, Icon, label }) => (
            <a
              className="interactive flex h-11 flex-1 select-none items-center justify-center gap-1.5 rounded-xl bg-preview-bg px-5 font-medium text-gray-1200 shadow-custom hover-hover:hover:bg-gray-200"
              href={href}
              key={label}
              rel="noopener"
              target="_blank"
            >
              <Icon className="size-5 text-gray-1100" />
              {label}
            </a>
          ))}
        </div>
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
      <div className="flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-preview-bg pr-1 pl-4 shadow-custom">
        <span className="flex-1 truncate font-text text-gray-1100 text-sm">
          Or install with{" "}
          {AGENTS.map(({ Icon, name }, index) => (
            <Fragment key={name}>
              {index > 0 && <span className="max-sm:hidden">, </span>}
              <span
                className={`whitespace-nowrap font-medium text-gray-1200 ${index > 0 ? "max-sm:ml-1" : ""}`}
              >
                <Icon className="mb-0.5 inline-block size-4 sm:mr-1" />
                <span className="max-sm:sr-only">{name}</span>
              </span>
            </Fragment>
          ))}{" "}
          and other agents.
        </span>
        <CopyButton
          className="size-9 rounded-lg"
          iconClassName="size-4.5"
          label="Copy prompt"
          text={PROMPT}
        />
      </div>
    </div>
  );
}
