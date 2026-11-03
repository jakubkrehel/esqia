import { readFileSync } from "node:fs";
import path from "node:path";
import { Esqia } from "esqia";
import { Docs } from "@/components/docs";
import { QuoteIcon } from "@/components/icons";
import { InstallCard } from "@/components/install-card";
import Content from "./content.mdx";

const CONTENT = "src/app/content.mdx";
const source = readFileSync(path.join(process.cwd(), CONTENT), "utf8");

export default function Page() {
  return (
    <main className="mx-auto flex max-w-173 flex-col px-6 pt-24 pb-32">
      <QuoteIcon className="mb-6 size-10 text-gray-1200" />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="font-[550] font-text text-3xl text-gray-1200 tracking-tight">
          Esqia
        </h1>
        <p className="font-text text-body text-gray-1100">
          Inline markdown editor for React.
        </p>
      </header>
      <InstallCard />
      <div className="mt-10 h-9" id="esqia-toolbar" />
      <Content />
      <Docs />
      {process.env.NODE_ENV === "development" ? (
        <Esqia toolbar="#esqia-toolbar" />
      ) : (
        <Esqia
          demo={{
            smartypants: { dashes: false },
            sources: { [CONTENT]: source },
          }}
          toolbar="#esqia-toolbar"
        />
      )}
    </main>
  );
}
