import { Caret, Chip } from "./parts";

export function Source() {
  return (
    <div
      aria-hidden="true"
      className="w-full select-none rounded-2xl bg-preview-bg p-1 shadow-custom"
      data-media-block=""
    >
      <div className="grid overflow-hidden rounded-xl bg-preview-bg shadow-custom sm:aspect-2/1 sm:grid-cols-2">
        <div className="flex flex-col gap-5 bg-gray-100 p-6 sm:px-8 sm:pt-20 sm:pb-0">
          <Chip>content.mdx</Chip>
          <div className="flex flex-col gap-3.5 font-mono text-gray-1100 text-small leading-6">
            <pre>
              <span className="text-gray-800">## </span>
              <span className="text-gray-1200">How It Works</span>
            </pre>
            <pre>
              Click into **any** markdown
              {"\n"}
              on the page and edit it.
            </pre>
          </div>
        </div>
        <div className="flex flex-col gap-5 border-gray-400 border-t p-6 sm:border-t-0 sm:border-l sm:px-8 sm:pt-20 sm:pb-0">
          <Chip>localhost:3000</Chip>
          <div className="flex flex-col gap-2">
            <p className="font-demibold font-text text-gray-1200 text-xl">
              How It Works
            </p>
            <p className="font-text text-body text-text-paragraph">
              Click into{" "}
              <strong className="font-medium text-gray-1200">any</strong>
              <Caret /> markdown on the page and edit it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
