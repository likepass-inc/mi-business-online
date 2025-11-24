#!/bin/bash

# 三越伊勢丹法人オンラインサイト レポート生成スクリプト
# 期間: 2024-11-01 〜 2024-11-15

BASE_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
START_DATE="2024-11-01"
END_DATE="2024-11-15"
COOKIE_FILE="/tmp/mi-report-cookies.txt"

echo "📊 三越伊勢丹法人オンラインサイト レポート生成"
echo "期間: $START_DATE 〜 $END_DATE"
echo ""

# ログイン
echo "ログイン中..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"id":"tk","password":"nakamura"}' \
  -c "$COOKIE_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ ログインに失敗しました (HTTP $HTTP_CODE)"
  exit 1
fi

echo "✅ ログイン成功"
echo ""

# レポート取得
echo "レポートを取得中..."
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/report" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\"}" \
  -b "$COOKIE_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$REPORT_RESPONSE" | tail -n1)
REPORT_BODY=$(echo "$REPORT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ レポート取得に失敗しました (HTTP $HTTP_CODE)"
  echo "$REPORT_BODY" | python3 -m json.tool 2>/dev/null || echo "$REPORT_BODY"
  exit 1
fi

# JSONファイルに保存
OUTPUT_FILE="report-${START_DATE}-${END_DATE}.json"
echo "$REPORT_BODY" | python3 -m json.tool > "$OUTPUT_FILE"
echo "✅ レポートを $OUTPUT_FILE に保存しました"
echo ""

# サマリーを表示
echo "=== レポートサマリー ==="
echo ""
echo "$REPORT_BODY" | python3 << 'PYTHON_SCRIPT'
import json
import sys

data = json.load(sys.stdin)

print("📈 Google Search Console (GSC)")
print(f"  総クリック数: {data['gsc']['summary']['totalClicks']:,}")
print(f"  総インプレッション数: {data['gsc']['summary']['totalImpressions']:,}")
print(f"  平均CTR: {data['gsc']['summary']['averageCtr']}%")
print(f"  平均ポジション: {data['gsc']['summary']['averagePosition']}")
print("")

print("📊 Google Analytics 4 (GA4)")
print(f"  セッション数: {data['ga4']['summary']['sessions']:,}")
print(f"  ユーザー数: {data['ga4']['summary']['users']:,}")
print(f"  ページビュー数: {data['ga4']['summary']['pageViews']:,}")
print(f"  トランザクション数: {data['ga4']['summary']['transactions']:,}")
print(f"  売上: ¥{data['ga4']['summary']['revenue']:,}")
print(f"  コンバージョン率: {data['ga4']['summary']['conversionRate']}%")
print("")

print(f"詳細は {sys.argv[1]} を参照してください。" if len(sys.argv) > 1 else "")
PYTHON_SCRIPT "$OUTPUT_FILE"

# Cookieファイルを削除
rm -f "$COOKIE_FILE"

echo ""
echo "✅ レポート生成完了"






