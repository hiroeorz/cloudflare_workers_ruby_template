# アプリケーションロジックを読み込む
# require_relative はWASM環境では使えないため、TypeScript側で読み込み順を制御します

# アプリケーションインスタンスを生成
hibana_app = Hibana::App.new

# --- ルート定義 ---
get "/" do |c|
  "Hello from Ruby Router!"
end

get "/kv" do |c|
  hibana_app.run_kv_test
end

get "/d1" do |c|
  hibana_app.run_d1_test
end
