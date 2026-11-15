import { Caret, Chip } from "@/components/graphics/parts";

export function Source() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full select-none sm:aspect-2/1 sm:grid-cols-2"
      data-media-block=""
    >
      <div className="flex flex-col gap-5 p-6 sm:pt-20 sm:pr-0 sm:pb-0 sm:pl-8">
        <Chip>content.mdx</Chip>
        <div className="flex flex-col gap-2 font-mono text-base text-gray-1100 leading-6.5">
          <pre className="leading-7">
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
      <div className="flex flex-col gap-5 p-6 sm:px-8 sm:pt-20 sm:pb-0">
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
  );
}
