#!/bin/bash

# Cron APIのテストスクリプト
# 使用方法: ./scripts/test-cron.sh [CRON_SECRET]

set -e

API_URL="https://mi-business-online.onrender.com/api/cron/crawl-products"
CRON_SECRET="${1:-${CRON_SECRET}}"

if [ -z "$CRON_SECRET" ]; then
  echo "エラー: CRON_SECRETが設定されていません"
  echo ""
  echo "使用方法:"
  echo "  ./scripts/test-cron.sh your-secret-token"
  echo "  または"
  echo "  export CRON_SECRET=your-secret-token"
  echo "  ./scripts/test-cron.sh"
  exit 1
fi

echo "=========================================="
echo "Cron API テスト"
echo "=========================================="
echo "API URL: $API_URL"
echo "CRON_SECRET: ${CRON_SECRET:0:10}...（最初の10文字のみ表示）"
echo ""

echo "1. Cron APIを呼び出し中..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$API_URL" \
  -H "Authorization: Bearer $CRON_SECRET")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ 成功: Cron APIが正常に呼び出されました"
  
  # ログIDを抽出
  LOG_ID=$(echo "$BODY" | jq -r '.log_id // empty' 2>/dev/null || echo "")
  
  if [ -n "$LOG_ID" ]; then
    echo ""
    echo "2. クロール状況を確認中（5秒待機後）..."
    sleep 5
    
    STATUS_URL="https://mi-business-online.onrender.com/api/crawl/products/status"
    STATUS_RESPONSE=$(curl -s "$STATUS_URL")
    
    echo "Status Response:"
    echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
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

