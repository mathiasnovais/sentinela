# Sentinela: monitor dos bancos da rede

Painel que mostra, em um lugar só, o tráfego de todos os projetos Supabase da rede Alfacem: requisições, latência, erros, endpoints mais usados e de onde vêm os acessos (mapa). Nada é instalado nos bancos e nenhuma plataforma precisa ser alterada: o Sentinela só lê a API de gerenciamento do Supabase, com uma única chave de leitura guardada no servidor.

Sem nenhuma configuração, o painel abre em modo demonstração, com dados de exemplo. Depois dos passos abaixo, ele passa a mostrar os projetos de verdade.

## Como está organizado

```
sentinela/
├── public/                  site (o que o navegador baixa)
│   ├── index.html           painel completo (telas, layout, design system e React embutidos)
│   └── plataformas.json     ref do projeto: nome e link da plataforma que usa aquele banco
├── functions/               servidor (roda no Cloudflare Pages e guarda o token)
│   ├── api/overview.js      GET /api/overview: dados de todos os projetos
│   ├── api/health.js        GET /api/health: teste de conexão
│   └── _lib/
│       ├── supabase.js      chamadas e consulta SQL (dialeto ClickHouse) à Management API
│       ├── geo.js           cidade/país para coordenadas no mapa
│       └── demo.js          dados de demonstração
├── wrangler.toml            configuração do Cloudflare Pages
├── .dev.vars.example        modelo do .dev.vars para testar no computador
└── package.json
```

## Stack

- Painel: HTML e React embutidos num único `index.html`, sem build.
- Servidor: Cloudflare Pages Functions (`functions/`), publicado com o wrangler.
- Dados: API de gerenciamento do Supabase (lista de projetos e logs de acesso das últimas 24 h de cada banco PostgreSQL gerenciado pelo Supabase).

## Como funciona a conexão

1. Você gera um token de acesso pessoal no Supabase (começa com `sbp_`), só com permissões de leitura.
2. Esse token fica guardado como segredo no Cloudflare. Só o servidor lê; ele nunca aparece no navegador.
3. O servidor pede ao Supabase a lista de todos os projetos das organizações da conta. Projeto novo aparece sozinho.
4. Para cada projeto, lê os logs de acesso das últimas 24 h (os mesmos de Logs > API Gateway no painel do Supabase): endpoint, status, latência, cidade, país e coordenadas.

Como o endpoint de logs aceita só 10 consultas por minuto, `functions/_lib/supabase.js` faz uma consulta SQL por projeto, juntando com `UNION ALL` os cinco conjuntos de dados (resumo, tráfego por hora, endpoints por faixa de 3 h, cidades e últimas 25 requisições), e o resultado fica em cache por `CACHE_SECONDS`. Quando os logs não trazem latitude e longitude, `geo.js` resolve a posição pela cidade e país.

## Como publicar

1. Gere o token em https://supabase.com/dashboard/account/tokens, com a conta que tem acesso às organizações da rede. Em Resource access marque a organização; em Permissions marque Read em Projects (account-wide), Organization Projects, Project Settings e Logs. Todo o resto fica em None. Copie o token: ele só aparece uma vez.
2. Publique no Cloudflare Pages. Pelo GitHub: Workers & Pages > Create > Pages > Connect to Git, framework None, build command vazio, build output directory `public`. Ou pelo terminal: `npm install`, `npx wrangler login`, `npx wrangler pages deploy`.
3. Cadastre o segredo: Settings > Variables and Secrets > Add, tipo Secret, nome `SUPABASE_ACCESS_TOKEN`, ambiente Production (ou `npx wrangler pages secret put SUPABASE_ACCESS_TOKEN`). Publique de novo: segredos só valem para publicações feitas depois de criados.
4. Confira em `https://SEU-ENDERECO/api/health`: o esperado é `tokenConfigurado: true`, `supabase: "ok"` e a quantidade de projetos. No painel, a faixa de "Dados de exemplo" some.
5. Ligue cada banco à sua plataforma em `public/plataformas.json`: a chave é o ref do projeto (Project Settings > General > Reference ID), com `nome`, `url` e `descricao` opcionais. Sem `url`, o card mostra "Definir link" no lugar de "Abrir plataforma".
6. Proteja o acesso: o painel mostra caminhos, IPs e cidades de quem acessa as plataformas. Use o Cloudflare Access (Zero Trust > Access > Applications > Self-hosted) com uma política Allow para os e-mails autorizados.

Ajustes opcionais em `wrangler.toml` ou nas variáveis do projeto: `CACHE_SECONDS` (padrão 60) e `SUPABASE_PROJECT_REFS` (refs separados por vírgula para monitorar só alguns projetos). O painel se atualiza sozinho a cada 60 s; o botão Atualizar força uma leitura nova.

## Testar no computador

```bash
npm install
cp .dev.vars.example .dev.vars   # e cole o token dentro
npx wrangler pages dev           # abre em http://localhost:8788
```

O `.dev.vars` está no `.gitignore`. Nunca envie esse arquivo para o GitHub.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| Faixa "Dados de exemplo" | O segredo não foi criado ou o site não foi publicado de novo depois dele. |
| "Token inválido ou expirado" | Gere outro token e troque o valor do segredo. |
| Card com status Sem logs | O token não tem permissão de ler logs daquele projeto, ou a conta não é membro daquela organização. |
| Card com status Pausado | O projeto está pausado no Supabase. |
| Erro 429 | Muitas consultas por minuto. Aumente `CACHE_SECONDS` para 120 ou 300. |
| Mapa vazio, mas há requisições | As chamadas vêm de servidores sem localização (chamadas internas, por exemplo). |
| Botão diz Definir link | Falta a `url` daquele ref em `public/plataformas.json`. |

## Dados

Este repositório não contém dados pessoais nem tokens. O `public/plataformas.json` traz um ref fictício de exemplo; troque pelos refs reais na sua cópia. Os arquivos de importação e as listas ficam fora por LGPD.
