class Counter < Hibana::DurableObject::Base
  def fetch(_request)
    current = storage.get("count").to_i
    next_value = current + 1
    storage.put("count", next_value)

    json(count: next_value)
  end
end

Hibana::DurableObjects.register :COUNTER, Counter
