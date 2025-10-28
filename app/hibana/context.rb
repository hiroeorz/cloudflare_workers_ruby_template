class EnvBinding
  def initialize(binding_name)
    @binding_name = binding_name.to_s
  end

  def method_missing(name, *args, &block)
    if block
      raise ArgumentError, "Block is not supported for EnvBinding##{name}"
    end

    result = HostBridge.call_binding(@binding_name, name, *args)
    if result.respond_to?(:await)
      result.await
    else
      result
    end
  end

  def respond_to_missing?(_name, _include_private = false)
    true
  end
end

class RequestContext
  @binding_factories = {}
  @binding_matchers = []

  class << self
    attr_reader :binding_factories, :binding_matchers

    def register_binding(identifier, &factory)
      raise ArgumentError, "Block is required" unless block_given?

      if identifier.is_a?(Regexp)
        binding_matchers << [identifier, factory]
      else
        binding_factories[identifier.to_s] = factory
      end
    end

    def binding_factory_for(name)
      binding_factories[name] ||
        binding_matchers.find { |pattern, _| pattern.match?(name) }&.last
    end
  end

  def initialize
    @bindings = {}
  end

  def env(binding_name = nil)
    return self if binding_name.nil?
    fetch_binding(binding_name)
  end

  def method_missing(name, *args, &block)
    return fetch_binding(name) if args.empty? && block.nil?
    super
  end

  def respond_to_missing?(_name, _include_private = false)
    true
  end

  private

  def fetch_binding(binding_name)
    key = binding_name.to_s
    @bindings[key] ||= begin
      factory = self.class.binding_factory_for(key)
      if factory
        factory.call(self, key)
      else
        EnvBinding.new(key)
      end
    end
  end
end
