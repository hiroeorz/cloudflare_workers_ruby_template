app_helper = ApplicationHelper.new

# --- ルート定義 ---
get "/" do |c|
  "Hello from Ruby Router!"
end

get "/kv" do |c|
  app_helper.run_kv_test
end

get "/d1" do |c|
  db = D1::Database.new
  db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
end

get "/r2" do |c|
  app_helper.run_r2_test
end
