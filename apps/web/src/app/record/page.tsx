import { readFileSync } from "node:fs";
import path from "node:path";
import { Esqia } from "esqia";
import { Source } from "@/components/graphics/source";
import Content from "./content.mdx";
import { EnabledRedo } from "./enabled-redo";
import Paragraph from "./paragraph.mdx";

const FILES = ["src/app/record/content.mdx", "src/app/record/paragraph.mdx"];
const sources = Object.fromEntries(
  FILES.map((file) => [
    file,
    readFileSync(path.join(process.cwd(), file), "utf8"),
  ])
);

const BAR = "esqia-bar";
const hidden = () => null;

export default function Page() {
  return (
    <main className="mx-auto flex max-w-160 flex-col px-6 py-80">
      <div className="mb-40 flex h-9">
        <div className="-mr-4.5 w-1/3 shrink-0" />
        <div id={BAR} />
      </div>
      <div className="mx-auto flex w-full max-w-140 flex-col">
        <Content components={{ Source: hidden }} />
      </div>
      <section className="mx-auto mt-80 flex w-full max-w-140 flex-col gap-4">
        <Paragraph />
      </section>
      <section className="mt-80">
        <Source />
      </section>
      <EnabledRedo />
      {process.env.NODE_ENV === "development" ? (
        <Esqia toolbar={`#${BAR}`} />
      ) : (
        <Esqia
          demo={{
            smartypants: { dashes: false },
            sources,
          }}
          toolbar={`#${BAR}`}
        />
      )}
    </main>
  );
}
