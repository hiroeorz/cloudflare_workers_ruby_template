module R2
  class Bucket
    def put(key, value)
      # TypeScript側のR2関数を呼び出し、完了まで待機
      HostBridge.r2_put(key, value)
    end

    def get(key)
      # 取得結果は文字列またはnilを想定
      HostBridge.r2_get(key)
    end
  end
end
