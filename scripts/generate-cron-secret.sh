#!/bin/bash

# CRON_SECRETを生成するスクリプト
# 使用方法: ./scripts/generate-cron-secret.sh

set -e

echo "=========================================="
echo "CRON_SECRET 生成"
echo "=========================================="
echo ""

# OpenSSLが利用可能か確認
if command -v openssl &> /dev/null; then
  echo "OpenSSLを使用してCRON_SECRETを生成します..."
  SECRET=$(openssl rand -hex 32)
  echo ""
  echo "✅ 生成されたCRON_SECRET:"
  echo "$SECRET"
elif command -v node &> /dev/null; then
  echo "Node.jsを使用してCRON_SECRETを生成します..."
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo ""
  echo "✅ 生成されたCRON_SECRET:"
  echo "$SECRET"
else
  echo "❌ エラー: OpenSSLまたはNode.jsが見つかりません"
  echo ""
  echo "以下のいずれかの方法でCRON_SECRETを生成してください:"
  echo ""
  echo "方法1: OpenSSL"
  echo "  openssl rand -hex 32"
  echo ""
  echo "方法2: Node.js"
  echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  echo ""
  echo "方法3: オンラインツール"
  echo "  https://www.random.org/strings/"
  exit 1
fi

echo ""
echo "=========================================="
echo "次のステップ"
echo "=========================================="
echo ""
echo "1. このCRON_SECRETをコピーしてください"
echo "2. Render.comで環境変数として設定:"
echo "   Key: CRON_SECRET"
echo "   Value: $SECRET"
echo "3. cron-job.orgのRequest Headersに設定:"
echo "   Authorization: Bearer $SECRET"
echo ""
echo "詳細な手順は CRON_SETUP_GUIDE.md を参照してください。"
echo ""

