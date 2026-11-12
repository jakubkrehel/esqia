import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 flex items-center justify-between font-text text-body text-gray-1100 sm:mt-16">
      <Link
        className="article-underline font-book"
        href="/llms.txt"
        prefetch={false}
      >
        llms.txt
      </Link>
      <p className="text-gray-900">
        Made by{" "}
        <a
          className="article-underline text-gray-1100"
          href="https://x.com/jakubkrehel"
          rel="noopener"
          target="_blank"
        >
          Jakub Krehel
        </a>
      </p>
    </footer>
  );
}
