/* GET /api/health → teste rápido de conexão com o Supabase (passo 4 do README). */

import { listProjects } from '../_lib/supabase.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  if (!env.SUPABASE_ACCESS_TOKEN) {
    return json({ tokenConfigurado: false, supabase: 'sem token: crie o segredo SUPABASE_ACCESS_TOKEN e publique de novo', projetos: 0 });
  }
  try {
    const projects = await listProjects(env);
    return json({ tokenConfigurado: true, supabase: 'ok', projetos: projects.length });
  } catch (e) {
    return json({ tokenConfigurado: true, supabase: String((e && e.message) || e), projetos: 0 }, 502);
  }
}
