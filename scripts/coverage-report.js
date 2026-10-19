// Turns coverage/lcov.info (from `npm run coverage`) into a one-page HTML
// report and a shields.io badge file, with no dependencies.
// Usage: node scripts/coverage-report.js [output folder, default coverage/html]

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "coverage/html"));

// lcov.info has one record per source file, ending in end_of_record.
function parseLcov(text) {
  return text.split("end_of_record").filter((r) => r.includes("SF:")).map((record) => {
    const file = { lines: new Map(), branches: new Map(), functions: [] };
    for (const line of record.trim().split("\n")) {
      const [key, value = ""] = line.split(/:(.*)/s);
      const parts = value.split(",");
      if (key === "SF") file.name = value;
      if (key === "DA") file.lines.set(Number(parts[0]), Number(parts[1]));
      if (key === "BRDA") {
        const list = file.branches.get(Number(parts[0])) || [];
        list.push(parts[3] === "-" ? 0 : Number(parts[3]));
        file.branches.set(Number(parts[0]), list);
      }
      if (key === "FNDA") file.functions.push(Number(parts[0]));
    }
    return file;
  });
}

function percent(hit, total) {
  return total ? Math.floor((hit / total) * 1000) / 10 : 100;
}

function stats(file) {
  const lines = [...file.lines.values()];
  const branches = [...file.branches.values()].flat();
  return {
    lines: percent(lines.filter((n) => n > 0).length, lines.length),
    branches: percent(branches.filter((n) => n > 0).length, branches.length),
    functions: percent(file.functions.filter((n) => n > 0).length, file.functions.length)
  };
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderSource(file) {
  const source = fs.readFileSync(path.resolve(ROOT, file.name), "utf8").split("\n");
  return source.map((code, i) => {
    const n = i + 1;
    const hits = file.lines.get(n);
    const branches = file.branches.get(n) || [];
    const missedBranch = branches.some((b) => b === 0);
    const kind = hits === 0 ? "miss" : missedBranch ? "partial" : hits > 0 ? "hit" : "";
    const count = hits > 0 ? `${hits}×` : hits === 0 ? "0×" : "";
    const title = missedBranch ? ` title="A branch on this line never ran"` : "";
    return `<tr class="${kind}"${title}><td class="n">${n}</td><td class="c">${count}</td><td><code>${escape(code) || " "}</code></td></tr>`;
  }).join("\n");
}

function renderPage(files) {
  const all = files.map((f) => ({ f, s: stats(f) }));
  const totalLines = [...files.flatMap((f) => [...f.lines.values()])];
  const overall = percent(totalLines.filter((n) => n > 0).length, totalLines.length);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const sections = all.map(({ f, s }) => `
  <section>
    <h2>${escape(f.name)}</h2>
    <div class="stats">
      <div><b>${s.lines}%</b><span>lines</span></div>
      <div><b>${s.branches}%</b><span>branches</span></div>
      <div><b>${s.functions}%</b><span>functions</span></div>
    </div>
    <div class="source"><table>${renderSource(f)}</table></div>
  </section>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tab Selfie coverage</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #1c5c55; --coral: #F57E76; --mint: #66D0C4; --teal: #38B8A9; --fg: #fff; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: Poppins, system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 40px 16px 64px; }
  h1 { font-size: clamp(2rem, 6vw, 3.5rem); font-weight: 800; margin: 0; }
  .hero { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px; }
  .big { font-size: clamp(3.5rem, 14vw, 7rem); font-weight: 800; line-height: 1; color: var(--mint); }
  .meta { opacity: .75; margin: 8px 0 32px; }
  h2 { font-size: 1.5rem; margin: 40px 0 16px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .stats div { background: rgba(255,255,255,.08); border-radius: 14px; padding: 16px 20px; }
  .stats b { display: block; font-size: 2.2rem; font-weight: 800; color: var(--mint); }
  .stats span { opacity: .8; }
  .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: .9rem; margin-bottom: 12px; }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .source { background: #123d39; border-radius: 14px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  td { padding: 0 10px; white-space: pre; vertical-align: top; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  td.n, td.c { text-align: right; opacity: .55; user-select: none; width: 1%; }
  tr.hit td:first-child { box-shadow: inset 4px 0 var(--teal); }
  tr.partial { background: rgba(245,126,118,.14); }
  tr.partial td:first-child { box-shadow: inset 4px 0 #f5c276; }
  tr.miss { background: rgba(245,126,118,.3); }
  tr.miss td:first-child { box-shadow: inset 4px 0 var(--coral); }
</style>
</head>
<body>
<main>
  <div class="hero"><h1>Tab Selfie coverage</h1><div class="big">${overall}%</div></div>
  <p class="meta">Lines covered by <code>npm test</code> · updated ${stamp}</p>
  <div class="legend">
    <span><i style="background:var(--teal)"></i>ran</span>
    <span><i style="background:#f5c276"></i>ran, but a branch never did</span>
    <span><i style="background:var(--coral)"></i>never ran</span>
  </div>
  ${sections}
</main>
</body>
</html>
`;
}

const files = parseLcov(fs.readFileSync(path.join(ROOT, "coverage/lcov.info"), "utf8"));
const lines = files.flatMap((f) => [...f.lines.values()]);
const overall = Math.floor(percent(lines.filter((n) => n > 0).length, lines.length));
const color = overall >= 90 ? "brightgreen" : overall >= 75 ? "yellow" : "red";

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), renderPage(files));
fs.writeFileSync(path.join(OUT, "coverage.json"), JSON.stringify({ schemaVersion: 1, label: "coverage", message: `${overall}%`, color }) + "\n");
console.log(`Coverage report: ${path.relative(process.cwd(), OUT)}/index.html (${overall}% of lines)`);
