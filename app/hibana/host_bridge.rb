module HostBridge
  class << self
    attr_accessor :ts_kv_put, :ts_kv_get, :ts_r2_put, :ts_r2_get, :ts_run_d1_query

    def kv_put(key, value)
      ts_kv_put.apply(key, value).await
    end

    def kv_get(key)
      ts_kv_get.apply(key).await
    end

    def r2_put(key, value)
      ts_r2_put.apply(key, value).await
    end

    def r2_get(key)
      ts_r2_get.apply(key).await
    end

    def run_d1_query(sql, bindings, action)
      ts_run_d1_query.apply(sql, bindings, action).await
    end
  end
end
