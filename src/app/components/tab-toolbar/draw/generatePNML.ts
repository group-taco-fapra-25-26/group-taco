type Arc = {
  source: string;
  target: string;
  weight: number;
};

function parseExpression(input: string): Arc[] {
  const terms = input.split("+").map(t => t.trim());
  const arcs: Arc[] = [];

  for (const term of terms) {
    const weightMatch = term.match(/^(\d+)\s*\*\s*\((.+)\)$/);
    const simpleMatch = term.match(/^\((.+)\)$/);

    let weight = 1;
    let content: string;

    if (weightMatch) {
      weight = parseInt(weightMatch[1], 10);
      content = weightMatch[2];
    } else if (simpleMatch) {
      content = simpleMatch[1];
    } else {
      throw new Error(`Ungültiger Term: ${term}`);
    }

    const [source, target] = content.split(",").map(s => s.trim());
    arcs.push({ source, target, weight });
  }

  return arcs;
}

function isPlace(id: string): boolean {
  return id.startsWith("p");
}

function generatePNML(arcs: Arc[]): string {
  const places = new Set<string>();
  const transitions = new Set<string>();

  arcs.forEach(a => {
    if (isPlace(a.source)) places.add(a.source);
    else transitions.add(a.source);

    if (isPlace(a.target)) places.add(a.target);
    else transitions.add(a.target);
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<pnml>\n  <net id="net1" type="http://www.pnml.org/version-2009/grammar/pnml">\n`;

  places.forEach(p => {
    xml += `    <place id="${p}"/>\n`;
  });

  transitions.forEach(t => {
    xml += `    <transition id="${t}"/>\n`;
  });

  arcs.forEach((a, i) => {
    xml += `    <arc id="a${i}" source="${a.source}" target="${a.target}">\n`;
    xml += `      <inscription>\n`;
    xml += `        <text>${a.weight}</text>\n`;
    xml += `      </inscription>\n`;
    xml += `    </arc>\n`;
  });

  xml += `  </net>\n</pnml>`;
  return xml;
}
