module HostBridge
  class << self
    attr_accessor :ts_call_binding, :ts_run_d1_query

    def call(binding_name, method_name, *args)
      ensure_registered!
      ts_call_binding.apply(binding_name.to_s, method_name.to_s, args)
    end

    def call_async(binding_name, method_name, *args)
      result = call(binding_name, method_name, *args)
      if result.respond_to?(:await)
        result.await
      else
        result
      end
    end

    def run_d1_query(binding_name, sql, bindings, action)
      unless ts_run_d1_query
        raise "Host function 'ts_run_d1_query' is not registered"
      end
      ts_run_d1_query.apply(binding_name.to_s, sql, bindings, action).await
    end

    private

    def ensure_registered!
      unless ts_call_binding
        raise "Host function 'ts_call_binding' is not registered"
      end
    end
  end
end
