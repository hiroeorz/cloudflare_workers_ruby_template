# hello world (render templates/index.html.erb)
get "/" do |c|
  c.render("index", name: "Hibana", age: 50)
end

# html sample
get "/index.html" do |c|
  c.html("<h1>Hello Cloudflare Workers!</h1>")
end

# json sample.
get  "/index.js" do |c|
  c.json({name: "Hiroe", age: 50})
end

# GET query sample. /query?name=Mike&age=20
get "/query" do |c|
  name = c.query["name"]
  age = c.query["age"]
  c.text("Name: #{name}, Age: #{age}")
end
