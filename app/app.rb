# Binding register.
R2.register_binding("MY_R2")
KV.register_binding("MY_KV")
D1.register_binding("DB")

# --- ルート定義 ---

# hello world
get "/" do |c|
  c.text("Hello from Ruby WASM")
end

get "/index.html" do |c|
  c.html("<h1>Hello Cloudflare Workers!</h1>")
end

get  "/index.js" do |c|
  c.json({name: "Hiroe", age: 50})
end

# 404 NotFound sample.
get "/hoge" do |c|
  c.status = 404
  c.text("hoge not found.")
end

# 404 NotFound sample.
get "/tara" do |c|
  c.text("tara not found", status: 404)
end

# Cloudflare KV sample.
get "/kv" do |c|
  key = "ruby-kv-key"
  value = "Hello from separated KV functions!"

  kv = c.env(:MY_KV)
  kv.put(key, value)
  read_value = kv.get(key)

  c.text("Wrote '#{value}' to KV. Read back: '#{read_value}'")
end

# Cloudflare D1 sample.
get "/d1" do |c|
  db = c.env(:DB)
  result = db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
  c.text(result)
end

# Cloudflare R2 sample.
get "/r2" do |c|
  key = "ruby-r2-key"
  value = "Hello from R2 sample!"

  bucket = c.env(:MY_R2)
  bucket.put(key, value)
  read_value = bucket.get(key).text

  c.text("Wrote '#{value}' to R2. Read back: '#{read_value}'")
end
