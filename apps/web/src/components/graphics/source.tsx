import { Caret, Chip, Frame } from "./parts";

export function Source() {
  return (
    <Frame className="grid grid-cols-2" nested>
      <div className="flex flex-col gap-5 bg-gray-100 px-8 pt-20">
        <Chip>content.mdx</Chip>
        <pre className="font-mono text-gray-1100 text-small leading-6">
          <span className="text-gray-800">## </span>
          <span className="text-gray-1200">How It Works</span>
          {"\n\n"}
          Click into **any** markdown
          {"\n"}
          on the page and edit it.
        </pre>
      </div>
      <div className="flex flex-col gap-5 border-gray-400 border-l px-8 pt-20">
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
    </Frame>
  );
}
