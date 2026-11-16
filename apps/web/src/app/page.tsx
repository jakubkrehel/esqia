import { Esqia } from "esqia";
import { ClickHere } from "@/components/click-here";
import { Docs } from "@/components/docs";
import { Footer } from "@/components/footer";
import { InstallCard } from "@/components/install-card";
import { Keys } from "@/components/keys";
import { Shortcuts } from "@/components/shortcuts";
import { ToolbarGraphic } from "@/components/toolbar-graphic";
import Content from "./content.mdx";
import { CONTENT, source } from "./source";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-160 flex-col px-6 py-24">
      <div className="mb-12 w-fit pt-0.5 pb-1.5 mask-[linear-gradient(to_right,transparent,rgb(0_0_0/0.2)_25%,black_45%,black_55%,rgb(0_0_0/0.2)_75%,transparent)]">
        <ToolbarGraphic />
      </div>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="font-demibold font-text text-3xl text-gray-1200 tracking-tight">
          Esqia
        </h1>
        <p className="font-text text-body text-gray-1100">
          An easy way to edit MDX directly on your page.
        </p>
      </header>
      <InstallCard />
      <p className="font-text text-body text-text-paragraph">
        Press <Keys keys={["⌘", "⌥", "E"]} spaced /> to enter edit mode or use
        the <ClickHere>button</ClickHere>.
      </p>
      <Content />
      <Shortcuts />
      <Docs />
      <Footer />
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
