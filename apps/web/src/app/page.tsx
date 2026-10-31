import Content from "./content.mdx";

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
    </main>
  );
}
