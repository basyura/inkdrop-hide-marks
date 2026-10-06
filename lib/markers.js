const { parser } = require("@lezer/markdown");

const cache = new WeakMap();

function markersFor(doc) {
  if (cache.has(doc)) return cache.get(doc);
  const text = doc.toString();
  const markers = [];
  parser.parse(text).iterate({
    enter(node) {
      if (node.name !== "StrongEmphasis") return;
      const first = node.node.firstChild;
      const last = node.node.lastChild;
      if (text.slice(first.from, first.to) !== "**" ||
          text.slice(last.from, last.to) !== "**") return;
      const strong = { strongFrom: node.from, strongTo: node.to };
      markers.push({ from: first.from, to: first.to, opening: true, ...strong });
      markers.push({ from: last.from, to: last.to, opening: false, ...strong });
    },
  });
  markers.sort((a, b) => a.from - b.from);
  cache.set(doc, markers);
  return markers;
}

module.exports = { markersFor };
