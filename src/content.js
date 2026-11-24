// 全站文字與品牌集中在這裡：拿到正式公司名、聯絡方式後只要改這個檔。
export const brand = {
  zh: 'XX公司', en: '', // 待填正式公司名；en 留空就不顯示英文
  isPlaceholder: true,
  email: '', // 待填
  demoTag: '提案概念 Demo',
};

export const scenes = {
  hero:   { title: '外泌體分離\n純化與鑑定', sub: '人類間質幹細胞來源，直徑約 30–150 nm 之脂雙層胞外囊泡。' },
  inside: { title: '膜蛋白標記與腔內貨物', sub: '四次跨膜蛋白 CD9、CD63、CD81；腔內含 RNA 與 ESCRT 相關蛋白。' },
  origin: { title: '外泌體之生合成', sub: '內體膜向內出芽形成腔內囊泡，多囊泡體與細胞膜融合後釋放。' },
  tff:    { title: '切向流過濾（TFF）', sub: '外泌體截留於循環迴路，小分子溶質與游離蛋白隨濾液移除。' },
  sec:    { title: '尺寸排阻層析（SEC）', sub: '外泌體不進入膠珠孔隙，先於游離蛋白洗脫。' },
  nta:    { title: '奈米粒子追蹤分析（NTA）', sub: '粒徑分布示意，非實測數據' },
  vial:   { title: '規格設定', sub: '' },
};

// 3D 標註：位置由各章節的 labels 提供
export const labelText = {
  cd9:       ['CD9', '四次跨膜蛋白'],
  cd63:      ['CD63', '四次跨膜蛋白'],
  cd81:      ['CD81', '四次跨膜蛋白'],
  bilayer:   ['脂雙層', '約 5 nm 厚'],
  rna:       ['RNA', 'miRNA、mRNA'],
  cargo:     ['蛋白質', 'TSG101、ALIX'],
  nucleus:   ['細胞核', ''],
  endosome:  ['內體', '內體膜向內出芽'],
  mvb:       ['多囊泡體 MVB', '內含腔內囊泡'],
  fusion:    ['與細胞膜融合', ''],
  release:   ['外泌體釋放', ''],
  fiber:     ['中空纖維膜', ''],
  permeate:  ['濾液', '小分子蛋白'],
  retentate: ['截留液', '外泌體'],
  bead:      ['多孔層析珠', ''],
  evpeak:    ['外泌體', '先洗脫'],
  protpeak:  ['游離蛋白', '後洗脫'],
};

// 組規格器選項（示意，實際品項由公司確認）
export const config = {
  source: { label: '細胞來源', options: [
    { id: 'uc', name: '臍帶 MSC', code: 'UC' },
    { id: 'ad', name: '脂肪 MSC', code: 'AD' },
    { id: 'bm', name: '骨髓 MSC', code: 'BM' },
  ] },
  form: { label: '劑型', options: [
    { id: 'liquid', name: '冷凍液態', code: 'LQ' },
    { id: 'lyo', name: '凍乾', code: 'LY' },
  ] },
  use: { label: '合作用途', options: [
    { id: 'research', name: '研究用', code: 'R' },
    { id: 'ingredient', name: '原料開發', code: 'I' },
    { id: 'process', name: '委託製程', code: 'P' },
  ] },
  qc: { label: '隨附檢測', multi: true, options: [
    { id: 'nta', name: 'NTA 粒徑', code: 'NTA' },
    { id: 'tem', name: 'TEM 形貌', code: 'TEM' },
    { id: 'marker', name: '膜蛋白標記', code: 'MRK' },
    { id: 'purity', name: '純度比值', code: 'PUR' },
    { id: 'sterile', name: '無菌與內毒素', code: 'STE' },
  ] },
};

export const notice = '僅為網站概念展示。品項、規格與檢測以公司正式文件為準；未宣稱任何醫療效能。';
