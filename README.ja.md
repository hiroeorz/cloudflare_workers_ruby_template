# Cloudflare Workers Ruby テンプレート

このプロジェクトは Cloudflare Workers 上で動作する Hono・Sinatra ライクな Ruby フレームワークのテンプレートです。
Ruby WASM と Cloudflare のバインディング（KV / D1 / R2 / Workers AI など）を含んでいます。

新しいプロジェクトを作成する際は、このリポジトリを直接 clone せずに `npm create hibana@latest <project-name>` を実行してください。

---

## はじめ方

- 依存関係をセットアップ・
  - `npm install`
- ローカル開発サーバを起動します。
  - `npx wrangler dev`
  - ブラウザで `http://127.0.0.1:8787` にアクセスしてルートを確認。
- ビルド
  - `npx wrangler build`
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
get "/sample.html" do |c|
  c.html("<h1>Hello Cloudflare Workers!</h1>")
end

get "/sample.js" do |c|
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

### Queue（送信）

```ruby
post "/jobs" do |c|
  payload = {
    id: SecureRandom.uuid,
    body: c.raw_body.to_s,
  }
  c.env(:TASK_QUEUE).enqueue(payload, metadata: { source: "template" })
  c.text("Queued #{payload[:id]}", status: 202)
end
```

- `_QUEUE` で終わるバインディングは自動でキュープロデューサーにラップされ、このテンプレートでは `wrangler.toml` に `TASK_QUEUE` を定義済みです。
- `Hash` や `Array` を渡すと自動で JSON にシリアライズされ `contentType = "json"` になります。文字列は既定で `contentType = "text"` として送信されます。
- 実運用では `wrangler queues create wasm-ruby-template-tasks` などでバックエンドの Queue を作成してから利用してください（必要に応じて名称を変更）。

### Queue（受信）

```ruby
queue binding: :TASK_QUEUE do |batch, ctx|
  batch.each do |message|
    puts "[queue] #{message.id}: #{message.body.inspect}"
    message.ack!
  rescue => e
    warn "[queue] retry #{message.id}: #{e.message}"
    message.retry!(delay_seconds: 30)
  end
end
```

- `wrangler.toml` に `[[queues.consumers]]` を追加すると、該当バッチが Ruby に渡されます。`queue binding: :TASK_QUEUE` を複数定義すると、バインディング名・キュー名でフィルタできます。
- `batch.messages` は Ruby オブジェクトに自動変換され、`message.body` で JSON（または文字列）をそのまま扱えます。`ack!` したメッセージは再配信されません。
- ハンドラ内で未処理の例外が起きると Cloudflare 側でバッチ全体がリトライされるため、成功したメッセージは確実に `ack!`、リトライしたいものは `retry!(delay_seconds:)` を呼んでから例外を投げてください。

### Workers AI

Workers AI との連携もできます。渡すパラメータはモデルによって異なるので注意してください。

LLM に `@cf/meta/llama-3.1-8b-instruct-fast` を使う場合のサンプル。

```ruby
get "/ai-demo-llama" do |c|
  ai = c.env(:AI)
  prompt = "What is Cloudflare Workers AI ?"
  model = "@cf/meta/llama-3.1-8b-instruct-fast"

  result = ai.run(
    model: model,
    payload: {
      prompt: prompt,
      temperature: 0.8,
      max_output_tokens: 30,
    },
  )
  c.json({prompt: prompt, result: result})
rescue WorkersAI::Error => e
  c.json({ error: e.message, details: e.details }, status: 500)
end
```

LLM に `gpt-oss-20b` を使う場合のサンプル。

```ruby
get "/ai-demo-gpt-oss" do |c|
  ai = c.env(:AI)
  prompt = "What is Cloudflare Workers AI ?"
  model = "@cf/openai/gpt-oss-20b"

  result = ai.run(
    model: model,
    payload: {
      input: prompt,
      reasoning: {
        effort: "low",
        summary: "auto"
      }
    },
  )
  c.json({prompt: prompt, result: result})
rescue WorkersAI::Error => e
  c.json({ error: e.message, details: e.details }, status: 500)
end
```

### スケジュール済み Cron イベント

Cron の発火タイミングは `wrangler.toml` の `[triggers].crons` に記述し、Ruby 側では `cron` DSL で処理を定義します。

`wrangler.toml`

```toml
[triggers]
crons = ["0 0 * * *", "0 12 * * *"]
```

`app/app.rb`

```ruby
cron "0 0 * * *" do |event, ctx|
  ctx.env(:MY_KV).put("nightly_report", event.scheduled_time)
end

cron "*" do |event, _ctx|
  puts "Cron fired: #{event.cron}"
end
```

- ハンドラは宣言順に評価され、マッチしたものはすべて実行されます。最後に `cron "*"` を置けばフォールバックとして利用できます。
- ブロックの `event` には `event.cron` / `event.scheduled_time` / `event.retry_count` など Workers から渡された情報が入り、`ctx` は HTTP ルートと同じ `env(:MY_KV)` や `json` などを備えた `ScheduledContext` です。
- `wrangler.toml` に定義されている Cron に Ruby 側のハンドラが無い場合、毎回警告ログが出るため定義漏れに気付きやすくなっています。意図的に空処理にしたい場合は空ブロックを書いてください。

### 外部サービスへの HTTP リクエスト

組み込みの `Http` クライアントを使うと、Cloudflare Workers 側の `fetch` を経由して外部 API にアクセスできます。Ruby からは同期的に見える API で、内部的に TypeScript に委譲しています。

```ruby
# GET のサンプル
get "/http-get" do |c|
  response = Http.get("https://jsonplaceholder.typicode.com/todos/1")
  c.json(body: JSON.parse(response.body), status: response.status)
end

# POST のサンプル
post "/http-post" do |c|
  response = Http.post(
    "https://httpbin.org/post",
    json: { name: "Ruby Worker", role: "client" },
  )
  c.json(body: JSON.parse(response.body)["json"], status: response.status)
end
```

詳細は `app/app.rb` や `app/app_all_sample.rb` を参照してください。

---

## D1 マイグレーション

まずは Wrangler でデータベースを作成します（必要に応じて名前を変更してください）。

```bash
npx wrangler d1 create wasm-d1-test
```

スキーマは `migrations/wasm-d1-test/` 以下で管理します。`wrangler.toml` の `database_name` と同名のディレクトリを Wrangler が参照する仕組みです。

初期マイグレーション `0001_create_posts_table.sql` では `/d1` ルートで利用する `posts` テーブルを作成します。

- D1 を利用しない場合は、マイグレーションコマンドを実行せず放置するか、`migrations/` ディレクトリを削除しても問題ありません。

- 適用: `npm run db:migrate`
- 新規作成: `npm run db:migration:new "add_comments_table"`

SQL を編集した後に再度 `npm run db:migrate` を実行すると、Cloudflare D1 に反映されます。

---

## ヘルパーの自動読み込み

`app/helpers` 配下に Ruby ファイルを置くと、自動生成される `src/generated/helper-scripts.ts` に取り込まれ、Ruby VM 起動時に順番に読み込まれます。
開発サーバ起動時（ `npx wrangler dev` ）などに自動で再生成されますが、手動で更新したい場合は `npm run build:helpers` を実行してください。

---

この README で全てを説明し尽くすことは目指していません。
テンプレートの雰囲気を掴み、ファイル構成やサンプルコードを見ながらカスタマイズを進めてください。
