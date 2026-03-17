# WordPress/STORK19 商品データ取得ガイド

## 📖 はじめに

このガイドでは、WordPress/STORK19テーマで商品データを取得・表示する方法を説明します。

商品データは `https://mi-business-online.onrender.com/api/products` から取得できます。このAPIは、[business.mistore.jp](https://business.mistore.jp/)の商品情報を自動的に収集・更新しているため、常に最新の商品データを取得できます。

### マガジンサイトについて

このAPIは、[三越伊勢丹法人オンラインストアのギフトマガジン](https://business.mistore.jp/magazine/)（`https://business.mistore.jp/magazine/`）の記事コンテンツと連携して、記事に関連する商品を自動表示する機能も提供しています。

---

## 🚀 基本的な使い方

### 1. APIエンドポイント

商品データを取得するAPIのURLは以下の通りです：

```
https://mi-business-online.onrender.com/api/products
```

### 2. 取得できる情報

各商品には以下の情報が含まれています：

- **product_code**: 商品コード
- **product_name**: 商品名
- **price_incl_tax**: 税込価格
- **price_excl_tax**: 税抜価格
- **description**: 商品説明
- **category**: カテゴリ
- **sub_category**: サブカテゴリ
- **product_url**: 商品ページのURL
- **image_url**: メイン画像URL
- **image_urls**: 画像URLの配列（複数画像がある場合）
- **availability**: 在庫状況（詳細は後述）

---

## 📦 在庫状況（availability）について

### 概要

`availability`フィールドは、商品の在庫状況を表す文字列です。このフィールドを使用することで、記事内で商品を紹介する際に、読者に対して在庫状況を明確に伝えることができます。

### 可能な値

`availability`フィールドには以下の値が設定される可能性があります：

| 値 | 意味 | 説明 |
|---|---|---|
| `null` または `undefined` | 在庫あり | 在庫状況の情報がない場合、通常は在庫があることを意味します |
| `"一時欠品中"` | 一時的に在庫切れ | 現在在庫がなく、入荷待ちの状態です |
| `"販売を終了いたしました"` | 終売 | 商品の販売が終了しており、今後入荷予定はありません |
| `"残り0点"` | 在庫0点 | 在庫が0点で、入荷待ちの状態です |

**注意**: これらの値は、実際の商品ページ（`business.mistore.jp`）から自動的に抽出されます。商品ページの表示が変更された場合、APIのレスポンスも自動的に更新されます。

### 使用方法

#### PHPでの実装例

```php
<?php
// 商品データを取得
$products = get_products_from_api(10);

foreach ($products as $product) {
    ?>
    <div class="product-card">
        <h3><?php echo esc_html($product['product_name']); ?></h3>
        <p class="price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
        
        <?php
        // 在庫状況を表示
        if (!empty($product['availability'])) {
            $availability_class = '';
            $availability_icon = '';
            
            // 在庫状況に応じてクラスとアイコンを設定
            if ($product['availability'] === '一時欠品中' || $product['availability'] === '残り0点') {
                $availability_class = 'availability-warning';
                $availability_icon = '⚠️';
            } elseif ($product['availability'] === '販売を終了いたしました') {
                $availability_class = 'availability-discontinued';
                $availability_icon = '🔴';
            }
            
            ?>
            <p class="availability <?php echo esc_attr($availability_class); ?>">
                <?php echo esc_html($availability_icon); ?>
                <?php echo esc_html($product['availability']); ?>
            </p>
            <?php
        }
        ?>
        
        <a href="<?php echo esc_url($product['product_url']); ?>" 
           class="product-link" 
           target="_blank" 
           rel="noopener">商品を見る</a>
    </div>
    <?php
}
?>
```

#### CSSスタイル例

```css
/* 在庫状況のスタイル */
.availability {
    font-size: 0.9em;
    font-weight: bold;
    margin: 0.5em 0;
    padding: 0.3em 0.5em;
    border-radius: 3px;
}

.availability-warning {
    color: #ff6b00;
    background-color: #fff3e0;
}

.availability-discontinued {
    color: #d32f2f;
    background-color: #ffebee;
}
```

#### JavaScriptでの実装例

```javascript
// APIから商品データを取得
fetch('https://mi-business-online.onrender.com/api/products?limit=10')
    .then(response => response.json())
    .then(data => {
        if (data.success && data.data) {
            data.data.forEach(product => {
                // 在庫状況を表示
                if (product.availability) {
                    let statusClass = '';
                    let statusIcon = '';
                    
                    if (product.availability === '一時欠品中' || product.availability === '残り0点') {
                        statusClass = 'availability-warning';
                        statusIcon = '⚠️';
                    } else if (product.availability === '販売を終了いたしました') {
                        statusClass = 'availability-discontinued';
                        statusIcon = '🔴';
                    }
                    
                    const availabilityElement = document.createElement('p');
                    availabilityElement.className = `availability ${statusClass}`;
                    availabilityElement.textContent = `${statusIcon} ${product.availability}`;
                    
                    // 商品カードに追加
                    // （実際のDOM操作は実装に応じて調整）
                }
            });
        }
    });
```

### 実装のベストプラクティス

1. **在庫状況がない場合の処理**
   - `availability`が`null`または`undefined`の場合は、在庫ありとして扱うか、何も表示しない
   - ユーザーに誤解を与えないよう、明確な表示方針を決める

2. **視覚的な区別**
   - 終売商品は赤色で表示し、購入できないことを明確にする
   - 一時欠品や在庫0点は警告色（オレンジなど）で表示し、入荷待ちであることを示す

3. **ユーザー体験の向上**
   - 終売商品の場合は「商品を見る」リンクを無効化するか、別のメッセージを表示
   - 一時欠品の場合は「入荷待ち」であることを明確に伝える

4. **記事編集者への配慮**
   - 記事内で商品を紹介する際、在庫状況を確認してから掲載する
   - 終売商品が含まれる場合は、記事の更新や商品の差し替えを検討

### 使用例：記事内での商品表示

```php
<?php
// 記事内で商品を表示する関数
function display_product_in_article($product_code) {
    $api_url = 'https://mi-business-online.onrender.com/api/products/' . $product_code;
    $response = wp_remote_get($api_url, array(
        'timeout' => 10,
        'headers' => array('Accept' => 'application/json')
    ));
    
    if (is_wp_error($response)) {
        return '<p>商品情報の取得に失敗しました。</p>';
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (!isset($data['success']) || !$data['success'] || !isset($data['data'])) {
        return '<p>商品が見つかりませんでした。</p>';
    }
    
    $product = $data['data'];
    
    ob_start();
    ?>
    <div class="article-product">
        <?php if (!empty($product['image_url'])): ?>
            <img src="<?php echo esc_url($product['image_url']); ?>" 
                 alt="<?php echo esc_attr($product['product_name']); ?>"
                 class="article-product-image">
        <?php endif; ?>
        
        <div class="article-product-info">
            <h3><?php echo esc_html($product['product_name']); ?></h3>
            <p class="article-product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
            
            <?php
            // 在庫状況を表示
            if (!empty($product['availability'])) {
                $is_discontinued = ($product['availability'] === '販売を終了いたしました');
                ?>
                <p class="article-product-availability <?php echo $is_discontinued ? 'discontinued' : 'warning'; ?>">
                    <?php echo esc_html($product['availability']); ?>
                </p>
                <?php
                
                // 終売商品の場合はリンクを無効化
                if ($is_discontinued) {
                    ?>
                    <p class="article-product-note">この商品は販売を終了いたしました。</p>
                    <?php
                } else {
                    ?>
                    <a href="<?php echo esc_url($product['product_url']); ?>" 
                       class="article-product-link" 
                       target="_blank" 
                       rel="noopener">商品ページを見る</a>
                    <?php
                }
            } else {
                // 在庫状況がない場合は通常通りリンクを表示
                ?>
                <a href="<?php echo esc_url($product['product_url']); ?>" 
                   class="article-product-link" 
                   target="_blank" 
                   rel="noopener">商品ページを見る</a>
                <?php
            }
            ?>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// 使用例
echo display_product_in_article('g020W-977');
?>
```

---

## 💻 実装方法

### 方法1: PHPコードで直接取得（推奨）

WordPressのテンプレートファイルやfunctions.phpに以下のコードを追加します：

```php
<?php
// 商品データを取得する関数
function get_products_from_api($limit = 10, $category = '', $search = '') {
    $api_url = 'https://mi-business-online.onrender.com/api/products';
    $params = array(
        'limit' => $limit,
        'offset' => 0
    );
    
    if (!empty($category)) {
        $params['category'] = $category;
    }
    
    if (!empty($search)) {
        $params['q'] = $search;
    }
    
    $api_url .= '?' . http_build_query($params);
    
    $response = wp_remote_get($api_url, array(
        'timeout' => 10,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        return array();
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['success']) && $data['success'] && isset($data['data'])) {
        return $data['data'];
    }
    
    return array();
}

// 使用例：商品一覧を表示
$products = get_products_from_api(10);
foreach ($products as $product) {
    echo '<div class="product-item">';
    echo '<h3>' . esc_html($product['product_name']) . '</h3>';
    if (!empty($product['image_url'])) {
        echo '<img src="' . esc_url($product['image_url']) . '" alt="' . esc_attr($product['product_name']) . '">';
    }
    echo '<p class="price">¥' . number_format($product['price_incl_tax']) . '（税込）</p>';
    echo '<a href="' . esc_url($product['product_url']) . '" target="_blank">商品を見る</a>';
    echo '</div>';
}
?>
```

**複数商品IDを一度に取得する場合**:

```php
<?php
// 複数の商品コードを一度に取得する関数
function get_products_by_codes($product_codes = array()) {
    if (empty($product_codes)) {
        return array();
    }
    
    $api_url = 'https://mi-business-online.onrender.com/api/products';
    
    // product_code[] パラメータを構築
    $params = array();
    foreach ($product_codes as $code) {
        $params['product_code[]'] = $code;
    }
    
    $api_url .= '?' . http_build_query($params);
    
    $response = wp_remote_get($api_url, array(
        'timeout' => 10,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        return array();
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['success']) && $data['success'] && isset($data['data'])) {
        return $data['data'];
    }
    
    return array();
}

// 使用例：記事ページ内の複数商品を一度に取得
$product_codes = array('ABC123', 'DEF456', 'GHI789');
$products = get_products_by_codes($product_codes);

foreach ($products as $product) {
    echo '<div class="product-item">';
    echo '<h3>' . esc_html($product['product_name']) . '</h3>';
    if (!empty($product['image_url'])) {
        echo '<img src="' . esc_url($product['image_url']) . '" alt="' . esc_attr($product['product_name']) . '">';
    }
    echo '<p class="price">¥' . number_format($product['price_incl_tax']) . '（税込）</p>';
    echo '<a href="' . esc_url($product['product_url']) . '" target="_blank">商品を見る</a>';
    echo '</div>';
}
?>
```

### 方法2: ショートコードを作成

functions.phpに以下のコードを追加すると、記事内で `[products limit="10"]` のように簡単に商品を表示できます：

```php
<?php
// ショートコード: [products limit="10" category="カテゴリ名" search="検索キーワード"]
function display_products_shortcode($atts) {
    $atts = shortcode_atts(array(
        'limit' => 10,
        'category' => '',
        'search' => ''
    ), $atts);
    
    $products = get_products_from_api(
        intval($atts['limit']),
        $atts['category'],
        $atts['search']
    );
    
    if (empty($products)) {
        return '<p>商品が見つかりませんでした。</p>';
    }
    
    ob_start();
    echo '<div class="products-grid">';
    foreach ($products as $product) {
        ?>
        <div class="product-card">
            <?php if (!empty($product['image_url'])): ?>
                <div class="product-image">
                    <img src="<?php echo esc_url($product['image_url']); ?>" 
                         alt="<?php echo esc_attr($product['product_name']); ?>">
                </div>
            <?php endif; ?>
            <div class="product-info">
                <h3 class="product-name"><?php echo esc_html($product['product_name']); ?></h3>
                <p class="product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
                <?php if (!empty($product['description'])): ?>
                    <p class="product-description"><?php echo esc_html(mb_substr($product['description'], 0, 100)); ?>...</p>
                <?php endif; ?>
                <a href="<?php echo esc_url($product['product_url']); ?>" 
                   class="product-link" 
                   target="_blank" 
                   rel="noopener">商品を見る</a>
            </div>
        </div>
        <?php
    }
    echo '</div>';
    return ob_get_clean();
}
add_shortcode('products', 'display_products_shortcode');
?>
```

### 方法3: STORK19テーマのカスタムブロック（Gutenberg）

STORK19テーマはブロックエディタに対応しているため、以下のようなカスタムブロックを作成できます：

```php
<?php
// functions.phpに追加
function register_product_block() {
    wp_register_script(
        'product-block',
        get_template_directory_uri() . '/js/product-block.js',
        array('wp-blocks', 'wp-element', 'wp-editor'),
        '1.0.0',
        true
    );
    
    register_block_type('stork19/product-list', array(
        'editor_script' => 'product-block',
        'render_callback' => 'render_product_block',
    ));
}
add_action('init', 'register_product_block');

function render_product_block($attributes) {
    $limit = isset($attributes['limit']) ? $attributes['limit'] : 10;
    $category = isset($attributes['category']) ? $attributes['category'] : '';
    $search = isset($attributes['search']) ? $attributes['search'] : '';
    
    $products = get_products_from_api($limit, $category, $search);
    
    if (empty($products)) {
        return '<p>商品が見つかりませんでした。</p>';
    }
    
    ob_start();
    echo '<div class="products-grid">';
    foreach ($products as $product) {
        ?>
        <div class="product-card">
            <?php if (!empty($product['image_url'])): ?>
                <div class="product-image">
                    <img src="<?php echo esc_url($product['image_url']); ?>" 
                         alt="<?php echo esc_attr($product['product_name']); ?>">
                </div>
            <?php endif; ?>
            <div class="product-info">
                <h3 class="product-name"><?php echo esc_html($product['product_name']); ?></h3>
                <p class="product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
                <a href="<?php echo esc_url($product['product_url']); ?>" 
                   class="product-link" 
                   target="_blank" 
                   rel="noopener">商品を見る</a>
            </div>
        </div>
        <?php
    }
    echo '</div>';
    return ob_get_clean();
}
?>
```

**注意**: STORK19テーマでは、ショートコード機能も利用可能です。カスタムブロックの作成が難しい場合は、[方法2](#方法2-ショートコードを作成)のショートコードを使用することを推奨します。

---

## 📝 使用例

### 例1: 記事内で商品を3件表示

記事の本文に以下のショートコードを記述：

```
[products limit="3"]
```

### 例2: 特定のカテゴリの商品を表示

```
[products limit="6" category="お詫び・謝罪"]
```

### 例3: キーワードで商品を検索

```
[products limit="5" search="お菓子"]
```

### 例4: 複数の商品コードを一度に取得

記事ページ内に複数の商品コードがある場合、一度のAPIリクエストで取得できます：

```php
<?php
// 記事内の商品コードを配列で定義（カスタムフィールドやショートコードから取得）
$product_codes = array('ABC123', 'DEF456', 'GHI789');

// 複数商品を一度に取得
$products = get_products_by_codes($product_codes);

// 商品を表示
if (!empty($products)) {
    echo '<div class="products-grid">';
    foreach ($products as $product) {
        ?>
        <div class="product-card">
            <?php if (!empty($product['image_url'])): ?>
                <div class="product-image">
                    <img src="<?php echo esc_url($product['image_url']); ?>" 
                         alt="<?php echo esc_attr($product['product_name']); ?>">
                </div>
            <?php endif; ?>
            <div class="product-info">
                <h3 class="product-name"><?php echo esc_html($product['product_name']); ?></h3>
                <p class="product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
                <a href="<?php echo esc_url($product['product_url']); ?>" 
                   class="product-link" 
                   target="_blank" 
                   rel="noopener">商品を見る</a>
            </div>
        </div>
        <?php
    }
    echo '</div>';
} else {
    echo '<p>商品が見つかりませんでした。</p>';
}
?>
```

**URL例**:
```
GET /api/products?product_code[]=ABC123&product_code[]=DEF456&product_code[]=GHI789
```

### 例5: 在庫状況を表示する

記事内で商品を紹介する際に、在庫状況を表示する例：

```php
<?php
$products = get_products_from_api(5);

foreach ($products as $product) {
    ?>
    <div class="product-card">
        <h3><?php echo esc_html($product['product_name']); ?></h3>
        <p class="price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
        
        <?php
        // 在庫状況を表示
        if (!empty($product['availability'])) {
            $class = ($product['availability'] === '販売を終了いたしました') ? 'discontinued' : 'warning';
            ?>
            <p class="availability <?php echo esc_attr($class); ?>">
                <?php echo esc_html($product['availability']); ?>
            </p>
            <?php
        }
        ?>
        
        <a href="<?php echo esc_url($product['product_url']); ?>" target="_blank">商品を見る</a>
    </div>
    <?php
}
?>
```

### 例6: マガジン記事に関連する商品を表示

マガジン記事（`https://business.mistore.jp/magazine/`）のテンプレートで、記事IDに基づいて関連商品を取得します。

#### 方法A: WordPressの記事IDを使用する場合

```php
<?php
// WordPressの記事IDを取得
$article_id = get_the_ID();

// 関連商品APIを呼び出し
$api_base_url = 'https://mi-business-online.onrender.com/api/magazine/related-products';
$related_api_url = $api_base_url . '?article_id=' . $article_id . '&limit=6';
$response = wp_remote_get($related_api_url, array(
    'timeout' => 10,
    'headers' => array('Accept' => 'application/json')
));

if (!is_wp_error($response)) {
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['success']) && $data['success'] && !empty($data['products'])) {
        echo '<section class="related-products">';
        echo '<h2>この記事に関連する商品</h2>';
        echo '<div class="products-grid">';
        
        foreach ($data['products'] as $product) {
            ?>
            <div class="product-card">
                <?php if (!empty($product['image_url'])): ?>
                    <div class="product-image">
                        <img src="<?php echo esc_url($product['image_url']); ?>" 
                             alt="<?php echo esc_attr($product['product_name']); ?>">
                    </div>
                <?php endif; ?>
                <div class="product-info">
                    <h3 class="product-name"><?php echo esc_html($product['product_name']); ?></h3>
                    <p class="product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
                    <a href="<?php echo esc_url($product['product_url']); ?>" 
                       class="product-link" 
                       target="_blank" 
                       rel="noopener">商品を見る</a>
                </div>
            </div>
            <?php
        }
        
        echo '</div>';
        echo '</section>';
    }
}
?>
```

#### 方法B: マガジン記事のURLから記事IDを抽出する場合

マガジン記事のURLが `https://business.mistore.jp/magazine/article/315` のような形式の場合：

```php
<?php
// 現在のページのURLを取得
$current_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . 
               "://" . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];

// URLから記事IDを抽出（/magazine/article/315 の形式から）
preg_match('/\/magazine\/article\/(\d+)/', $current_url, $matches);
$article_id = isset($matches[1]) ? $matches[1] : '';

// または、カスタムフィールドから記事IDを取得
if (empty($article_id)) {
    $article_id = get_post_meta(get_the_ID(), 'magazine_article_id', true);
}

if (!empty($article_id)) {
    // 関連商品APIを呼び出し
    $api_base_url = 'https://mi-business-online.onrender.com/api/magazine/related-products';
    $related_api_url = $api_base_url . '?article_id=' . $article_id . '&limit=6';
    
    // ...（上記のコードと同じ）
}
?>
```

#### 方法C: カテゴリに基づいて関連商品を表示する場合

記事のカテゴリから自動的に関連商品を取得：

```php
<?php
// WordPressのカテゴリ名を取得
$categories = get_the_category();
$category_name = '';

// マガジン記事のカテゴリマッピング
$category_mapping = array(
    'お詫び・謝罪' => 'お詫び・謝罪',
    '退職' => '退職',
    '差し入れ・手土産' => '差し入れ・手土産',
    'お祝い' => 'お祝い',
    // 必要に応じて追加
);

if (!empty($categories)) {
    $wp_category = $categories[0]->name;
    // WordPressのカテゴリ名をマガジン記事のカテゴリ名にマッピング
    if (isset($category_mapping[$wp_category])) {
        $category_name = $category_mapping[$wp_category];
    }
}

if (!empty($category_name)) {
    // カテゴリに基づいて関連商品を取得
    $api_base_url = 'https://mi-business-online.onrender.com/api/magazine/related-products';
    $related_api_url = $api_base_url . '?category=' . urlencode($category_name) . '&limit=6';
    
    $response = wp_remote_get($related_api_url, array(
        'timeout' => 10,
        'headers' => array('Accept' => 'application/json')
    ));
    
    // ...（商品表示のコード）
}
?>
```

#### 方法D: ショートコードでマガジン記事に関連商品を表示

functions.phpに追加：

```php
<?php
// ショートコード: [related-products article_id="315" limit="6"]
function display_related_products_shortcode($atts) {
    $atts = shortcode_atts(array(
        'article_id' => '',
        'category' => '',
        'limit' => 6
    ), $atts);
    
    if (empty($atts['article_id']) && empty($atts['category'])) {
        return '<p>article_id または category を指定してください。</p>';
    }
    
    $api_base_url = 'https://mi-business-online.onrender.com/api/magazine/related-products';
    $params = array('limit' => intval($atts['limit']));
    
    if (!empty($atts['article_id'])) {
        $params['article_id'] = $atts['article_id'];
    } elseif (!empty($atts['category'])) {
        $params['category'] = $atts['category'];
    }
    
    $api_url = $api_base_url . '?' . http_build_query($params);
    $response = wp_remote_get($api_url, array(
        'timeout' => 10,
        'headers' => array('Accept' => 'application/json')
    ));
    
    if (is_wp_error($response)) {
        return '<p>商品データの取得に失敗しました。</p>';
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (!isset($data['success']) || !$data['success'] || empty($data['products'])) {
        return '<p>関連商品が見つかりませんでした。</p>';
    }
    
    ob_start();
    echo '<section class="related-products">';
    echo '<h2>この記事に関連する商品</h2>';
    echo '<div class="products-grid">';
    
    foreach ($data['products'] as $product) {
        ?>
        <div class="product-card">
            <?php if (!empty($product['image_url'])): ?>
                <div class="product-image">
                    <img src="<?php echo esc_url($product['image_url']); ?>" 
                         alt="<?php echo esc_attr($product['product_name']); ?>">
                </div>
            <?php endif; ?>
            <div class="product-info">
                <h3 class="product-name"><?php echo esc_html($product['product_name']); ?></h3>
                <p class="product-price">¥<?php echo number_format($product['price_incl_tax']); ?>（税込）</p>
                <?php if (!empty($product['description'])): ?>
                    <p class="product-description"><?php echo esc_html(mb_substr($product['description'], 0, 80)); ?>...</p>
                <?php endif; ?>
                <a href="<?php echo esc_url($product['product_url']); ?>" 
                   class="product-link" 
                   target="_blank" 
                   rel="noopener">商品を見る</a>
            </div>
        </div>
        <?php
    }
    
    echo '</div>';
    echo '</section>';
    return ob_get_clean();
}
add_shortcode('related-products', 'display_related_products_shortcode');
?>
```

記事内で使用：
```
[related-products article_id="315" limit="6"]
```
または
```
[related-products category="お詫び・謝罪" limit="6"]
```

---

## 🎨 CSSスタイル例

商品を美しく表示するためのCSS例：

```css
/* 商品グリッド */
.products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
    margin: 40px 0;
}

/* 商品カード */
.product-card {
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
}

.product-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 商品画像 */
.product-image {
    width: 100%;
    padding-top: 75%; /* 4:3 アスペクト比 */
    position: relative;
    background: #f0f0f0;
    overflow: hidden;
}

.product-image img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* 商品情報 */
.product-info {
    padding: 16px;
}

.product-name {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    line-height: 1.4;
}

.product-price {
    font-size: 20px;
    font-weight: bold;
    color: #c41230;
    margin-bottom: 12px;
}

.product-description {
    font-size: 14px;
    color: #666;
    margin-bottom: 16px;
    line-height: 1.6;
}

.product-link {
    display: inline-block;
    padding: 10px 20px;
    background: #c41230;
    color: #fff;
    text-decoration: none;
    border-radius: 4px;
    font-weight: 600;
    transition: background 0.2s;
}

.product-link:hover {
    background: #a00f26;
}

/* モバイル対応 */
@media (max-width: 768px) {
    .products-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
    
    .product-info {
        padding: 12px;
    }
    
    .product-name {
        font-size: 14px;
    }
    
    .product-price {
        font-size: 18px;
    }
}
```

---

## 🔍 APIパラメータ一覧

### 商品一覧取得 (`GET /api/products`)

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|-----|------|------|-----|
| `limit` | number | いいえ | 取得件数（デフォルト: 100） | `10` |
| `offset` | number | いいえ | オフセット（デフォルト: 0） | `20` |
| `category` | string | いいえ | カテゴリでフィルタ | `お詫び・謝罪` |
| `sort` | string | いいえ | ソート順<br>`name`: 名前順<br>`price_asc`: 価格の安い順<br>`price_desc`: 価格の高い順<br>`updated_desc`: 更新日順（デフォルト） | `price_asc` |
| `q` | string | いいえ | 検索キーワード | `お菓子` |
| `product_code[]` | string[] | いいえ | 複数の商品コードを指定（配列形式）<br>**注意**: このパラメータが指定された場合、他のパラメータ（`category`, `q`, `limit`, `offset`, `sort`）は無視されます | `product_code[]=ABC123&product_code[]=DEF456` |
| `product_id[]` | string[] | いいえ | `product_code[]` の別名（同じ動作） | `product_id[]=ABC123&product_id[]=DEF456` |

**複数商品ID一括取得について**:
- `product_code[]` または `product_id[]` パラメータを使用すると、指定された複数の商品コードの商品情報を一度のAPIリクエストで取得できます
- 記事ページ内に複数商品がある場合、この機能を使用することで処理を軽減できます
- 存在しない商品コードが含まれていても、存在する商品のみが返されます（エラーにはなりません）

### 商品詳細取得 (`GET /api/products/[productCode]`)

商品コードを指定して1件の商品情報を取得します。

### 複数商品ID一括取得 (`GET /api/products?product_code[]=...`)

複数の商品コードを一度に指定して商品情報を取得します。記事ページ内に複数商品がある場合に便利です。

**URL例**:
```
GET /api/products?product_code[]=ABC123&product_code[]=DEF456&product_code[]=GHI789
```

または

```
GET /api/products?product_id[]=ABC123&product_id[]=DEF456&product_id[]=GHI789
```

**レスポンス形式**:
```json
{
  "success": true,
  "data": [
    {
      "product_code": "ABC123",
      "product_name": "商品名1",
      ...
    },
    {
      "product_code": "DEF456",
      "product_name": "商品名2",
      ...
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 2,
    "offset": 0,
    "has_more": false
  }
}
```

### 商品検索 (`GET /api/products/search`)

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|-----|------|------|-----|
| `q` | string | **はい** | 検索キーワード | `お菓子` |
| `limit` | number | いいえ | 取得件数（デフォルト: 100） | `10` |
| `offset` | number | いいえ | オフセット（デフォルト: 0） | `0` |

### マガジン記事関連商品 (`GET /api/magazine/related-products`)

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|-----|------|------|-----|
| `article_id` | string | はい* | 記事ID | `315` |
| `category` | string | はい* | カテゴリ名 | `お詫び・謝罪` |
| `limit` | number | いいえ | 表示件数（デフォルト: 6） | `6` |
| `min_price` | number | いいえ | 最低価格 | `3000` |
| `max_price` | number | いいえ | 最高価格 | `10000` |

*`article_id` または `category` のいずれかが必須

---

## ❓ よくある質問（FAQ）

### Q1: APIが返すデータが空の場合があります

**A:** 以下の原因が考えられます：
- 商品データがまだクロールされていない（初回クロールを実行してください）
- 指定したカテゴリや検索キーワードに該当する商品がない
- APIのURLが正しくない

### Q2: 商品画像が表示されない

**A:** 以下を確認してください：
- `image_url` または `image_urls` が空でないか
- 画像URLが正しくエスケープされているか（`esc_url()` を使用）
- 外部サイトの画像を読み込む際のCORS設定

### Q3: パフォーマンスが気になります

**A:** 以下の対策を推奨します：
- WordPressのキャッシュプラグインを使用
- `limit` パラメータで取得件数を制限
- 必要に応じて `wp_remote_get()` の結果をキャッシュ

```php
// キャッシュ付きの取得例
function get_products_cached($limit = 10, $category = '') {
    $cache_key = 'products_' . $limit . '_' . $category;
    $cached = get_transient($cache_key);
    
    if ($cached !== false) {
        return $cached;
    }
    
    $products = get_products_from_api($limit, $category);
    set_transient($cache_key, $products, 3600); // 1時間キャッシュ
    
    return $products;
}
```

### Q4: エラーメッセージが表示される

**A:** 以下を確認してください：
- APIのURLが正しいか
- サーバーが外部APIにアクセスできるか（ファイアウォール設定）
- WordPressのデバッグモードを有効にしてエラー詳細を確認

```php
// wp-config.phpに追加
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

### Q5: 特定の商品だけを表示したい

**A:** 商品コードを指定して詳細APIを使用：

```php
$product_code = 'ABC123';
$api_url = 'https://mi-business-online.onrender.com/api/products/' . $product_code;
$response = wp_remote_get($api_url);

if (!is_wp_error($response)) {
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['success']) && $data['success'] && isset($data['data'])) {
        $product = $data['data'];
        // 商品情報を表示
    }
}
```

### Q6: 在庫状況（availability）を表示したい

**A:** `availability`フィールドを使用して、商品の在庫状況を表示できます。詳細は[在庫状況（availability）について](#-在庫状況availabilityについて)のセクションを参照してください。

簡単な実装例：

```php
<?php
// 商品データを取得
$product = get_product_by_code('ABC123');

// 在庫状況を表示
if (!empty($product['availability'])) {
    echo '<p class="availability">' . esc_html($product['availability']) . '</p>';
}
?>
```

### Q7: 記事ページ内の複数商品を効率的に取得したい

**A:** `product_code[]` または `product_id[]` パラメータを使用して、複数の商品コードを一度のAPIリクエストで取得できます：

```php
// 複数の商品コードを一度に取得
$product_codes = array('ABC123', 'DEF456', 'GHI789');
$products = get_products_by_codes($product_codes);

// または直接APIを呼び出す場合
$api_url = 'https://mi-business-online.onrender.com/api/products';
$params = array();
foreach ($product_codes as $code) {
    $params['product_code[]'] = $code;
}
$api_url .= '?' . http_build_query($params);

$response = wp_remote_get($api_url, array(
    'timeout' => 10,
    'headers' => array('Accept' => 'application/json')
));

if (!is_wp_error($response)) {
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['success']) && $data['success'] && isset($data['data'])) {
        $products = $data['data'];
        // 商品情報を表示
    }
}
```

**メリット**:
- 複数のAPIリクエストを1回にまとめられるため、処理が軽くなる
- 記事ページ内に複数商品がある場合に特に有効
- 存在しない商品コードが含まれていても、存在する商品のみが返される（エラーにはならない）

---

## 📞 サポート

問題が発生した場合や、追加の機能が必要な場合は、開発チームまでお問い合わせください。

---

## 📚 参考リンク

- API仕様書: `/api/products` の詳細仕様
- マガジン記事-商品連携API: `/api/magazine/related-products` の使い方
- 三越伊勢丹法人オンラインストア ギフトマガジン: [https://business.mistore.jp/magazine/](https://business.mistore.jp/magazine/)

---

## 📌 マガジン記事での実装のポイント

### 記事IDの取得方法

マガジン記事のURL構造は以下の通りです：
- 記事ページ: `https://business.mistore.jp/magazine/article/315`
- 記事IDはURLの最後の数字部分（例: `315`）

WordPressでマガジン記事を管理する場合、以下の方法で記事IDを取得できます：

1. **カスタムフィールドを使用**: 各記事に `magazine_article_id` というカスタムフィールドを設定
2. **URLから抽出**: リダイレクトやパーマリンク設定で記事IDを含める
3. **固定値を使用**: 特定の記事IDを直接指定

### 推奨実装パターン

マガジン記事テンプレート（`single.php` や `single-magazine.php`）に、以下のコードを追加することを推奨します：

```php
<?php
// 記事の最後に自動的に関連商品を表示
if (function_exists('display_related_products_shortcode')) {
    $article_id = get_post_meta(get_the_ID(), 'magazine_article_id', true);
    if (!empty($article_id)) {
        echo do_shortcode('[related-products article_id="' . esc_attr($article_id) . '" limit="6"]');
    }
}
?>
```

---

**最終更新日**: 2026年1月16日

