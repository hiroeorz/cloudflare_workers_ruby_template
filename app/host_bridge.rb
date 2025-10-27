module HostBridge
  class << self
    attr_accessor :ts_kv_put, :ts_kv_get, :ts_run_d1_query

    def kv_put(key, value)
      ts_kv_put.apply(key, value).await
    end

    def kv_get(key)
      ts_kv_get.apply(key).await
    end

    def run_d1_query(sql, bindings)
      ts_run_d1_query.apply(sql, bindings).await
    end
  end
end
