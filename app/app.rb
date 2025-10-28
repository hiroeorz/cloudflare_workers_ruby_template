app_helper = ApplicationHelper.new
R2.register_binding("MY_R2")
KV.register_binding("MY_KV")
D1.register_binding("DB")


# --- ルート定義 ---
get "/" do |c|
  "Hello from Ruby WASM"
end

# Cloudflare KV sample.
get "/kv" do |c|
  key = "ruby-kv-key"
  value = "Hello from separated KV functions!"

  kv = c.env(:MY_KV)
  kv.put(key, value)
  read_value = kv.get(key)

  "Wrote '#{value}' to KV. Read back: '#{read_value}'"
end

# Cloudflare D1 sample.
get "/d1" do |c|
  db = c.env(:DB)
  db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
end

# Cloudflare R2 sample.
get "/r2" do |c|
  key = "ruby-r2-key"
  value = "Hello from R2 sample!"

  bucket = c.env(:MY_R2)
  bucket.put(key, value)
  read_value = bucket.get(key).text

  "Wrote '#{value}' to R2. Read back: '#{read_value}'"
end
