import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import type {
  StudyImportKind,
  StudyImportResult,
  StudyImportSuggestion,
} from "@/lib/study-import";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const DOI_PATTERN = /10\.\d{4,9}\/[\w.()/:;-]+/i;

interface ArticleMetadata {
  title?: string;
  year?: number | null;
  authors?: string;
  doi?: string;
  design?: string;
  indexTest?: string;
  referenceStandard?: string;
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefMessage {
  title?: string[];
  author?: CrossrefAuthor[];
  DOI?: string;
  abstract?: string;
  type?: string;
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let source: StudyImportKind;
    let sourceName: string;
    let metadata: ArticleMetadata;
    const warnings: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "Choose a PDF file first." }, { status: 400 });
      }
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return Response.json({ error: "Only PDF files can be read here." }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return Response.json({ error: "The PDF must be smaller than 15 MB." }, { status: 413 });
      }

      source = "pdf";
      sourceName = file.name;
      metadata = await parsePdf(file, warnings);
    } else {
      const payload = (await request.json()) as { source?: unknown; value?: unknown };
      if (payload.source !== "doi" && payload.source !== "url") {
        return Response.json({ error: "Choose DOI or link." }, { status: 400 });
      }
      if (typeof payload.value !== "string" || !payload.value.trim()) {
        return Response.json(
          { error: payload.source === "doi" ? "Enter a DOI." : "Paste a webpage link." },
          { status: 400 },
        );
      }

      source = payload.source;
      sourceName = payload.value.trim();
      metadata =
        source === "doi"
          ? await metadataFromDoi(sourceName)
          : await metadataFromUrl(sourceName, warnings);
    }

    const suggestion = toSuggestion(metadata, source, sourceName);
    if (!suggestion.label) {
      return Response.json(
        { error: "We could not find enough study information. Try another source or enter it manually." },
        { status: 422 },
      );
    }

    const result: StudyImportResult = { source, sourceName, suggestion, warnings };
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The study could not be read.";
    return Response.json({ error: message }, { status: 400 });
  }
}

async function metadataFromDoi(input: string): Promise<ArticleMetadata> {
  const doi = normalizeDoi(input);
  if (!doi) throw new Error("That does not look like a DOI.");

  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "RevKit/0.2 (https://github.com/benowrlive/RevKit)",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    },
  );

  if (response.status === 404) throw new Error("No study was found for that DOI.");
  if (!response.ok) throw new Error("The DOI service is unavailable right now.");

  const body = (await response.json()) as { message?: CrossrefMessage };
  if (!body.message) throw new Error("The DOI record did not contain study details.");

  return metadataFromCrossref(body.message);
}

function metadataFromCrossref(message: CrossrefMessage): ArticleMetadata {
  const authors = (message.author ?? [])
    .map((author) => {
      if (author.name) return author.name;
      const initials = (author.given ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .join("");
      return [author.family, initials].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");

  const year =
    firstYear(message["published-print"]) ??
    firstYear(message["published-online"]) ??
    firstYear(message.published) ??
    firstYear(message.issued);

  const text = [message.title?.[0], message.abstract, message.type].filter(Boolean).join("\n");

  return {
    title: cleanText(message.title?.[0] ?? ""),
    year,
    authors,
    doi: normalizeDoi(message.DOI ?? ""),
    design: inferDesign(text),
    ...inferDiagnosticFields(text),
  };
}

async function metadataFromUrl(input: string, warnings: string[]): Promise<ArticleMetadata> {
  const url = normalizePublicUrl(input);
  const { html, finalUrl } = await fetchPublicHtml(url);
  const page = parseHtmlMetadata(html);
  const doi = normalizeDoi(page.doi ?? findDoi(html) ?? findDoi(finalUrl) ?? "");

  let crossref: ArticleMetadata = {};
  if (doi) {
    try {
      crossref = await metadataFromDoi(doi);
    } catch {
      warnings.push("The DOI was found, but its full citation record could not be loaded.");
    }
  }

  const combinedText = [page.title, stripHtml(html).slice(0, 40_000)].filter(Boolean).join("\n");
  return {
    title: crossref.title || page.title,
    year: crossref.year ?? page.year ?? findYear(combinedText),
    authors: crossref.authors || page.authors,
    doi: crossref.doi || doi,
    design: crossref.design || inferDesign(combinedText),
    ...mergeDiagnosticFields(crossref, inferDiagnosticFields(combinedText)),
  };
}

async function parsePdf(file: File, warnings: string[]): Promise<ArticleMetadata> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText({ first: 10 });
    const text = result.text.replace(/\u0000/g, " ");
    const doi = normalizeDoi(findDoi(text) ?? "");
    let crossref: ArticleMetadata = {};

    if (doi) {
      try {
        crossref = await metadataFromDoi(doi);
      } catch {
        warnings.push("A DOI was found in the PDF, but its full citation record could not be loaded.");
      }
    } else {
      warnings.push("No DOI was found in the PDF, so some citation details may need checking.");
    }

    const local = metadataFromPdfText(text, file.name);
    return {
      title: crossref.title || local.title,
      year: crossref.year ?? local.year,
      authors: crossref.authors || local.authors,
      doi: crossref.doi || doi,
      design: crossref.design || local.design,
      ...mergeDiagnosticFields(crossref, local),
    };
  } finally {
    await parser.destroy();
  }
}

function metadataFromPdfText(text: string, fileName: string): ArticleMetadata {
  const lines = text
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line.length >= 3)
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));

  const title =
    lines.find(
      (line) =>
        line.length >= 20 &&
        line.length <= 240 &&
        !/^(abstract|introduction|background|methods?|results?|discussion|references?)\b/i.test(line) &&
        !/^(https?:\/\/|www\.|doi:)/i.test(line),
    ) ?? fileName.replace(/\.pdf$/i, "");

  const titleIndex = lines.indexOf(title);
  const authorCandidates = lines.slice(Math.max(0, titleIndex + 1), titleIndex + 5);
  const authors =
    authorCandidates.find(
      (line) =>
        line.length < 220 &&
        /(?:,|\band\b|\bet al\.?\b)/i.test(line) &&
        !/\b(?:university|department|hospital|institute|journal)\b/i.test(line),
    ) ?? "";

  return {
    title,
    year: findYear(text.slice(0, 12_000)),
    authors,
    doi: normalizeDoi(findDoi(text) ?? ""),
    design: inferDesign(text.slice(0, 80_000)),
    ...inferDiagnosticFields(text.slice(0, 80_000)),
  };
}

function parseHtmlMetadata(html: string): ArticleMetadata {
  const meta = new Map<string, string[]>();
  const tagPattern = /<meta\b[^>]*>/gi;
  const attributePattern = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

  for (const tag of html.match(tagPattern) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(attributePattern)) {
      attributes.set(match[1].toLowerCase(), decodeHtml(match[3]));
    }
    const key = (
      attributes.get("name") ??
      attributes.get("property") ??
      attributes.get("itemprop") ??
      ""
    ).toLowerCase();
    const content = attributes.get("content");
    if (key && content) meta.set(key, [...(meta.get(key) ?? []), content]);
  }

  const jsonLd = parseJsonLd(html);
  const title =
    firstMeta(meta, "citation_title", "dc.title", "og:title", "twitter:title") ||
    cleanText(jsonLd.title ?? extractTitleTag(html));
  const authors =
    meta.get("citation_author")?.join(", ") ||
    firstMeta(meta, "dc.creator", "author") ||
    jsonLd.authors ||
    "";
  const date =
    firstMeta(meta, "citation_publication_date", "citation_date", "article:published_time", "date") ||
    jsonLd.date ||
    "";
  const doi =
    firstMeta(meta, "citation_doi", "dc.identifier", "prism.doi") ||
    jsonLd.doi ||
    "";

  return {
    title,
    authors: cleanText(authors),
    year: findYear(date),
    doi: normalizeDoi(doi),
  };
}

function parseJsonLd(html: string): { title?: string; authors?: string; date?: string; doi?: string } {
  const scriptPattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const nodes = flattenJsonLd(parsed);
      const article = nodes.find((node) => {
        const type = node["@type"];
        const values = Array.isArray(type) ? type : [type];
        return values.some((value) => /article|scholarlyarticle|medicalscholarlyarticle/i.test(String(value)));
      });
      if (!article) continue;

      const rawAuthors = Array.isArray(article.author) ? article.author : [article.author];
      const authors = rawAuthors
        .filter(Boolean)
        .map((author) =>
          typeof author === "string"
            ? author
            : typeof author === "object" && author
              ? String((author as Record<string, unknown>).name ?? "")
              : "",
        )
        .filter(Boolean)
        .join(", ");

      return {
        title: cleanText(String(article.headline ?? article.name ?? "")),
        authors,
        date: String(article.datePublished ?? ""),
        doi: normalizeDoi(
          String(article.doi ?? article.identifier ?? article.sameAs ?? ""),
        ),
      };
    } catch {
      continue;
    }
  }
  return {};
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = flattenJsonLd(record["@graph"]);
  return [record, ...graph];
}

function inferDesign(text: string): string {
  const value = text.toLowerCase();
  if (/cluster[- ]randomi[sz]ed|cluster random/i.test(value)) return "RCT — cluster";
  if (/cross[- ]?over (?:randomi[sz]ed )?(?:trial|study)|randomi[sz]ed cross[- ]?over/i.test(value)) {
    return "RCT — crossover";
  }
  if (/quasi[- ]?random|quasi[- ]?experimental/i.test(value)) return "Quasi-RCT";
  if (/randomi[sz]ed controlled trial|randomly (?:assigned|allocated)|double[- ]blind trial/i.test(value)) {
    return "RCT — parallel";
  }
  if (/diagnostic (?:test )?accuracy|sensitivity and specificity|index test[\s\S]*reference standard/i.test(value)) {
    return /case[- ]control/i.test(value) ? "DTA — case-control" : "DTA — cohort";
  }
  if (/prospective cohort|prospective longitudinal/i.test(value)) return "Cohort — prospective";
  if (/retrospective cohort|retrospective longitudinal/i.test(value)) return "Cohort — retrospective";
  if (/case[- ]control/i.test(value)) return "Case-control";
  if (/cross[- ]sectional/i.test(value)) return "Cross-sectional";
  if (/case series/i.test(value)) return "Case series";
  return "";
}

function inferDiagnosticFields(text: string): Pick<ArticleMetadata, "indexTest" | "referenceStandard"> {
  const indexTest = captureField(text, /index test (?:was|were|is|included|consisted of|:)\s*([^.;\n]{3,140})/i);
  const referenceStandard = captureField(
    text,
    /reference standard (?:was|were|is|included|consisted of|:)\s*([^.;\n]{3,140})/i,
  );
  return { indexTest, referenceStandard };
}

function mergeDiagnosticFields(
  preferred: ArticleMetadata,
  fallback: ArticleMetadata,
): Pick<ArticleMetadata, "indexTest" | "referenceStandard"> {
  return {
    indexTest: preferred.indexTest || fallback.indexTest,
    referenceStandard: preferred.referenceStandard || fallback.referenceStandard,
  };
}

function captureField(text: string, pattern: RegExp): string {
  return cleanText(text.match(pattern)?.[1] ?? "").slice(0, 140);
}

function toSuggestion(
  metadata: ArticleMetadata,
  source: StudyImportKind,
  sourceName: string,
): StudyImportSuggestion {
  const title = cleanText(metadata.title ?? "");
  const authors = cleanText(metadata.authors ?? "");
  const year = metadata.year ?? null;
  return {
    label: makeLabel(title, authors, year, sourceName),
    year,
    authors,
    doi: normalizeDoi(metadata.doi ?? ""),
    design: metadata.design ?? "",
    indexTest: metadata.indexTest ?? "",
    referenceStandard: metadata.referenceStandard ?? "",
    notes: `Details suggested from ${source === "pdf" ? "PDF" : source === "doi" ? "DOI" : "webpage"}. Please check them before adding the study.`,
  };
}

function makeLabel(title: string, authors: string, year: number | null, fallback: string): string {
  if (!title) return cleanText(fallback.replace(/\.pdf$/i, ""));
  const firstAuthor = authors.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
  const prefix = [firstAuthor, year].filter(Boolean).join(" ");
  const shortened = title.length > 140 ? `${title.slice(0, 137)}...` : title;
  return prefix ? `${prefix} — ${shortened}` : shortened;
}

async function fetchPublicHtml(initialUrl: URL): Promise<{ html: string; finalUrl: string }> {
  let current = initialUrl;

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicHost(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "RevKit/0.2 study metadata reader",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The webpage redirected without a destination.");
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) throw new Error("The webpage could not be opened.");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("That link is not a readable article webpage.");
    }

    return { html: await readLimitedText(response, MAX_HTML_BYTES), finalUrl: current.toString() };
  }

  throw new Error("The webpage redirected too many times.");
}

async function readLimitedText(response: Response, limit: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > limit) throw new Error("The webpage is too large to read.");

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("The webpage is too large to read.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function normalizePublicUrl(input: string): URL {
  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete webpage link.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP or HTTPS webpage links are supported.");
  }
  if (url.username || url.password) throw new Error("Links containing passwords are not supported.");
  return url;
}

async function assertPublicHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local network links cannot be imported.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network links cannot be imported.");
  }
}

function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (value.includes(":")) {
    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80:") ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }

  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function normalizeDoi(value: string): string {
  const decoded = decodeURIComponentSafely(value)
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  const match = decoded.match(DOI_PATTERN);
  return (match?.[0] ?? "").replace(/[\s\])}>.,;:]+$/g, "");
}

function findDoi(value: string): string | null {
  return value.match(DOI_PATTERN)?.[0]?.replace(/[\s\])}>.,;:]+$/g, "") ?? null;
}

function firstYear(value?: { "date-parts"?: number[][] }): number | null {
  const year = value?.["date-parts"]?.[0]?.[0];
  return Number.isInteger(year) ? year ?? null : null;
}

function findYear(value: string): number | null {
  const match = value.match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function firstMeta(meta: Map<string, string[]>, ...keys: string[]): string {
  for (const key of keys) {
    const value = meta.get(key)?.find(Boolean);
    if (value) return cleanText(value);
  }
  return "";
}

function extractTitleTag(html: string): string {
  return decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function cleanText(value: string): string {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function decodeURIComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
