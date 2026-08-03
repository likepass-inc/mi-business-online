/**
 * 包括レポート各セクションの「考察」を自動生成するヘルパー群。
 *
 * 設計方針:
 * - 完全自動生成（数値のみから結論を導く、固有名詞のハードコードは最小限）
 * - 各関数は **複数行の Markdown ブロック**（`> 考察` ブロックや箇条書き）を返す
 * - 解釈の余地が大きい場合は「〜の可能性」「要確認」と書き、断定を避ける
 */
import type {
  ComprehensiveReportResponse,
  NumericDelta,
} from '@/lib/buildComprehensiveReport'
import type {
  DeclinedRow,
  GrowthRow,
  GscPageRow,
  GscQueryRow,
} from '@/lib/gscDimensionYoY'
import type { PortfolioSeasonSummary } from '@/lib/querySeason'

function fmtPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !isFinite(p)) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function wrap(lines: string[]): string {
  return lines
    .filter((l) => l && l.trim().length > 0)
    .map((l) => `> ${l}`)
    .join('\n')
}

function section(title: string, lines: string[]): string {
  const body = wrap(lines)
  if (!body) return ''
  return `\n**考察（${title}）**\n\n${body}\n\n`
}

/** クラスタ語と、それを含むキーワード/URL のヒット件数を返す */
function clusterHits(
  keys: string[],
  clusters: Array<{ label: string; patterns: RegExp[] }>
): Array<{ label: string; count: number }> {
  return clusters
    .map((c) => ({
      label: c.label,
      count: keys.filter((k) => c.patterns.some((p) => p.test(k))).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

const QUERY_CLUSTERS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: '退職・お菓子', patterns: [/退職/, /菓子折り/, /お世話になりました/] },
  { label: 'お詫び・謝罪', patterns: [/お詫び/, /謝罪/, /菓子折り/] },
  { label: 'コーヒー・紅茶ギフト', patterns: [/コーヒー/, /紅茶/, /ドリップ/] },
  { label: '香典返し・法事返礼', patterns: [/香典/, /法事/, /法要/, /忌明け/] },
  { label: '就任・昇進・社長', patterns: [/就任/, /昇進/, /昇格/, /社長/, /役員/, /叙勲/] },
  { label: '開院・開業・開店', patterns: [/開院/, /開業/, /開店/] },
  { label: '差し入れ・手土産', patterns: [/差し入れ/, /手土産/] },
  { label: 'お歳暮・お中元・取引先', patterns: [/お歳暮/, /お中元/, /取引先/, /年末.*挨拶/] },
  { label: '移転・事務所', patterns: [/移転/, /事務所/, /新社屋/] },
  { label: 'カタログギフト', patterns: [/カタログギフト/, /カタログ\s*ギフト/] },
  { label: 'ブランド', patterns: [/三越伊勢丹|三越|伊勢丹/] },
]

const URL_CLUSTERS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'マガジン記事', patterns: [/\/magazine\/article\//] },
  { label: 'ショップ商品ページ', patterns: [/\/shop\/g\//] },
  { label: 'ショップ用途・カテゴリ', patterns: [/\/shop\/(i|o|c)\//] },
  { label: 'ショップ記事ページ', patterns: [/\/shop\/pages\//] },
  { label: 'トップ', patterns: [/^https?:\/\/[^/]+\/?$/] },
]

function topClusterLabel(
  rows: Array<{ key: string }>,
  clusters: Array<{ label: string; patterns: RegExp[] }>,
  topN = 3
): string[] {
  const hits = clusterHits(
    rows.map((r) => r.key),
    clusters
  )
  return hits.slice(0, topN).map((h) => `${h.label}（${h.count}件）`)
}

// ---------- Section insights ----------

export function insightSiteGscSummary(y: ComprehensiveReportResponse['siteWide']['yearOverYear']['gsc']): string {
  const lines: string[] = []
  const clicksPct = y.totalClicks.percentChange
  const imprPct = y.totalImpressions.percentChange
  const ctrPct = y.averageCtr.percentChange
  const posDelta = y.averagePosition.absoluteChange
  if (clicksPct !== null) {
    const tag = clicksPct >= 0 ? '増加' : '減少'
    lines.push(
      `クリック ${fmtPct(clicksPct)}（${tag}）、インプレッション ${fmtPct(imprPct)}、平均CTR ${fmtPct(ctrPct)}、平均掲載順位 ${posDelta >= 0 ? '+' : ''}${posDelta.toFixed(2)}（数値が小さいほど好転）。`
    )
  }
  if (clicksPct !== null && imprPct !== null) {
    if (clicksPct < 0 && imprPct >= 0) {
      lines.push(
        `露出（インプレッション）は維持〜増加だがクリックが減少。SERP の質変化（AI Overview の挿入、リッチリザルト変化）や CTR 低下要因の点検が必要。`
      )
    } else if (clicksPct < 0 && imprPct < 0 && posDelta < 0) {
      lines.push(
        `クリック・露出ともに減少だが順位は改善。「上位化したが当該クエリの市場規模が縮小」「上位帯での CTR 低下」の二仮説を検証する。`
      )
    } else if (clicksPct >= 0 && posDelta < 0) {
      lines.push(`順位改善が流入増に直結している兆候。継続して順位押し上げが効くテーマを優先する。`)
    }
  }
  if (ctrPct !== null && ctrPct < -5) {
    lines.push(`平均CTRが ${fmtPct(ctrPct)} と大きく低下。タイトル・ディスクリプション、構造化データの再点検候補。`)
  }
  return section('サイト全体 GSC サマリ', lines)
}

export function insightQueryPortfolio(
  port: PortfolioSeasonSummary,
  scope: 'site' | 'magazine'
): string {
  const totalClicks = port.seasonalClicks + port.evergreenClicks
  if (totalClicks === 0) return ''
  const evergreenShare = (port.evergreenClicks / totalClicks) * 100
  const seasonalShare = 100 - evergreenShare
  const label = scope === 'site' ? 'サイト全体' : 'マガジン'
  const lines: string[] = []
  if (evergreenShare >= 90) {
    lines.push(
      `${label}のクリックは **通年クエリが ${evergreenShare.toFixed(1)}%** を占めており、年間を通じた継続施策の効果が出やすい構造。`
    )
  } else if (evergreenShare >= 70) {
    lines.push(
      `${label}は通年 ${evergreenShare.toFixed(1)}% / 季節 ${seasonalShare.toFixed(1)}%。季節クエリにも一定の寄与があり、季節前の更新サイクルを確保したい。`
    )
  } else {
    lines.push(
      `${label}は **季節クエリの比率が ${seasonalShare.toFixed(1)}% と高め**。Q3・Q4 の季節需要前倒しでの集中投下が利く構造。`
    )
  }
  lines.push(
    `※ 「お歳暮」「お中元」等のルール語のみで判定（\`src/lib/querySeason.ts\`）。実際の意図（贈答シーンの季節性）と差がある場合は、ルール拡張を検討。`
  )
  return section(`${label} クエリポートフォリオ`, lines)
}

export function insightTopQueries(
  topQ: Array<{
    query: string
    currentClicks: number
    yearAgoClicks: number
    delta: number
  }>,
  scope: 'site' | 'magazine'
): string {
  if (topQ.length === 0) return ''
  const lines: string[] = []
  const up = topQ.filter((r) => r.delta > 0).length
  const down = topQ.filter((r) => r.delta < 0).length
  const topGain = [...topQ].sort((a, b) => b.delta - a.delta)[0]
  const topLoss = [...topQ].sort((a, b) => a.delta - b.delta)[0]
  const clusters = topClusterLabel(
    topQ.map((r) => ({ key: r.query })),
    QUERY_CLUSTERS
  )
  lines.push(
    `上位 ${topQ.length} 件のうち、前年同期比で **増加 ${up} 件 / 減少 ${down} 件**。`
  )
  if (clusters.length) {
    lines.push(`主要クラスタは ${clusters.join(' / ')}。`)
  }
  if (topGain && topGain.delta > 0) {
    lines.push(
      `最大の伸びは \`${topGain.query}\`（${topGain.yearAgoClicks} → ${topGain.currentClicks}、+${topGain.delta}）。`
    )
  }
  if (topLoss && topLoss.delta < 0) {
    lines.push(
      `最大の落ち込みは \`${topLoss.query}\`（${topLoss.yearAgoClicks} → ${topLoss.currentClicks}、${topLoss.delta}）。`
    )
  }
  return section(
    `${scope === 'magazine' ? 'マガジン ' : ''}上位クエリ × 前年`,
    lines
  )
}

export function insightGrowingQueries(rows: GrowthRow[], scope: 'site' | 'magazine'): string {
  if (rows.length === 0) return ''
  const lines: string[] = []
  const clusters = topClusterLabel(rows, QUERY_CLUSTERS)
  const newDiscovery = rows.filter((r) => r.yearAgoClicks === 0).length
  const repeat = rows.length - newDiscovery
  lines.push(
    `伸長 ${rows.length} 件のうち、**前年同期にクリック 0 から新規露出が ${newDiscovery} 件**、既存からの上積みが ${repeat} 件。`
  )
  if (clusters.length) {
    lines.push(`クラスタ別では ${clusters.join(' / ')} に伸びが集中。`)
  }
  const top = rows.slice(0, 3)
  if (top.length) {
    lines.push(
      `上位3件: ${top.map((r) => `\`${r.key}\`(+${r.clickGain})`).join('、')}。`
    )
  }
  return section(`${scope === 'magazine' ? 'マガジン ' : ''}伸長クエリ`, lines)
}

export function insightDeclinedQueries(rows: DeclinedRow[], scope: 'site' | 'magazine'): string {
  if (rows.length === 0) return ''
  const lines: string[] = []
  const clusters = topClusterLabel(rows, QUERY_CLUSTERS)
  const heavy = rows.filter((r) => r.clickDrop >= 100).length
  lines.push(
    `下落 ${rows.length} 件のうち、**前年比 100 クリック以上の減少が ${heavy} 件**。`
  )
  if (clusters.length) {
    lines.push(
      `クラスタ別では ${clusters.join(' / ')} で複数クエリが同時に減少 → 個別ページ単位より **クラスタ単位（SERP 変化・競合参入・意図の変化）** で検証が効率的。`
    )
  }
  const top = rows.slice(0, 3)
  if (top.length) {
    lines.push(
      `減少幅トップ3: ${top.map((r) => `\`${r.key}\`(-${r.clickDrop})`).join('、')}。`
    )
  }
  return section(`${scope === 'magazine' ? 'マガジン ' : ''}下落クエリ`, lines)
}

export function insightTopPages(
  topP: Array<{
    page: string
    currentClicks: number
    yearAgoClicks: number
    delta: number
  }>,
  scope: 'site' | 'magazine'
): string {
  if (topP.length === 0) return ''
  const lines: string[] = []
  const clusters = topClusterLabel(
    topP.map((r) => ({ key: r.page })),
    URL_CLUSTERS
  )
  const totalCur = topP.reduce((s, r) => s + r.currentClicks, 0)
  const totalPrev = topP.reduce((s, r) => s + r.yearAgoClicks, 0)
  const pct = totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null
  lines.push(
    `上位 ${topP.length} URL の合計クリックは現在 ${totalCur.toLocaleString()}、前年 ${totalPrev.toLocaleString()}（${fmtPct(pct)}）。`
  )
  if (clusters.length) {
    lines.push(`内訳は ${clusters.join(' / ')}。`)
  }
  const down = topP.filter((r) => r.delta < 0)
  if (down.length >= topP.length * 0.6) {
    lines.push(
      `上位URLの ${down.length}/${topP.length} が前年比マイナス。**主力ページ群が同時に弱含み**であり、テンプレ・内部リンク・SERP 監査の優先度が高い。`
    )
  }
  return section(`${scope === 'magazine' ? 'マガジン ' : ''}上位ページ × 前年`, lines)
}

export function insightGrowingPages(rows: GrowthRow[], scope: 'site' | 'magazine'): string {
  if (rows.length === 0) return ''
  const lines: string[] = []
  const clusters = topClusterLabel(rows, URL_CLUSTERS)
  const newDiscovery = rows.filter((r) => r.yearAgoClicks === 0).length
  lines.push(
    `伸長 ${rows.length} URL のうち、**前年同期 0 クリックから新規露出が ${newDiscovery} URL**。新規記事・新URLのインデックス進行が一定数寄与。`
  )
  if (clusters.length) {
    lines.push(`内訳は ${clusters.join(' / ')}。`)
  }
  const top = rows.slice(0, 3)
  if (top.length) {
    lines.push(
      `上位3件: ${top.map((r) => `\`${r.key.replace(/^https?:\/\/[^/]+/, '')}\`(+${r.clickGain})`).join('、')}。**成功要因（タイトル・見出し・内部リンク・被リンク）を抽出し横展開**するテンプレ化候補。`
    )
  }
  return section(`${scope === 'magazine' ? 'マガジン ' : ''}伸長ページ`, lines)
}

export function insightDeclinedPages(rows: DeclinedRow[], scope: 'site' | 'magazine'): string {
  if (rows.length === 0) return ''
  const lines: string[] = []
  const clusters = topClusterLabel(rows, URL_CLUSTERS)
  const heavy = rows.filter((r) => r.clickDrop >= 200).length
  lines.push(
    `下落 ${rows.length} URL のうち、**前年比 200 クリック以上の減少が ${heavy} URL**。`
  )
  if (clusters.length) {
    lines.push(`内訳は ${clusters.join(' / ')}。`)
  }
  const top = rows.slice(0, 3)
  if (top.length) {
    lines.push(
      `減少幅トップ3: ${top.map((r) => `\`${r.key.replace(/^https?:\/\/[^/]+/, '')}\`(-${r.clickDrop})`).join('、')}。最初に **SERP 監査と意図のズレ確認**を行い、改修 or 統合 or 縮小を判断する。`
    )
  }
  return section(`${scope === 'magazine' ? 'マガジン ' : ''}下落ページ`, lines)
}

export function insightGa4Summary(y: ComprehensiveReportResponse['siteWide']['yearOverYear']['ga4']): string {
  const lines: string[] = []
  const sess = y.sessions.percentChange
  const tx = y.transactions.percentChange
  const rev = y.revenue.percentChange
  const cvr = y.conversionRate
  lines.push(
    `セッション ${fmtPct(sess)}、購入完了 ${fmtPct(tx)}、売上 ${fmtPct(rev)}、CVR ${cvr.current.toFixed(2)}%（前年 ${cvr.previous.toFixed(2)}%）。`
  )
  if (sess !== null && tx !== null && sess < 0 && tx > 0) {
    lines.push(
      `**流入は減ったが購入は増加** → サイト/商品/カート導線の **質の改善** が効いている可能性。逆に「流入の母集団が法人/購入意図の高い層に絞られた」可能性も併せて検証する。`
    )
  }
  if (rev !== null && tx !== null && rev > 0 && tx > 0 && rev > tx + 5) {
    lines.push(
      `売上の伸びが購入件数の伸びを上回る → **客単価（AOV）が上昇**。法人購買・高単価カタログの寄与を確認する。`
    )
  }
  if (sess !== null && rev !== null && sess < 0 && rev > 0) {
    lines.push(
      `セッション減 × 売上増 は短期では「効率改善」だが、**中期的にはトップ・オブ・ファネルの再投資が必要**。`
    )
  }
  return section('サイト全体 GA4 サマリ', lines)
}

export function insightChannels(
  cur: ComprehensiveReportResponse['siteWide']['current']['ga4']['byChannel'],
  prev: ComprehensiveReportResponse['siteWide']['yearAgo']['ga4']['byChannel']
): string {
  if (!cur.length) return ''
  const lines: string[] = []
  const totalRev = cur.reduce((s, r) => s + r.revenue, 0)
  if (totalRev > 0) {
    const sorted = [...cur].sort((a, b) => b.revenue - a.revenue)
    const top = sorted.slice(0, 3).map((c) => `${c.channel}（¥${Math.round(c.revenue).toLocaleString()}、${((c.revenue / totalRev) * 100).toFixed(0)}%）`)
    lines.push(`売上構成上位3チャネルは ${top.join(' / ')}。`)
  }
  const os = cur.find((c) => c.channel === 'Organic Search')
  const osPrev = prev.find((c) => c.channel === 'Organic Search')
  if (os && osPrev) {
    const osSessPct = osPrev.sessions > 0 ? ((os.sessions - osPrev.sessions) / osPrev.sessions) * 100 : null
    const osTxPct = osPrev.transactions > 0 ? ((os.transactions - osPrev.transactions) / osPrev.transactions) * 100 : null
    lines.push(
      `Organic Search: セッション ${fmtPct(osSessPct)}・購入完了 ${fmtPct(osTxPct)}。集客減でも購入は維持/改善できているかを毎月チェック。`
    )
  }
  const direct = cur.find((c) => c.channel === 'Direct')
  const email = cur.find((c) => c.channel === 'Email')
  if (direct && totalRev > 0 && direct.revenue / totalRev > 0.3) {
    lines.push(
      `**Direct が売上構成の主軸**（${((direct.revenue / totalRev) * 100).toFixed(0)}%）。法人リピート・指名流入の比率が高い可能性。直接訪問の質の維持と、Organic からの新規認知補強が両輪。`
    )
  }
  if (email && email.transactions > 0) {
    lines.push(
      `Email の購入 ${email.transactions.toLocaleString()} 件・売上 ¥${Math.round(email.revenue).toLocaleString()}。**少セッションで高効率**のチャネル。配信頻度・セグメントの強化余地あり。`
    )
  }
  return section('チャネル別', lines)
}

export function insightDevices(
  cur: ComprehensiveReportResponse['siteWide']['current']['ga4']['byDevice'],
  prev: ComprehensiveReportResponse['siteWide']['yearAgo']['ga4']['byDevice']
): string {
  if (!cur.length) return ''
  const lines: string[] = []
  const totalRev = cur.reduce((s, r) => s + r.revenue, 0)
  const desktop = cur.find((d) => d.device === 'desktop')
  const mobile = cur.find((d) => d.device === 'mobile')
  if (desktop && totalRev > 0) {
    lines.push(
      `**desktop が売上の ${((desktop.revenue / totalRev) * 100).toFixed(0)}%**（¥${Math.round(desktop.revenue).toLocaleString()}）。法人サイトの典型的なオフィス購買パターンを反映。`
    )
  }
  if (mobile && desktop && mobile.sessions > desktop.sessions) {
    const mobileCvr = mobile.sessions > 0 ? (mobile.transactions / mobile.sessions) * 100 : 0
    const desktopCvr = desktop.sessions > 0 ? (desktop.transactions / desktop.sessions) * 100 : 0
    lines.push(
      `mobile はセッションで desktop の ${(mobile.sessions / desktop.sessions).toFixed(1)}倍だが、CVR は mobile ${mobileCvr.toFixed(2)}% vs desktop ${desktopCvr.toFixed(2)}%。**mobile は認知・比較フェーズが中心**で、desktop が決済の主戦場。mobile→PC 跨ぎの計測と、mobile からの「あとで PC で買う」導線の強化を検討。`
    )
  }
  const desktopPrev = prev.find((d) => d.device === 'desktop')
  if (desktop && desktopPrev) {
    const txPct =
      desktopPrev.transactions > 0
        ? ((desktop.transactions - desktopPrev.transactions) / desktopPrev.transactions) * 100
        : null
    if (txPct !== null) {
      lines.push(`desktop 購入完了 ${fmtPct(txPct)}（${desktopPrev.transactions} → ${desktop.transactions}）。`)
    }
  }
  return section('デバイス別', lines)
}

export function insightMagazineGsc(
  my: ComprehensiveReportResponse['magazine']['yearOverYear']['gsc'],
  siteY: ComprehensiveReportResponse['siteWide']['yearOverYear']['gsc']
): string {
  const lines: string[] = []
  lines.push(
    `マガジン: クリック ${fmtPct(my.totalClicks.percentChange)}、インプレッション ${fmtPct(my.totalImpressions.percentChange)}、平均CTR ${fmtPct(my.averageCtr.percentChange)}、平均掲載順位 ${my.averagePosition.absoluteChange >= 0 ? '+' : ''}${my.averagePosition.absoluteChange.toFixed(2)}。`
  )
  if (my.totalImpressions.percentChange !== null && siteY.totalImpressions.percentChange !== null) {
    if (my.totalImpressions.percentChange > siteY.totalImpressions.percentChange) {
      lines.push(
        `**マガジンの露出はサイト全体より相対的に堅調**。記事資産の SEO 価値は維持されており、CTR・順位の精緻化で流入回復の余地がある。`
      )
    } else {
      lines.push(
        `マガジンの露出はサイト全体平均より弱含み。記事のリフレッシュ・内部リンク・SERP 新フォーマット対応の優先度が上がる。`
      )
    }
  }
  return section('マガジン GSC', lines)
}

export function insightMagazineGa4(
  my: ComprehensiveReportResponse['magazine']['yearOverYear']['ga4']
): string {
  const lines: string[] = []
  lines.push(
    `マガジン GA4: セッション ${fmtPct(my.sessions.percentChange)}、ユーザー ${fmtPct(my.users.percentChange)}、ページビュー ${fmtPct(my.pageViews.percentChange)}。`
  )
  lines.push(
    `マガジン配下の **購入帰属** は標準 Data API では精緻に取れない。GA4 探索の「セグメント重複」や、マガジン LP → 商品 PV → 購入完了 の遷移をユーザープロパティ/イベントで定点化することを推奨（\`docs/GA4_CORPORATE_INTENT_PROXY.md\`）。`
  )
  return section('マガジン GA4', lines)
}
