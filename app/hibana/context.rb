require "json"

class Response
  attr_reader :body, :status, :headers

  def initialize(body:, status: 200, headers: {})
    @body = body.nil? ? "" : body.to_s
    @status = status.to_i
    @headers = normalize_headers(headers)
  end

  def payload
    {
      "body" => body,
      "status" => status,
      "headers" => headers,
    }
  end

  private

  def normalize_headers(headers)
    return {} if headers.nil?

    headers.each_with_object({}) do |(key, value), acc|
      next if value.nil?
      acc[key.to_s] = value.to_s
    end
  end
end

class EnvBinding
  def initialize(binding_name)
    @binding_name = binding_name.to_s
  end

  def method_missing(name, *args, &block)
    if block
      raise ArgumentError, "Block is not supported for EnvBinding##{name}"
    end

    HostBridge.call_async(@binding_name, name, *args)
  end

  def respond_to_missing?(_name, _include_private = false)
    true
  end
end

class RequestContext
  @binding_factories = {}
  @binding_matchers = []

  TEXT_HEADERS = { "content-type" => "text/plain; charset=UTF-8" }.freeze
  JSON_HEADERS = { "content-type" => "application/json; charset=UTF-8" }.freeze

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

  def status=(status)
    @status = status
  end

  def status
    @status ||= 200
  end

  def text(body, status: nil, headers: {})
    status = self.status if status.nil?
    Response.new(body: body, status: status, headers: TEXT_HEADERS.merge(headers || {}))
  end

  def json(data, status: 200, headers: {})
    Response.new(
      body: JSON.generate(data),
      status: status,
      headers: JSON_HEADERS.merge(headers || {}),
    )
  end

  def response(body:, status: 200, headers: {})
    Response.new(body: body, status: status, headers: headers || {})
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
