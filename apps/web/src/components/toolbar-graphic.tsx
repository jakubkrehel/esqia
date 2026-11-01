import type { ReactNode } from "react";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="size-8"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function Action({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-full px-3 text-gray-1100">
      {children}
    </span>
  );
}

export function ToolbarGraphic() {
  return (
    <div
      aria-hidden="true"
      className="mb-12 flex w-fit animate-toolbar-loop select-none items-center rounded-full bg-preview-bg pr-2 shadow-custom"
    >
      <span
        className="grid size-18 shrink-0 place-items-center text-gray-1200"
        data-trigger
      >
        <span className="size-5 rounded-sm bg-current" />
      </span>
      <span className="grid grid-cols-[1fr]" data-tray>
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="mx-2 h-8 w-0.5 shrink-0 bg-gray-400" />
          <Action>
            <Glyph>
              <path d="M7.20688 5.70711C7.5974 5.31658 7.5974 4.68342 7.20688 4.29289C6.81636 3.90237 6.18319 3.90237 5.79267 4.29289L2.85333 7.23223C1.87701 8.20855 1.87702 9.79146 2.85333 10.7678L5.79267 13.7071C6.18319 14.0976 6.81636 14.0976 7.20688 13.7071C7.5974 13.3166 7.5974 12.6834 7.20688 12.2929L4.91399 10H16.5C18.433 10 20 11.567 20 13.5C20 15.433 18.433 17 16.5 17H12C11.4477 17 11 17.4477 11 18C11 18.5523 11.4477 19 12 19H16.5C19.5376 19 22 16.5376 22 13.5C22 10.4624 19.5376 8 16.5 8H4.91399L7.20688 5.70711Z" />
            </Glyph>
          </Action>
          <Action>
            <Glyph>
              <path
                clipRule="evenodd"
                d="M5.00014 3C5.55242 3 6.00014 3.44772 6.00014 4V5.42327C6.49765 4.96268 7.01974 4.55425 7.58021 4.21024C8.86314 3.42278 10.3023 3 12.0285 3C16.999 3 21.0285 7.02944 21.0285 12C21.0285 16.9706 16.999 21 12.0285 21C8.10824 21 4.77586 18.4941 3.54083 14.9999C3.35678 14.4792 3.62971 13.9079 4.15042 13.7238C4.67114 13.5398 5.24246 13.8127 5.42651 14.3334C6.38794 17.0536 8.98217 19 12.0285 19C15.8945 19 19.0285 15.866 19.0285 12C19.0285 8.13401 15.8945 5 12.0285 5C10.6586 5 9.58367 5.32722 8.62643 5.91476C8.15226 6.20581 7.69673 6.56697 7.24272 7H9.00014C9.55242 7 10.0001 7.44772 10.0001 8C10.0001 8.55228 9.55242 9 9.00014 9H5.00014C4.44785 9 4.00014 8.55228 4.00014 8V4C4.00014 3.44772 4.44785 3 5.00014 3Z"
                fillRule="evenodd"
              />
            </Glyph>
          </Action>
          <Action>
            <Glyph>
              <path
                clipRule="evenodd"
                d="M8 6.5C8 5.67157 8.67157 5 9.5 5H17.5C18.3284 5 19 5.67157 19 6.5V14.5C19 15.3284 18.3284 16 17.5 16C16.6716 16 16 15.3284 16 14.5V10.1213L7.56066 18.5607C6.97487 19.1464 6.02513 19.1464 5.43934 18.5607C4.85355 17.9749 4.85355 17.0251 5.43934 16.4393L13.8787 8H9.5C8.67157 8 8 7.32843 8 6.5Z"
                fillRule="evenodd"
              />
            </Glyph>
          </Action>
          <Action>
            <span className="size-6 rounded-full bg-[oklch(74.6%_0.16_232.661)]" />
          </Action>
        </span>
      </span>
    </div>
  );
}
