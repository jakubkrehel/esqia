import { readFileSync } from "node:fs";
import path from "node:path";
import { Esqia } from "esqia";
import Content from "./content.mdx";
import { EnabledRedo } from "./enabled-redo";
import Paragraph from "./paragraph.mdx";
import { Source } from "./source";

const FILES = ["src/app/record/content.mdx", "src/app/record/paragraph.mdx"];
const sources = Object.fromEntries(
  FILES.map((file) => [
    file,
    readFileSync(path.join(process.cwd(), file), "utf8"),
  ])
);

const hidden = () => null;

export default function Page() {
  return (
    <main className="mx-auto flex max-w-160 flex-col px-6 py-80">
      <div className="mx-auto flex w-full max-w-140 flex-col">
        <Content components={{ Source: hidden }} />
      </div>
      <section className="mx-auto mt-80 flex w-full max-w-140 flex-col">
        <Paragraph />
      </section>
      <section className="mt-80">
        <Source />
      </section>
      <EnabledRedo />
      {process.env.NODE_ENV === "development" ? (
        <Esqia />
      ) : (
        <Esqia
          demo={{
            smartypants: { dashes: false },
            sources,
          }}
        />
      )}
    </main>
  );
}
