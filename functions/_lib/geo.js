/* Coordenadas de apoio para o mapa. Os logs do Supabase informam cidade e
   país, mas nem sempre latitude/longitude. Aqui resolvemos a posição:
   1) coordenada vinda do log, se houver; 2) cidade conhecida; 3) centro do país. */

// "cidade|PAÍS" (minúsculas, sem acento — como a Cloudflare escreve) → [lat, lon]
const CITIES = {
  // Brasil: capitais
  'sao paulo|BR': [-23.55, -46.63], 'rio de janeiro|BR': [-22.91, -43.17], 'brasilia|BR': [-15.79, -47.88],
  'salvador|BR': [-12.97, -38.51], 'fortaleza|BR': [-3.72, -38.54], 'belo horizonte|BR': [-19.92, -43.94],
  'manaus|BR': [-3.12, -60.02], 'curitiba|BR': [-25.43, -49.27], 'recife|BR': [-8.05, -34.88],
  'goiania|BR': [-16.68, -49.25], 'belem|BR': [-1.46, -48.49], 'porto alegre|BR': [-30.03, -51.23],
  'sao luis|BR': [-2.53, -44.30], 'maceio|BR': [-9.65, -35.71], 'natal|BR': [-5.79, -35.21],
  'teresina|BR': [-5.09, -42.80], 'campo grande|BR': [-20.44, -54.65], 'joao pessoa|BR': [-7.12, -34.86],
  'aracaju|BR': [-10.91, -37.07], 'cuiaba|BR': [-15.60, -56.10], 'porto velho|BR': [-8.76, -63.90],
  'florianopolis|BR': [-27.60, -48.55], 'macapa|BR': [0.03, -51.07], 'rio branco|BR': [-9.97, -67.81],
  'vitoria|BR': [-20.32, -40.34], 'boa vista|BR': [2.82, -60.67], 'palmas|BR': [-10.24, -48.36],
  // Brasil: outras cidades grandes
  'guarulhos|BR': [-23.45, -46.53], 'campinas|BR': [-22.91, -47.06], 'sao goncalo|BR': [-22.83, -43.05],
  'duque de caxias|BR': [-22.79, -43.31], 'nova iguacu|BR': [-22.76, -43.45], 'niteroi|BR': [-22.88, -43.10],
  'sao bernardo do campo|BR': [-23.69, -46.56], 'santo andre|BR': [-23.66, -46.53], 'osasco|BR': [-23.53, -46.79],
  'santos|BR': [-23.96, -46.33], 'sao jose dos campos|BR': [-23.18, -45.88], 'sorocaba|BR': [-23.50, -47.46],
  'ribeirao preto|BR': [-21.18, -47.81], 'uberlandia|BR': [-18.91, -48.28], 'juiz de fora|BR': [-21.76, -43.35],
  'contagem|BR': [-19.93, -44.05], 'feira de santana|BR': [-12.27, -38.97], 'londrina|BR': [-23.30, -51.17],
  'maringa|BR': [-23.42, -51.93], 'joinville|BR': [-26.30, -48.85], 'blumenau|BR': [-26.92, -49.07],
  'caxias do sul|BR': [-29.17, -51.18], 'pelotas|BR': [-31.77, -52.34], 'campina grande|BR': [-7.23, -35.88],
  'caruaru|BR': [-8.28, -35.98], 'petrolina|BR': [-9.39, -40.50], 'mossoro|BR': [-5.19, -37.34],
  'petropolis|BR': [-22.51, -43.18], 'volta redonda|BR': [-22.52, -44.10], 'campos dos goytacazes|BR': [-21.75, -41.33],
  'cabo frio|BR': [-22.88, -42.03], 'macae|BR': [-22.37, -41.79], 'anapolis|BR': [-16.33, -48.95],
  'dourados|BR': [-22.22, -54.81], 'cascavel|BR': [-24.96, -53.46], 'ponta grossa|BR': [-25.09, -50.16],
  'santarem|BR': [-2.44, -54.71], 'maraba|BR': [-5.37, -49.12], 'imperatriz|BR': [-5.53, -47.48],
  // Datacenters e cidades comuns em logs (saúde, robôs, CDNs)
  'ashburn|US': [39.04, -77.49], 'moncks corner|US': [33.20, -80.01], 'columbus|US': [39.96, -83.00],
  'boardman|US': [45.84, -119.70], 'san jose|US': [37.34, -121.89], 'council bluffs|US': [41.26, -95.86],
  'the dalles|US': [45.59, -121.18], 'new york|US': [40.71, -74.01], 'miami|US': [25.76, -80.19],
  'dallas|US': [32.78, -96.80], 'los angeles|US': [34.05, -118.24], 'chicago|US': [41.88, -87.63],
  'seattle|US': [47.61, -122.33], 'atlanta|US': [33.75, -84.39],
  'lisboa|PT': [38.72, -9.14], 'lisbon|PT': [38.72, -9.14], 'porto|PT': [41.15, -8.61],
  'frankfurt|DE': [50.11, 8.68], 'frankfurt am main|DE': [50.11, 8.68], 'berlin|DE': [52.52, 13.41],
  'amsterdam|NL': [52.37, 4.90], 'london|GB': [51.51, -0.13], 'paris|FR': [48.86, 2.35],
  'madrid|ES': [40.42, -3.70], 'milan|IT': [45.46, 9.19], 'dublin|IE': [53.35, -6.26],
  'warsaw|PL': [52.23, 21.01], 'stockholm|SE': [59.33, 18.06], 'zurich|CH': [47.37, 8.54],
  'singapore|SG': [1.35, 103.82], 'singapura|SG': [1.35, 103.82], 'tokyo|JP': [35.68, 139.69],
  'osaka|JP': [34.69, 135.50], 'seoul|KR': [37.57, 126.98], 'sydney|AU': [-33.87, 151.21],
  'mumbai|IN': [19.08, 72.88], 'hong kong|HK': [22.32, 114.17], 'toronto|CA': [43.65, -79.38],
  'montreal|CA': [45.50, -73.57], 'buenos aires|AR': [-34.60, -58.38], 'santiago|CL': [-33.45, -70.67],
  'montevideo|UY': [-34.90, -56.16], 'asuncion|PY': [-25.26, -57.58], 'bogota|CO': [4.71, -74.07],
  'lima|PE': [-12.05, -77.04], 'mexico city|MX': [19.43, -99.13], 'ciudad de mexico|MX': [19.43, -99.13],
  'luanda|AO': [-8.84, 13.23], 'maputo|MZ': [-25.97, 32.57], 'praia|CV': [14.93, -23.51],
  'johannesburg|ZA': [-26.20, 28.05],
};

// País (ISO2) → centro aproximado, usado quando a cidade não é conhecida.
const COUNTRIES = {
  BR: [-14.2, -51.9], US: [39.8, -98.6], PT: [39.6, -8.0], AR: [-34.0, -64.0], UY: [-32.5, -55.8],
  PY: [-23.4, -58.4], CL: [-35.7, -71.5], BO: [-16.3, -63.6], CO: [4.6, -74.3], PE: [-9.2, -75.0],
  EC: [-1.8, -78.2], VE: [6.4, -66.6], MX: [23.6, -102.6], CA: [56.1, -106.3], GB: [54.4, -2.9],
  IE: [53.2, -8.2], FR: [46.6, 2.2], DE: [51.2, 10.4], ES: [40.4, -3.7], IT: [42.8, 12.8],
  NL: [52.2, 5.3], BE: [50.6, 4.7], CH: [46.8, 8.2], AT: [47.6, 14.1], PL: [51.9, 19.1],
  SE: [62.2, 17.6], NO: [64.6, 12.7], DK: [56.0, 9.5], FI: [64.9, 26.3], GR: [39.1, 21.8],
  TR: [39.0, 35.2], RU: [61.5, 105.3], UA: [48.4, 31.2], RO: [45.9, 24.9], CZ: [49.8, 15.5],
  CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8], IN: [20.6, 79.0], SG: [1.35, 103.82],
  HK: [22.3, 114.2], TW: [23.7, 121.0], TH: [15.9, 100.9], VN: [14.1, 108.3], ID: [-2.5, 118.0],
  MY: [4.2, 101.9], PH: [12.9, 121.8], AU: [-25.3, 133.8], NZ: [-40.9, 174.9], ZA: [-30.6, 22.9],
  AO: [-11.2, 17.9], MZ: [-18.7, 35.5], CV: [16.0, -24.0], NG: [9.1, 8.7], EG: [26.8, 30.8],
  MA: [31.8, -7.1], KE: [-0.02, 37.9], GH: [7.9, -1.0], IL: [31.0, 34.9], AE: [23.4, 53.8],
  SA: [23.9, 45.1],
};

function norm(city) {
  return String(city || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/* Devolve { lat, lon } ou null quando não há como posicionar. */
export function resolveGeo(city, country, lat, lon) {
  if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)) return { lat, lon };
  const hit = CITIES[norm(city) + '|' + (country || '')];
  if (hit) return { lat: hit[0], lon: hit[1] };
  const c = COUNTRIES[country || ''];
  if (c) return { lat: c[0], lon: c[1] };
  return null;
}
