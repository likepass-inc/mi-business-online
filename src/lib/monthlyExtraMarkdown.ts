import type {
  MonthlyFunnelSnapshot,
  SiteSearchEffectSnapshot,
} from '@/lib/monthlyChartsTypes'

function pct(n: number): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`
}

function deltaLine(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '—'
  const abs = current - previous
  const pctChange = previous === 0 ? null : (abs / previous) * 100
  const absStr = `${abs >= 0 ? '+' : ''}${abs.toLocaleString()}`
  const pctStr = pctChange === null ? '—' : `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`
  return `${absStr} / ${pctStr}`
}

export function renderFunnelMarkdown(options: {
  monthLabel: string
  yoyLabel: string
  current: MonthlyFunnelSnapshot
  yearAgo: MonthlyFunnelSnapshot
}): string {
  const { monthLabel, yoyLabel, current, yearAgo } = options
  let md = `## 集客→購入ファネル\n\n`
  md += `${monthLabel} と ${yoyLabel} の GA4 指標です。各ステップは独立集計のため、厳密な同一ユーザー経路ではありません。\n\n`
  md += `| ステップ | ${monthLabel} | ${yoyLabel} | 変化 |\n`
  md += `|----------|------|------|------|\n`
  for (let i = 0; i < current.steps.length; i++) {
    const cur = current.steps[i]
    const prev = yearAgo.steps[i]
    md += `| ${cur.label} | ${cur.value.toLocaleString()} | ${(prev?.value ?? 0).toLocaleString()} | ${deltaLine(cur.value, prev?.value ?? 0)} |\n`
  }
  md += `\n**全体CVR（サイトセッション→購入）**: ${pct(current.overallConversionRate)}（前年 ${pct(yearAgo.overallConversionRate)}）\n\n`
  md += `### ステップ継続率（${monthLabel}）\n\n`
  md += `| ステップ | 継続率 | 離脱率 |\n`
  md += `|----------|--------|--------|\n`
  for (const step of current.steps) {
    md += `| ${step.label} | ${pct(step.continueRate)} | ${pct(step.dropoffRate)} |\n`
  }
  md += `\n`
  return md
}

function ga4EventCount(
  snap: SiteSearchEffectSnapshot,
  key: 'open' | 'submit' | 'resultClick' | 'productClick'
): number {
  const ev = snap.ga4?.events?.[key]
  if (!ev || typeof ev !== 'object') return 0
  return Number(ev.eventCount) || 0
}

export function renderAiSearchMarkdown(options: {
  monthLabel: string
  yoyLabel: string
  current: SiteSearchEffectSnapshot
  yearAgo: SiteSearchEffectSnapshot
}): string {
  const { monthLabel, yoyLabel, current, yearAgo } = options
  let md = `## AIサイト内検索\n\n`
  md += `サイト埋め込みの AI サイト内検索の効果です（[管理コンソール効果分析](https://ai-chatbot-mi-business.onrender.com/site-search-admin/index.html) と同系統）。\n\n`
  md += `**対象期間**: ${current.startYmd} 〜 ${current.endYmd}（前年: ${yearAgo.startYmd} 〜 ${yearAgo.endYmd}）\n\n`

  md += `### 検索 KPI（前年同月比）\n\n`
  md += `| 指標 | ${monthLabel} | ${yoyLabel} | 変化 |\n`
  md += `|------|------|------|------|\n`
  md += `| 総検索数 | ${current.totalSearches.toLocaleString()} | ${yearAgo.totalSearches.toLocaleString()} | ${deltaLine(current.totalSearches, yearAgo.totalSearches)} |\n`
  md += `| ユニーククエリ | ${current.uniqueQueries.toLocaleString()} | ${yearAgo.uniqueQueries.toLocaleString()} | ${deltaLine(current.uniqueQueries, yearAgo.uniqueQueries)} |\n`
  md += `| 平均 knowledge 件数 | ${current.avgKnowledge.toFixed(2)} | ${yearAgo.avgKnowledge.toFixed(2)} | ${deltaLine(current.avgKnowledge, yearAgo.avgKnowledge)} |\n`
  md += `| 平均 product 件数 | ${current.avgProducts.toFixed(2)} | ${yearAgo.avgProducts.toFixed(2)} | ${deltaLine(current.avgProducts, yearAgo.avgProducts)} |\n\n`

  md += `### GA4 イベント\n\n`
  md += `| イベント | ${monthLabel} | ${yoyLabel} | 変化 |\n`
  md += `|----------|------|------|------|\n`
  for (const [key, label] of [
    ['open', 'パネルを開く'],
    ['submit', '検索実行'],
    ['resultClick', '結果クリック'],
    ['productClick', '商品クリック'],
  ] as const) {
    const c = ga4EventCount(current, key)
    const p = ga4EventCount(yearAgo, key)
    md += `| ${label} | ${c.toLocaleString()} | ${p.toLocaleString()} | ${deltaLine(c, p)} |\n`
  }
  md += `\n`

  const contrib = current.ga4?.contribution
  if (contrib?.contributionAvailable) {
    md += `### 購入貢献（Audience・${contrib.attributionWindowDays ?? 30}日）\n\n`
    md += `| 指標 | 値 |\n`
    md += `|------|----|\n`
    if (contrib.cvSharePercent != null) {
      md += `| 検索利用者の購入シェア | ${Number(contrib.cvSharePercent).toFixed(1)}% |\n`
    }
    if (contrib.searchUserPurchaseRate != null) {
      md += `| 検索利用者の購入率 | ${(Number(contrib.searchUserPurchaseRate) * 100).toFixed(2)}% |\n`
    }
    if (contrib.totalUserPurchaseRate != null) {
      md += `| 全体の購入率 | ${(Number(contrib.totalUserPurchaseRate) * 100).toFixed(2)}% |\n`
    }
    const rev = contrib.searchUsers?.purchaseRevenue
    if (rev != null) {
      md += `| 検索利用者の売上 | ¥${Math.round(Number(rev)).toLocaleString()} |\n`
    }
    const purchases = contrib.searchUsers?.ecommercePurchases
    if (purchases != null) {
      md += `| 検索利用者の購入件数 | ${Number(purchases).toLocaleString()} |\n`
    }
    md += `\n`
  } else {
    md += `### 購入貢献\n\n購入貢献 Audience が未設定、または期間内で利用できませんでした。\n\n`
  }

  md += `### Top クエリ（${monthLabel}）\n\n`
  if (current.topQueries.length === 0) {
    md += `該当なし\n\n`
  } else {
    md += `| 順位 | クエリ | 件数 |\n`
    md += `|------|--------|------|\n`
    current.topQueries.slice(0, 10).forEach((row, i) => {
      md += `| ${i + 1} | ${String(row.query_text).replace(/\|/g, '\\|')} | ${Number(row.cnt).toLocaleString()} |\n`
    })
    md += `\n`
  }

  md += `### 0件ヒット Top（${monthLabel}）\n\n`
  if (current.zeroHitQueries.length === 0) {
    md += `該当なし\n\n`
  } else {
    md += `| 順位 | クエリ | 件数 |\n`
    md += `|------|--------|------|\n`
    current.zeroHitQueries.slice(0, 10).forEach((row, i) => {
      md += `| ${i + 1} | ${String(row.query_text).replace(/\|/g, '\\|')} | ${Number(row.cnt).toLocaleString()} |\n`
    })
    md += `\n`
  }

  return md
}
