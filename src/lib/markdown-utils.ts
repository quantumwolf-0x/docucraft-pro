export interface MdHeading {
  id: string;
  text: string;
  level: number;
  fileId: string;
  children: MdHeading[];
}

export interface MdFile {
  id: string;
  name: string;
  content: string;
  headings: MdHeading[];
}

import GithubSlugger, { slug } from "github-slugger";

// Stateless slug matching rehype-slug (github-slugger) so sidebar/ToC ids
// line up exactly with the DOM ids rendered by rehypeSlug. Local ad-hoc
// slugging drifted on `&`, `/`, and other punctuation, breaking navigation.
export function slugify(text: string): string {
  return slug(text) || "section";
}

export function parseHeadings(content: string, fileId: string): MdHeading[] {
  const lines = content.split("\n");
  const flat: MdHeading[] = [];
  // A fresh slugger per file mirrors rehypeSlug's per-document dedup counter.
  const slugger = new GithubSlugger();
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    const id = slugger.slug(text || "section");
    flat.push({ id, text, level, fileId, children: [] });
  }
  // build tree
  const root: MdHeading[] = [];
  const stack: MdHeading[] = [];
  for (const h of flat) {
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    if (stack.length === 0) root.push(h);
    else stack[stack.length - 1].children.push(h);
    stack.push(h);
  }
  return root;
}

export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function flattenHeadings(headings: MdHeading[]): MdHeading[] {
  const out: MdHeading[] = [];
  const walk = (hs: MdHeading[]) => {
    for (const h of hs) {
      out.push(h);
      walk(h.children);
    }
  };
  walk(headings);
  return out;
}
