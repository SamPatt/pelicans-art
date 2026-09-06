// Descriptive technical results only. Human preference is deliberately left unrated.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const run=process.argv[2]||'astra-isolated';
if(!/^[a-zA-Z0-9_-]+$/.test(run))throw Error('Use a simple run name');
const root=path.join(here,'runs',run);
const report=JSON.parse(await fs.readFile(path.join(root,'review/results.json')));
const rows=report.results;
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const columns=['id','briefId','methodId','phase','parent','status','promptCharacters','characters','bytes','errors','warnings'];
const csv=[columns.join(','),...rows.map(r=>columns.map(k=>quote(Array.isArray(r[k])?r[k].join(' | '):r[k])).join(','))].join('\n')+'\n';
await fs.writeFile(path.join(root,'technical-results.csv'),csv);
const groups=[...report.methods.map(m=>({...m,phase:'first-pass'})),{id:'agent-current',title:'Current agent: second fresh draft',phase:'fresh-repeat'},{id:'visual-revision',title:'Current agent: visual revision',phase:'revision'}].filter(m=>rows.some(r=>r.methodId===m.id&&r.phase===m.phase));
let md='# Technical results\n\nThese are contract checks, not aesthetic scores. All planned candidates remain in the denominator. A pass does not establish full animation compatibility.\n\n| Recipe / phase | Planned | Passed | Contract failed | Render failed | Missing | Warnings | Median bytes |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
for(const g of groups){const subset=rows.filter(r=>r.methodId===g.id&&r.phase===g.phase);const counts=status=>subset.filter(r=>r.status===status).length;const sizes=subset.filter(r=>Number.isFinite(r.bytes)).map(r=>r.bytes).sort((a,b)=>a-b);const median=sizes.length?(sizes[Math.floor((sizes.length-1)/2)]+sizes[Math.floor(sizes.length/2)])/2:'—';md+=`| ${g.title} | ${subset.length} | ${counts('passed')} | ${counts('contract-failed')} | ${counts('render-failed')} | ${counts('missing')} | ${subset.filter(r=>r.warnings.length).length} | ${median} |\n`;}
md+='\n## Paired controls\n\nUse each row to compare the same brief. IDs are shown here only after blind judging. The gallery hides recipes by default.\n\n| Brief | Current agent | Browser | Minimal | Art direction | Layout plan | Reference | Second agent draft | Revision of first agent draft |\n|---|---|---|---|---|---|---|---|---|\n';
for(const b of report.briefs){const find=(method,phase='first-pass')=>rows.find(r=>r.briefId===b.id&&r.methodId===method&&r.phase===phase)?.id||'—';md+=`| ${b.title} | ${find('agent-current')} | ${find('current')} | ${find('minimal')} | ${find('art-direction')} | ${find('layout-plan')} | ${find('reference')} | ${find('agent-current','fresh-repeat')} | ${find('visual-revision','revision')} |\n`;}
md+='\n## Review flags\n';for(const r of rows.filter(r=>r.errors.length||r.warnings.length)){md+=`\n- **${r.id}** (${r.status}): ${[...r.errors,...r.warnings].join('; ')}\n`;}
md+='\n## Human assessment\n\nNot yet collected. No aesthetic winner or improvement rate is inferred from technical pass rates. Export ratings from the review after comparing all six briefs. Analyze each axis separately against the current agent control; retain the browser comparison. For the two-candidate workflows, compare the preferred original-or-revised result against the preferred original-or-second-fresh-draft result, and record ties and revision regressions. Candidate count is matched; tokens and inference time are not.\n';
await fs.writeFile(path.join(root,'technical-results.md'),md);
await fs.writeFile(path.join(root,'review/technical-results.csv'),csv);
await fs.writeFile(path.join(root,'review/technical-results.md'),md);
console.log(JSON.stringify({trials:rows.length,report:path.join(root,'technical-results.md'),csv:path.join(root,'technical-results.csv')}));
