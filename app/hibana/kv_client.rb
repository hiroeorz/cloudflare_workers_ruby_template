module KV
  class Namespace
    def initialize(binding_name)
      @binding_name = binding_name.to_s
    end

    def put(key, value, **options)
      args = [key, value]
      normalized = normalize_put_options(options)
      args << normalized unless normalized.empty?
      HostBridge.call_async(@binding_name, :put, *args)
    end

    def get(key, type: :text)
      args = [key]
      options = {}
      options[:type] = normalize_type(type) if type
      args << options unless options.empty?
      HostBridge.call_async(@binding_name, :get, *args)
    end

    def delete(key)
      HostBridge.call_async(@binding_name, :delete, key)
    end

    def list(prefix: nil, limit: nil, cursor: nil)
      options = {}
      options[:prefix] = prefix if prefix
      options[:limit] = limit if limit
      options[:cursor] = cursor if cursor
      args = []
      args << options unless options.empty?
      HostBridge.call_async(@binding_name, :list, *args)
    end

    private

    PUT_OPTION_KEY_MAP = {
      expiration: "expiration",
      expiration_ttl: "expirationTtl",
      metadata: "metadata"
    }.freeze

    def normalize_put_options(options)
      return {} if options.empty?

      options.each_with_object({}) do |(key, value), acc|
        next if value.nil?
        mapped_key = PUT_OPTION_KEY_MAP.fetch(key.to_sym) { key.to_s }
        acc[mapped_key] = value
      end
    end

    def normalize_type(type)
      case type
      when Symbol
        type.to_s
      else
        type
      end
    end
  end

  class << self
    def register_binding(identifier)
      RequestContext.register_binding(identifier) do |_context, binding_name|
        Namespace.new(binding_name)
      end
    end
  end
end

KV.register_binding("MY_KV")
