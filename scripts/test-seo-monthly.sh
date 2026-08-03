#!/bin/bash

# Monthly KPI Bot API のテストスクリプト
# 使用方法:
#   ./scripts/test-seo-monthly.sh [CRON_SECRET] [--dry-run]
#   export CRON_SECRET=your-secret-token
#   ./scripts/test-seo-monthly.sh --dry-run

set -e

API_URL="https://mi-business-online.onrender.com/api/cron/seo-monthly"
TOKEN=""
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      if [ -z "$TOKEN" ]; then
        TOKEN="$arg"
      fi
      ;;
  esac
done

CRON_SECRET="${TOKEN:-${CRON_SECRET}}"

if [ -z "$CRON_SECRET" ]; then
  echo "エラー: CRON_SECRETが設定されていません"
  echo ""
  echo "使用方法:"
  echo "  ./scripts/test-seo-monthly.sh your-secret-token"
  echo "  ./scripts/test-seo-monthly.sh your-secret-token --dry-run"
  echo "  または"
  echo "  export CRON_SECRET=your-secret-token"
  echo "  ./scripts/test-seo-monthly.sh --dry-run"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  API_URL="${API_URL}?dryRun=1"
fi

echo "=========================================="
echo "Monthly KPI Bot API テスト"
echo "=========================================="
echo "API URL: $API_URL"
echo "CRON_SECRET: ${CRON_SECRET:0:10}...（最初の10文字のみ表示）"
echo "Dry run: $DRY_RUN"
echo ""

echo "1. Monthly KPI Bot APIを呼び出し中..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$API_URL" \
  -H "Authorization: Bearer $CRON_SECRET")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  SUCCESS=$(echo "$BODY" | jq -r '.success // false' 2>/dev/null || echo "false")
  if [ "$SUCCESS" = "true" ]; then
    echo "✅ 成功: Monthly KPI Bot APIが正常に呼び出されました"
  else
    echo "❌ 失敗: success が true ではありません"
    exit 1
  fi
else
  echo "❌ 失敗: HTTP Status $HTTP_STATUS"
  echo ""
  echo "考えられる原因:"
  echo "  - CRON_SECRETが正しく設定されていない"
  echo "  - Render.comでCRON_SECRET環境変数が設定されていない"
  echo "  - ヘッダーの形式が間違っている（Authorization: Bearer {token}）"
  exit 1
fi

echo ""
echo "=========================================="
echo "テスト完了"
echo "=========================================="
