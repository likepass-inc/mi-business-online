# マガジン・ショップ連携モックアップ

`business.mistore.jp` マガジンの理想構造を示す静的モックアップです。  
マガジン記事とショップへの導線強化を検証するための UI 案です。

## 表示方法

```bash
npm run dev
```

| ページ | URL |
|--------|-----|
| 入口（一覧） | http://localhost:3000/mockup |
| マガジン TOP | http://localhost:3000/mockup/magazine-top |
| 記事ページ | http://localhost:3000/mockup/article |

## 構成

```
src/app/mockup/
├── page.tsx              # 入口（各モックへのリンク）
├── layout.tsx            # 共通レイアウト
├── mockup.css            # モック専用スタイル
├── magazine-top/page.tsx # マガジン TOP（カテゴリ・記事グリッド・ショップ導線）
└── article/
    ├── layout.tsx
    └── page.tsx          # 記事ページ（記事/商品一覧タブ・関連商品・CTA）
```

## 内容のポイント

- **マガジン TOP**: カテゴリナビ、人気キーワード、シーン別解説、人気記事、FAQ、ショップへの CTA
- **記事ページ**: 記事 / 商品一覧のタブ切り替え、おすすめ商品、関連記事、サイドバー導線
