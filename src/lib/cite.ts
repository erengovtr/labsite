// frontmatter metinlerindeki [@PMID] atıflarını sıra numarasına çevirir (gövde metni için tools/remark-cite.mjs).
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function citeHtml(text: string, sources: string[]): string {
  return esc(text).replace(/\[@(\d+)\]/g, (_, id) => {
    const n = sources.indexOf(id) + 1;
    if (n === 0) throw new Error(`[@${id}] atfı 'sources' listesinde yok: ${text}`);
    return `<sup class="cite"><a href="#k-${id}">[${n}]</a></sup>`;
  });
}
