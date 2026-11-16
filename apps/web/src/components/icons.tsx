interface IconProps {
  className?: string;
}

const OPEN_MARK = [
  [0, 0],
  [1, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [0, 4],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [6, 0],
  [5, 1],
  [5, 2],
  [6, 2],
  [5, 3],
  [6, 4],
] as const;

export function EsqiaMarkIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 34 24"
    >
      {OPEN_MARK.map(([column, row]) => (
        <rect
          height={4}
          key={`${column}-${row}`}
          width={4}
          x={column * 5}
          y={row * 5}
        />
      ))}
    </svg>
  );
}

export function NextIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z"
        fill="currentColor"
      />
    </svg>
  );
}
