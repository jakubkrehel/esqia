import { readFileSync } from "node:fs";
import path from "node:path";
import { Esqia } from "esqia";
import Content from "./content.mdx";

const CONTENT = "src/app/content.mdx";
const source = readFileSync(path.join(process.cwd(), CONTENT), "utf8");

export default function Page() {
  return (
    <main className="mx-auto flex max-w-173 flex-col px-6 pt-24 pb-32">
      <Content />
      <footer className="mt-24 text-gray-1000 text-sm">
        Made by{" "}
        <a className="article-underline" href="https://jakub.kr">
          Jakub Krehel
        </a>
      </footer>
      {process.env.NODE_ENV === "development" ? (
        <Esqia />
      ) : (
        <Esqia
          demo={{
            smartypants: { dashes: false },
            sources: { [CONTENT]: source },
          }}
        />
      )}
    </main>
  );
}
