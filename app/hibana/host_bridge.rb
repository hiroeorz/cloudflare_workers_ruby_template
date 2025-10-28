module HostBridge
  class << self
    attr_accessor :ts_kv_put,
                  :ts_kv_get,
                  :ts_r2_put,
                  :ts_r2_get,
                  :ts_run_d1_query,
                  :ts_call_binding

    def kv_put(key, value)
      call_binding("MY_KV", :put, key, value).await
    end

    def kv_get(key)
      call_binding("MY_KV", :get, key).await
    end

    def r2_put(key, value)
      call_binding("MY_R2", :put, key, value).await
    end

    def r2_get(key)
      call_binding("MY_R2", :get, key).await
    end

    def run_d1_query(sql, bindings, action)
      ts_run_d1_query.apply(sql, bindings, action).await
    end

    def call_binding(binding_name, method_name, *args)
      unless ts_call_binding
        raise "Host function 'ts_call_binding' is not registered"
      end
      ts_call_binding.apply(binding_name.to_s, method_name.to_s, args)
    end
  end
end
