import { randomBytes } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EsqeOptions } from "./server";

interface UploadInput {
  body: Buffer;
  contentType: string;
  dir: string;
  name: string;
  options: NonNullable<EsqeOptions["media"]>;
  root: string;
}

export function upload(input: UploadInput): Promise<string> {
  const prefix = (input.options.path ?? "{dir}/").replaceAll(
    "{dir}",
    input.dir
  );
  const target =
    input.options.upload ?? (blobToken(input.root) ? "vercel-blob" : "public");
  return target === "vercel-blob"
    ? toBlob(input, prefix)
    : toPublic(input, prefix);
}

async function toBlob(input: UploadInput, prefix: string): Promise<string> {
  const token = blobToken(input.root);
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  }
  const { put } = await import("@vercel/blob");
  const pathname = `${prefix}${input.name}`.replace(/^\/+/, "");
  const options = {
    access: "public" as const,
    contentType: input.contentType,
    token,
  };

  try {
    return (
      await put(pathname, input.body, { ...options, addRandomSuffix: false })
    ).url;
  } catch {
    // The name is taken; keep the readable name and let Blob make it unique.
    return (
      await put(pathname, input.body, { ...options, addRandomSuffix: true })
    ).url;
  }
}

async function toPublic(input: UploadInput, prefix: string): Promise<string> {
  const directory = path.join(input.root, "public", prefix);
  await mkdir(directory, { recursive: true });

  let name = input.name;
  if (await exists(path.join(directory, name))) {
    const { name: stem, ext } = path.parse(name);
    name = `${stem}-${randomBytes(3).toString("hex")}${ext}`;
  }
  await writeFile(path.join(directory, name), input.body);
  return `/${path.posix.join(prefix.split(path.sep).join("/"), name)}`;
}

function blobToken(root: string): string | undefined {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    loadEnv(root);
  }
  return process.env.BLOB_READ_WRITE_TOKEN;
}

let envLoaded = false;
function loadEnv(root: string) {
  if (envLoaded) {
    return;
  }
  envLoaded = true;
  try {
    process.loadEnvFile(path.join(root, ".env.local"));
  } catch {
    // No .env.local; the token can still come from the environment.
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
