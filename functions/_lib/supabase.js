/* Chamadas à Management API do Supabase.
   Uma única chave (SUPABASE_ACCESS_TOKEN) lê a lista de projetos e os logs
   de acesso (fonte edge_logs) de cada um. Janela máxima da API: 24 h.

   O endpoint de logs aceita só 10 consultas por minuto, então os 5 conjuntos
   de dados de cada projeto (resumo, por hora, endpoints, cidades, recentes)
   saem em UMA consulta com UNION ALL, separados pela coluna "kind". */

import { resolveGeo } from './geo.js';

const API = 'https://api.supabase.com';

async function api(env, path, retry) {
  const r = await fetch(API + path, {
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN },
  });
  if (r.status === 429) {
    const wait = Math.min(Number(r.headers.get('Retry-After')) || 15, 30);
    if (retry) {
      await new Promise((ok) => setTimeout(ok, (wait + 1) * 1000));
      return api(env, path, false);
    }
    throw new Error('Muitas consultas por minuto (429). Aumente CACHE_SECONDS.');
  }
  if (r.status === 401) throw new Error('Token inválido ou expirado');
  if (r.status === 403) {
    let msg = 'Token sem permissão';
    try { const j = await r.json(); if (j.message) msg = 'Token sem permissão: ' + j.message; } catch (e) { /* corpo não é JSON */ }
    throw new Error(msg);
  }
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg = j.message || j.error || msg; } catch (e) { /* corpo não é JSON */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return r.json();
}

export async function listProjects(env) {
  const list = await api(env, '/v1/projects');
  return list.map((p) => ({
    ref: p.id,
    name: p.name,
    region: p.region,
    supabaseStatus: p.status,
  }));
}

/* Consulta SQL na fonte edge_logs de um projeto (Logs > API Gateway). */
async function queryLogs(env, ref, sql) {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600e3);
  const qs = new URLSearchParams({
    sql,
    iso_timestamp_start: start.toISOString(),
    iso_timestamp_end: end.toISOString(),
  });
  const j = await api(env, '/v1/projects/' + ref + '/analytics/endpoints/logs?' + qs, true);
  if (j && j.error) {
    const msg = typeof j.error === 'string' ? j.error : (j.error.message || JSON.stringify(j.error));
    throw new Error(msg);
  }
  return (j && j.result) || [];
}

/* Colunas genéricas: kind + s1..s5 (textos) + n1..n6 (números).
   summary: n1 total, n2 e5, n3 e4, n4 p95, n5 ips, n6 países
   hourly:  s1 hora  | n1 total, n2 erros 5xx
   paths:   s1 método, s2 caminho | n1 slot 3h, n2 total, n3 e5, n4 p95
   geo:     s1 cidade, s2 país | n1 lat, n2 lon, n3 total, n4 negados (401/403)
   recent:  s1 quando, s2 método, s3 caminho, s4 cidade, s5 país | n1 status, n2 latência */
/* O endpoint não aceita CTE (with ... as), então cada bloco do UNION ALL
   lê a tabela logs diretamente, com os campos vindos do mapa log_attributes. */
const F = {
  method: "log_attributes['request.method']",
  path: "log_attributes['request.path']",
  status: "toInt32OrZero(log_attributes['response.status_code'])",
  otime: "toFloat64OrZero(log_attributes['response.origin_time'])",
  ip: "log_attributes['request.headers.cf_connecting_ip']",
  city: "log_attributes['request.cf.city']",
  country: "log_attributes['request.cf.country']",
  lat: "toFloat64OrZero(log_attributes['request.cf.latitude'])",
  lon: "toFloat64OrZero(log_attributes['request.cf.longitude'])",
};
const BASE = "from logs where source = 'edge_logs'";
const COLS = 'kind, s1, s2, s3, s4, s5, n1, n2, n3, n4, n5, n6';
const SQL_ALL = `select 'summary' as kind, '' as s1, '' as s2, '' as s3, '' as s4, '' as s5,
  toFloat64(count()) as n1,
  toFloat64(countIf(${F.status} >= 500)) as n2,
  toFloat64(countIf(${F.status} >= 400 and ${F.status} < 500)) as n3,
  toFloat64(quantile(0.95)(${F.otime})) as n4,
  toFloat64(uniqExact(${F.ip})) as n5,
  toFloat64(uniqExactIf(${F.country}, ${F.country} != '')) as n6
${BASE}
union all
select 'hourly' as kind, formatDateTime(toStartOfHour(timestamp), '%Y-%m-%dT%H:00:00Z') as s1,
  '' as s2, '' as s3, '' as s4, '' as s5,
  toFloat64(count()) as n1, toFloat64(countIf(${F.status} >= 500)) as n2,
  toFloat64(0) as n3, toFloat64(0) as n4, toFloat64(0) as n5, toFloat64(0) as n6
${BASE} group by s1
union all
select ${COLS} from (
  select 'paths' as kind, ${F.method} as s1, ${F.path} as s2, '' as s3, '' as s4, '' as s5,
    toFloat64(floor((23 - dateDiff('hour', timestamp, now())) / 3)) as n1,
    toFloat64(count()) as n2, toFloat64(countIf(${F.status} >= 500)) as n3,
    toFloat64(quantile(0.95)(${F.otime})) as n4, toFloat64(0) as n5, toFloat64(0) as n6
  ${BASE} group by s1, s2, n1 order by n2 desc limit 300
)
union all
select ${COLS} from (
  select 'geo' as kind, ${F.city} as s1, ${F.country} as s2, '' as s3, '' as s4, '' as s5,
    any(${F.lat}) as n1, any(${F.lon}) as n2,
    toFloat64(count()) as n3, toFloat64(countIf(${F.status} in (401, 403))) as n4,
    toFloat64(0) as n5, toFloat64(0) as n6
  ${BASE} and ${F.city} != '' group by s1, s2 order by n3 desc limit 60
)
union all
select ${COLS} from (
  select 'recent' as kind, formatDateTime(timestamp, '%Y-%m-%dT%H:%i:%SZ') as s1,
    ${F.method} as s2, ${F.path} as s3, ${F.city} as s4, ${F.country} as s5,
    toFloat64(${F.status}) as n1, ${F.otime} as n2,
    toFloat64(0) as n3, toFloat64(0) as n4, toFloat64(0) as n5, toFloat64(0) as n6
  ${BASE} order by timestamp desc limit 25
)`;

/* Lê os dados completos de um projeto. Projetos pausados não têm logs para ler. */
export async function projectData(env, p) {
  const base = { ...p, summary: null, hourly: [], paths: [], geo: [], recent: [] };
  if (p.supabaseStatus !== 'ACTIVE_HEALTHY') return base;
  try {
    const rows = await queryLogs(env, p.ref, SQL_ALL);
    const out = { ...base };
    const int = (v) => Math.round(Number(v) || 0);
    for (const r of rows) {
      if (r.kind === 'summary') {
        out.summary = { total: int(r.n1), e5: int(r.n2), e4: int(r.n3), p95: int(r.n4), ips: int(r.n5), countries: int(r.n6) };
      } else if (r.kind === 'hourly') {
        out.hourly.push({ h: r.s1, n: int(r.n1), e: int(r.n2) });
      } else if (r.kind === 'paths') {
        const slot = int(r.n1);
        if (slot >= 0 && slot <= 7) out.paths.push({ method: r.s1, path: r.s2, slot, n: int(r.n2), e: int(r.n3), p95: int(r.n4) });
      } else if (r.kind === 'geo') {
        const pos = resolveGeo(r.s1, r.s2, Number(r.n1), Number(r.n2));
        if (pos) out.geo.push({ city: r.s1, country: r.s2, lat: pos.lat, lon: pos.lon, n: int(r.n3), denied: int(r.n4) });
      } else if (r.kind === 'recent') {
        out.recent.push({ ts: r.s1, method: r.s2, path: r.s3, status: int(r.n1), latency: int(r.n2), city: r.s4 || null, country: r.s5 || null });
      }
    }
    out.hourly.sort((a, b) => (a.h < b.h ? -1 : 1));
    out.recent.sort((a, b) => (a.ts > b.ts ? -1 : 1));
    return out;
  } catch (e) {
    return { ...base, error: String((e && e.message) || e) };
  }
}
