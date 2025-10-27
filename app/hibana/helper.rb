module Hibana
  class Helper
    def run_kv_test
      key = "ruby-kv-key"
      value = "Hello from separated KV functions!"

      # TypeScript側の関数を呼び出す
      HostBridge.kv_put(key, value).await
      read_value = HostBridge.kv_get(key).await

      "Wrote '#{value}' to KV. 
Read back: '#{read_value}'"
    end

    def run_d1_test
      sql = "SELECT id, content FROM posts WHERE id = ?"
      bindings = [1]

      # TypeScript側の関数を呼び出し、結果(JSON文字列)を待つ
      HostBridge.run_d1_query(sql, bindings).await
    end
  end
end

# TypeScriptから呼び出すために、Hibana::Helperクラスのインスタンスを生成しておく
Hibana::Helper.new
