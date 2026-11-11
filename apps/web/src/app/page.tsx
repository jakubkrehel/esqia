import { Esqia } from "esqia";
import { Docs } from "@/components/docs";
import { Footer } from "@/components/footer";
import { InstallCard } from "@/components/install-card";
import { ToolbarGraphic } from "@/components/toolbar-graphic";
import Content from "./content.mdx";
import { CONTENT, source } from "./source";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-160 flex-col px-6 pt-24 pb-32">
      <div className="-mt-10 mb-4 w-fit py-4 mask-[linear-gradient(to_right,transparent,rgb(0_0_0/0.2)_25%,black_45%,black_55%,rgb(0_0_0/0.2)_75%,transparent)]">
        <ToolbarGraphic />
      </div>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="font-demibold font-text text-3xl text-gray-1200 tracking-tight">
          Esqia
        </h1>
        <p className="font-text text-body text-gray-1100">
          An inline markdown editor for React.
        </p>
      </header>
      <InstallCard />
      <Content />
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
