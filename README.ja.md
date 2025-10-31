# Cloudflare Workers Ruby テンプレート

このプロジェクトは Cloudflare Workers 上で動作する Hono ライクな Ruby フレームワークのテンプレートです。
Ruby WASM と Cloudflare のバインディング（KV / D1 / R2 など）を含んでいます。

---

## はじめ方

- 依存関係をセットアップ・
    - `npm install`
- ローカル開発サーバを起動します。
    - `npx wrangler dev`
    - ブラウザで `http://127.0.0.1:8787` にアクセスしてルートを確認。
- ビルド
    - `npm run build`
- Cloudflare Workers へデプロイ
    - `npx wrangler deploy`

## ルーティングとアプリケーションロジックの実装

### ルーティング

`app/app.rb` にルートを定義します。最もシンプルな “Hello World” は以下です。

```ruby
get "/" do |c|
  c.text("Hello from Ruby WASM")
end
```

HTML や JSON を返すルートも同様の感覚で書けます。

```ruby
get "/index.html" do |c|
  c.html("<h1>Hello Cloudflare Workers!</h1>")
end

get "/index.js" do |c|
  c.json({ name: "Hiroe", age: 50 })
end
```

### クエリパラメータおよび POST データの取得

クエリパラメータやボディを扱うルートも簡単です。

```ruby
get "/query" do |c|
  name = c.query["name"]
  age = c.query["age"]
  c.text("Name: #{name}, Age: #{age}")
end

post "/echo" do |c|
  content_type = c.content_type
  data = c.form_body
  # data = c.json_body
  # data = c.raw_body

  c.text("get post data")
end
```

## Cloudflare バインディング

テンプレートには Cloudflare KV / D1 / R2 のサンプル実装が含まれており、バインディング名を使って Ruby から操作できます。

### KV

```ruby
get "/kv" do |c|
  key = "ruby-kv-key"
  value = "Hello from separated KV functions!"

  kv = c.env(:MY_KV)
  kv.put(key, value)
  read_value = kv.get(key)

  c.text("Wrote '#{value}' to KV. Read back: '#{read_value}'")
end
```

### D1

```ruby
get "/d1" do |c|
  db = c.env(:DB)
  result = db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
  c.text(result)
end
```

### R2

```ruby
get "/r2" do |c|
  key = "ruby-r2-key"
  value = "Hello from R2 sample!"

  bucket = c.env(:MY_R2)
  bucket.put(key, value)
  read_value = bucket.get(key).text

  c.text("Wrote '#{value}' to R2. Read back: '#{read_value}'")
end
```

---

この README で全てを説明し尽くすことは目指していません。
テンプレートの雰囲気を掴み、ファイル構成やサンプルコードを見ながらカスタマイズを進めてください。
