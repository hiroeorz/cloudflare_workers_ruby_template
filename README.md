# Cloudflare Workers Ruby Template

This project is a template for experimenting with a Hono-like Ruby framework running on Cloudflare Workers. It bundles Ruby WASM together with Cloudflare bindings (KV / D1 / R2) so you can explore the stack quickly.

---

## Getting Started

- Install dependencies.
  - `npm install`
- Launch the local development server.
  - `npx wrangler dev`
  - Visit `http://127.0.0.1:8787` to explore the routes.
- Build the project.
  - `npx wrangler build`
- Deploy to Cloudflare Workers.
  - `npx wrangler deploy`

## Routing and Application Logic

### Routing

Define your routes in `app/app.rb`. The simplest “Hello World” looks like this:

```ruby
get "/" do |c|
  c.text("Hello from Ruby WASM")
end
```

Returning HTML or JSON is just as straightforward:

```ruby
get "/index.html" do |c|
  c.html("<h1>Hello Cloudflare Workers!</h1>")
end

get "/index.js" do |c|
  c.json({ name: "Hiroe", age: 50 })
end
```

### Handling Query Parameters and POST Data

Working with query parameters and request bodies keeps the same style:

```ruby
get "/query" do |c|
  name = c.query["name"]
  age = c.query["age"]
  c.text("Name: #{name}, Age: #{age}")
end

post "/echo" do |c|
  content_type = c.content_type
  data = c.form_body
  # data = c.json_body
  # data = c.raw_body

  c.text("get post data")
end
```

## Cloudflare Bindings

The template ships with sample integrations for Cloudflare KV, D1, and R2—just reference the binding name to call them from Ruby.

### KV

```ruby
get "/kv" do |c|
  key = "ruby-kv-key"
  value = "Hello from separated KV functions!"

  kv = c.env(:MY_KV)
  kv.put(key, value)
  read_value = kv.get(key)

  c.text("Wrote '#{value}' to KV. Read back: '#{read_value}'")
end
```

### D1

```ruby
get "/d1" do |c|
  db = c.env(:DB)
  result = db.prepare("SELECT * FROM posts WHERE id = ?").bind(1).first
  c.text(result)
end
```

### R2

```ruby
get "/r2" do |c|
  key = "ruby-r2-key"
  value = "Hello from R2 sample!"

  bucket = c.env(:MY_R2)
  bucket.put(key, value)
  read_value = bucket.get(key).text

  c.text("Wrote '#{value}' to R2. Read back: '#{read_value}'")
end
```

---

This README is meant to give you a feel for the template rather than document every detail. Explore the files and sample code to tailor the project to your needs.
