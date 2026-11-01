import { readFileSync } from "node:fs";
import path from "node:path";
import { Esqia } from "esqia";
import { Docs } from "@/components/docs";
import { InstallCard } from "@/components/install-card";
import Content from "./content.mdx";

const CONTENT = "src/app/content.mdx";
const source = readFileSync(path.join(process.cwd(), CONTENT), "utf8");

export default function Page() {
  return (
    <main className="mx-auto flex max-w-173 flex-col px-6 pt-24 pb-32">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-[550] font-text text-3xl text-gray-1200 tracking-tight">
          esqia
        </h1>
        <p className="font-text text-body text-gray-1100">
          Inline markdown editor for React.
        </p>
      </header>
      <InstallCard />
      <Content />
      <Docs />
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
