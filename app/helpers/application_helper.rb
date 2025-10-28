class ApplicationHelper
  def run_kv_test(context)
    key = "ruby-kv-key"
    value = "Hello from separated KV functions!"

    kv = context.env(:MY_KV)

    # コンテキスト経由でKVへアクセスし、データを保存・取得
    kv.put(key, value)
    read_value = kv.get(key)

    "Wrote '#{value}' to KV. Read back: '#{read_value}'"
  end

  def run_d1_test
    sql = "SELECT id, content FROM posts WHERE id = ?"
    bindings = [1]

    # TypeScript側の関数を呼び出し、結果(JSON文字列)を待つ
    HostBridge.run_d1_query(sql, bindings, "all").await # Changed to all for consistency
  end

  def run_r2_test(context)
    key = "ruby-r2-key"
    value = "Hello from R2 sample!"

    bucket = context.env(:MY_R2)

    # コンテキスト経由でR2へデータを書き込み、その後取得してレスポンスを作成
    bucket.put(key, value)
    read_value = bucket.get(key)&.text

    if read_value.nil?
      "Wrote '#{value}' to R2. Read back failed."
    else
      "Wrote '#{value}' to R2. Read back: '#{read_value}'"
    end
  end
end
