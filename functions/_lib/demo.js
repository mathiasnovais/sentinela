/* Dados de demonstração: usados quando SUPABASE_ACCESS_TOKEN não está configurado.
   Mesmo gerador do modo offline do painel (index.html), para a experiência ser igual. */

let seed = 42;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const CITIES = [
  ['Rio de Janeiro', 'BR', -22.9, -43.2, 9], ['São Paulo', 'BR', -23.5, -46.6, 5], ['Niterói', 'BR', -22.88, -43.1, 3],
  ['Belo Horizonte', 'BR', -19.9, -43.9, 1.5], ['Lisboa', 'PT', 38.7, -9.1, 0.8], ['Ashburn', 'US', 39.0, -77.5, 1.2],
  ['Frankfurt', 'DE', 50.1, 8.7, 0.3], ['Singapura', 'SG', 1.35, 103.8, 0.15],
];
const PATHS = [
  ['GET', '/rest/v1/alunos'], ['POST', '/auth/v1/token'], ['GET', '/rest/v1/notas'], ['GET', '/storage/v1/object/boletins'],
  ['POST', '/functions/v1/notificar'], ['POST', '/rest/v1/rpc/boletim'], ['GET', '/realtime/v1/websocket'], ['PATCH', '/rest/v1/matriculas'],
];
const PEAK = [0.05, 0.02, 0.35, 1, 0.8, 0.9, 0.55, 0.2];

function project(ref, name, region, scale, errRate) {
  seed = ref.length * 97 + scale;
  const now = Date.now();
  const hourly = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600e3);
    d.setUTCMinutes(0, 0, 0);
    const hr = (d.getUTCHours() + 21) % 24;
    const n = Math.round(scale * PEAK[Math.floor(hr / 3)] * (0.7 + rnd() * 0.6));
    hourly.push({ h: d.toISOString().slice(0, 19) + 'Z', n, e: Math.round(n * errRate * rnd() * 2) });
  }
  const total = hourly.reduce((s, x) => s + x.n, 0);
  const e5 = hourly.reduce((s, x) => s + x.e, 0);
  const paths = [];
  PATHS.forEach(([method, path], pi) => {
    for (let slot = 0; slot < 8; slot++) {
      const n = Math.round((scale / 6) * PEAK[slot] * (0.2 + rnd()) * (pi % 3 === 1 ? 1.6 : 1));
      if (n) paths.push({ method, path, slot, n, e: Math.round(n * errRate * (pi === 7 ? 6 : rnd())), p95: Math.round(80 + rnd() * (pi === 7 ? 1400 : 300)) });
    }
  });
  const geo = CITIES.map(([city, country, lat, lon, w]) => ({ city, country, lat, lon, n: Math.round(total * w / 21 * (0.6 + rnd() * 0.8)), denied: Math.round(rnd() * (country === 'SG' ? 30 : 4)) }));
  const recent = [];
  for (let i = 0; i < 25; i++) {
    const [method, path] = pick(PATHS);
    const c = pick(CITIES.slice(0, 5));
    const r = rnd();
    recent.push({ ts: new Date(now - i * 47000 - rnd() * 30000).toISOString().slice(0, 19) + 'Z', method, path, status: r < errRate * 4 ? 500 : r < 0.08 ? 401 : method === 'POST' ? 201 : 200, latency: Math.round(40 + rnd() * rnd() * 1500), city: c[0], country: c[1] });
  }
  return {
    ref, name, region, supabaseStatus: 'ACTIVE_HEALTHY',
    summary: { total, e5, e4: Math.round(total * 0.02), p95: Math.round(120 + rnd() * 400), ips: Math.round(total / 60), countries: 6 },
    hourly, paths, geo, recent,
  };
}

export function demoOverview() {
  return {
    demo: true,
    generatedAt: new Date().toISOString(),
    projects: [
      project('xkqztdemoab19', 'portal-alunos', 'sa-east-1', 5200, 0.0008),
      project('pmv03democ7d2', 'crm-matriculas', 'sa-east-1', 1300, 0.02),
      project('hh81qdemo09fe', 'financeiro', 'us-east-1', 380, 0.001),
      { ref: 'ab12cdemo7788', name: 'biblioteca', region: 'sa-east-1', supabaseStatus: 'INACTIVE', summary: null, hourly: [], paths: [], geo: [], recent: [] },
    ],
  };
}
