app_helper = ApplicationHelper.new
R2.register_binding("MY_R2")
KV.register_binding("MY_KV")


# --- ルート定義 ---
get "/" do |c|
  "Hello from Ruby WASM"
end

get "/kv" do |c|
  app_helper.run_kv_test(c)
end

get "/d1" do |c|
  db = D1::Database.new
  db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
end

get "/r2" do |c|
  app_helper.run_r2_test(c)
end
