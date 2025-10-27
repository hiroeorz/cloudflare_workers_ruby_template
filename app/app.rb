hibana_helper = Hibana::Helper.new

# --- ルート定義 ---
get "/" do |c|
  "Hello from Ruby Router!"
end

get "/kv" do |c|
  hibana_helper.run_kv_test
end

get "/d1" do |c|
  db = D1::Database.new
  db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
end
