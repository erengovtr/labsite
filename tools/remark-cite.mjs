// [@37366315] biçimindeki atıfları, frontmatter'daki `sources` sırasına göre [n] bağlantısına çevirir.
// Atıf yapılan PMID `sources` içinde yoksa derleme hata verir.
import { visit } from 'unist-util-visit';

export default function remarkCite() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter ?? {};
    const sources = (fm.sources ?? []).map(String);
    visit(tree, 'text', (node, index, parent) => {
      if (!node.value.includes('[@')) return;
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(/\[@(\d+)\]/g)) {
        const n = sources.indexOf(m[1]) + 1;
        if (n === 0) throw new Error(`${file.path}: [@${m[1]}] atfı frontmatter 'sources' listesinde yok`);
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        parts.push({ type: 'html', value: `<sup class="cite"><a href="#k-${m[1]}">[${n}]</a></sup>` });
        last = m.index + m[0].length;
      }
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}
