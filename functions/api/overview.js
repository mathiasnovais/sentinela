/* GET /api/overview → dados de todos os projetos monitorados.
   Sem token configurado, responde os dados de demonstração (demo: true).
   Reaproveita a última leitura por CACHE_SECONDS (padrão 60) para não
   estourar o limite de consultas da Management API. */

import { listProjects, projectData } from '../_lib/supabase.js';
import { demoOverview } from '../_lib/demo.js';

let cache = { at: 0, body: null };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.SUPABASE_ACCESS_TOKEN) return json(demoOverview());

  const fresh = new URL(request.url).searchParams.has('fresh');
  const ttl = Math.max(10, Number(env.CACHE_SECONDS) || 60) * 1000;
  if (!fresh && cache.body && Date.now() - cache.at < ttl) return json(cache.body);

  try {
    let projects = await listProjects(env);
    const only = (env.SUPABASE_PROJECT_REFS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (only.length) projects = projects.filter((p) => only.includes(p.ref));

    // Lê 2 projetos por vez (5 consultas cada) para respeitar o limite da API.
    const out = [];
    for (let i = 0; i < projects.length; i += 2) {
      const batch = await Promise.all(projects.slice(i, i + 2).map((p) => projectData(env, p)));
      out.push(...batch);
    }

    const body = { demo: false, generatedAt: new Date().toISOString(), projects: out };
    cache = { at: Date.now(), body };
    return json(body);
  } catch (e) {
    if (cache.body) return json(cache.body); // falha momentânea: serve a última leitura boa
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
