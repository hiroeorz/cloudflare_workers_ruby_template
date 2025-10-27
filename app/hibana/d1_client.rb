module D1
  class PreparedStatement
    def initialize(sql)
      @sql = sql
      @bindings = []
    end

    def bind(*values)
      @bindings = values
      self # メソッドチェーンのためにselfを返す
    end

    def first
      # 実行時に初めてTypeScript側の関数を呼び出す
      HostBridge.run_d1_query(@sql, @bindings, "first")
    end

    def all
      HostBridge.run_d1_query(@sql, @bindings, "all")
    end

    def run
      HostBridge.run_d1_query(@sql, @bindings, "run")
    end
  end

  class Database
    def prepare(sql)
      PreparedStatement.new(sql)
    end
  end
end
