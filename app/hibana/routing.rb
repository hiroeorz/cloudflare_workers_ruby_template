# ルート定義を保存するハッシュ
@routes = Hash.new { |h, k| h[k] = {} }

# get "/path" do |c| ... end 形式のDSLを定義
def get(path, &block)
  @routes["GET"][path] = block
end

def post(path, &block)
  @routes["POST"][path] = block
end

# リクエストを処理する関数
def dispatch(method, path, context)
  block = @routes[method][path]
  if block
    # ブロックを実行し、コンテキストを渡す
    block.call(context)
  else
    "Ruby Router: Not Found"
  end
end
