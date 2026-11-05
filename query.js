/* A tiny SQL engine for the "Query my work" console.
   Supports: SELECT cols | * | count(*)  FROM t  [WHERE ... AND/OR/NOT, =, !=, <>, <, >, <=, >=, LIKE]
             [GROUP BY col]  [ORDER BY col [ASC|DESC]]  [LIMIT n]                                  */
(function () {
  "use strict";

  var DB = {
    projects: [
      { name: "LeadFlow", track: "software", stack: "python, fastapi, mongodb, redis, rq, docker", year: 2026, status: "done" },
      { name: "Job market ETL pipeline", track: "data", stack: "python, pandas, sql, sqlite", year: 2026, status: "done" },
      { name: "Credit card default prediction", track: "ml", stack: "python, scikit-learn, pandas, numpy", year: 2025, status: "done" },
      { name: "Customer spending dashboard", track: "data", stack: "power bi, sql, python", year: 2025, status: "done" },
      { name: "AI email assistant", track: "software", stack: "react, typescript, ionic, gmail api, openai", year: 2025, status: "done" },
      { name: "Finance budget tracker", track: "software", stack: "java, swing, junit, json", year: 2024, status: "done" },
      { name: "Sudoku solver", track: "software", stack: "python", year: 2024, status: "done" },
      { name: "Maternal health risk classifier", track: "ml", stack: "r, jupyter, knn", year: 2023, status: "done" },
      { name: "Speedrun analytics database", track: "data", stack: "oracle sql", year: null, status: "done" },
      { name: "Resume parser", track: "ml", stack: "python, spacy, nltk, regex", year: null, status: "done" }
    ],
    experience: [
      { company: "Atreides", role: "Data Engineer Co-op (ingestion, backfill)", start: "2026-05", end: "2026-08", months: 4, track: "data", stack: "aws lambda" },
      { company: "UBC", role: "Resident Advisor", start: "2025-08", end: null, months: 15, track: "leadership" },
      { company: "Grant Thornton", role: "Data Science Intern", start: "2025-05", end: "2025-07", months: 3, track: "data" },
      { company: "UBC", role: "Teaching Assistant", start: "2024-09", end: null, months: 26, track: "software" },
      { company: "Venu AI", role: "AI Software Engineer → Program Manager", start: "2023-08", end: "2024-08", months: 12, track: "ml" },
      { company: "Edsolab", role: "STEM Research Intern", start: "2023-06", end: "2023-09", months: 4, track: "research" }
    ],
    awards: [
      { award: "International Student Scholarship", issuer: "UBC", year: 2024 },
      { award: "International Student Scholarship", issuer: "UBC", year: 2025 }
    ],
    football: [
      { fact: "plays", detail: "most weekends" },
      { fact: "watches", detail: "every match he can" },
      { fact: "note", detail: "You found the easter egg. Say hi: zaidsayedbusiness@gmail.com" }
    ],
    skills: [
      { name: "Python", area: "languages" }, { name: "SQL", area: "languages" }, { name: "R", area: "languages" },
      { name: "Java", area: "languages" }, { name: "TypeScript", area: "languages" }, { name: "JavaScript", area: "languages" }, { name: "C++", area: "languages" },
      { name: "PySpark", area: "data" }, { name: "Pandas", area: "data" }, { name: "SQLite", area: "data" }, { name: "Power BI", area: "data" }, { name: "ETL pipelines", area: "data" },
      { name: "scikit-learn", area: "ml" }, { name: "TensorFlow", area: "ml" }, { name: "NumPy", area: "ml" }, { name: "Prompt engineering", area: "ml" },
      { name: "React", area: "software" }, { name: "FastAPI", area: "software" }, { name: "MongoDB", area: "software" }, { name: "Redis", area: "software" }, { name: "Docker", area: "software" }, { name: "Git", area: "software" }, { name: "JUnit", area: "software" }
    ]
  };

  // months for ongoing roles stay current
  (function () {
    var now = new Date();
    DB.experience.forEach(function (r) {
      if (r.end) return;
      var p = r.start.split("-");
      r.months = (now.getFullYear() - +p[0]) * 12 + (now.getMonth() + 1 - +p[1]) + 1;
    });
  })();

  function SqlError(msg) { this.message = msg; }

  function tokenize(src) {
    var re = /\s*(?:('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|!=|=|<|>|\*|,|\(|\)|;))/y;
    var out = [], m;
    re.lastIndex = 0;
    while (re.lastIndex < src.length) {
      var start = re.lastIndex;
      m = re.exec(src);
      if (!m) {
        if (/^\s*$/.test(src.slice(start))) break;
        throw new SqlError("Unexpected character near: " + src.slice(start).trim().slice(0, 12));
      }
      if (m[1] != null) out.push({ t: "str", v: m[1].slice(1, -1).replace(/''/g, "'") });
      else if (m[2] != null) out.push({ t: "num", v: parseFloat(m[2]) });
      else if (m[3] != null) out.push({ t: "id", v: m[3].toLowerCase() });
      else if (m[4] != null) out.push({ t: "op", v: m[4] });
    }
    return out;
  }

  function parse(tokens) {
    var i = 0;
    function peek() { return tokens[i]; }
    function isKw(k) { var t = tokens[i]; return t && t.t === "id" && t.v === k; }
    function eat(kind, val) {
      var t = tokens[i];
      if (!t || t.t !== kind || (val !== undefined && t.v !== val)) {
        var want = val !== undefined ? "'" + val + "'" : kind === "id" ? "a name" : kind;
        throw new SqlError("Expected " + want + (t ? " but found '" + t.v + "'" : " but the query ended"));
      }
      i++; return t;
    }
    function kw(k) { if (!isKw(k)) throw new SqlError("Expected " + k.toUpperCase() + (peek() ? " but found '" + peek().v + "'" : " but the query ended")); i++; }

    kw("select");
    var cols = [];
    if (peek() && peek().v === "*") { i++; cols = "*"; }
    else {
      do {
        if (isKw("count")) { i++; eat("op", "("); eat("op", "*"); eat("op", ")"); cols.push({ count: true, name: "count" }); }
        else cols.push({ name: eat("id").v });
      } while (peek() && peek().v === "," && ++i);
    }
    kw("from");
    var table = eat("id").v;
    var where = null, group = null, order = null, limit = null;
    if (isKw("where")) { i++; where = orExpr(); }
    if (isKw("group")) { i++; kw("by"); group = eat("id").v; }
    if (isKw("order")) {
      i++; kw("by"); order = { col: eat("id").v, desc: false };
      if (isKw("desc")) { i++; order.desc = true; } else if (isKw("asc")) i++;
    }
    if (isKw("limit")) { i++; limit = eat("num").v; }
    if (peek() && peek().v === ";") i++;
    if (i < tokens.length) throw new SqlError("Unexpected '" + tokens[i].v + "' at the end of the query");
    return { cols: cols, table: table, where: where, group: group, order: order, limit: limit };

    function orExpr() { var n = andExpr(); while (isKw("or")) { i++; n = { op: "or", a: n, b: andExpr() }; } return n; }
    function andExpr() { var n = unary(); while (isKw("and")) { i++; n = { op: "and", a: n, b: unary() }; } return n; }
    function unary() {
      if (isKw("not")) { i++; return { op: "not", a: unary() }; }
      if (peek() && peek().v === "(") { i++; var e = orExpr(); eat("op", ")"); return e; }
      var col = eat("id").v, op;
      if (isKw("like")) { i++; op = "like"; }
      else if (isKw("is")) {
        i++; var neg = false; if (isKw("not")) { i++; neg = true; } kw("null");
        return { op: neg ? "notnull" : "isnull", col: col };
      }
      else op = eat("op").v;
      if (["=", "!=", "<>", "<", ">", "<=", ">=", "like"].indexOf(op) === -1) throw new SqlError("Unknown operator '" + op + "'");
      var t = peek(), val;
      if (t && (t.t === "str" || t.t === "num")) { i++; val = t.v; }
      else if (isKw("null")) { i++; val = null; }
      else throw new SqlError("Expected a value after " + op.toUpperCase() + ", like 'data' or 2025");
      return { op: op, col: col, val: val };
    }
  }

  function cmp(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;   // nulls last
    if (b == null) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
  }

  function evalExpr(n, row, cols) {
    switch (n.op) {
      case "or": return evalExpr(n.a, row, cols) || evalExpr(n.b, row, cols);
      case "and": return evalExpr(n.a, row, cols) && evalExpr(n.b, row, cols);
      case "not": return !evalExpr(n.a, row, cols);
    }
    if (cols.indexOf(n.col) === -1) throw new SqlError("No column '" + n.col + "'. Try: " + cols.join(", "));
    var v = row[n.col];
    if (n.op === "isnull") return v == null;
    if (n.op === "notnull") return v != null;
    if (v == null || n.val == null) return false;
    if (n.op === "like") {
      var rx = new RegExp("^" + String(n.val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
      return rx.test(String(v));
    }
    var c = (typeof v === "number" && typeof n.val === "string" && !isNaN(+n.val)) ? v - +n.val : cmp(v, n.val);
    switch (n.op) {
      case "=": return c === 0;
      case "!=": case "<>": return c !== 0;
      case "<": return c < 0;
      case ">": return c > 0;
      case "<=": return c <= 0;
      case ">=": return c >= 0;
    }
  }

  function run(src) {
    var t0 = performance.now();
    if (!src.trim()) throw new SqlError("Type a query, for example: select * from projects");
    var q = parse(tokenize(src));
    var data = DB[q.table];
    if (!data) throw new SqlError("No table '" + q.table + "'. Tables: " + Object.keys(DB).filter(function (k) { return k !== "football"; }).join(", "));
    var cols = Object.keys(data[0]);
    var rows = data.filter(function (r) { return !q.where || evalExpr(q.where, r, cols); });
    var outCols, out;

    var hasCount = q.cols !== "*" && q.cols.some(function (c) { return c.count; });
    if (q.cols !== "*") q.cols.forEach(function (c) {
      if (!c.count && cols.indexOf(c.name) === -1) throw new SqlError("No column '" + c.name + "' in " + q.table + ". Try: " + cols.join(", "));
    });

    if (q.group) {
      if (cols.indexOf(q.group) === -1) throw new SqlError("No column '" + q.group + "' to group by");
      var groups = {}, keys = [];
      rows.forEach(function (r) { var k = r[q.group]; if (!(k in groups)) { groups[k] = []; keys.push(k); } groups[k].push(r); });
      outCols = q.cols === "*" ? [q.group, "count"] : q.cols.map(function (c) { return c.name; });
      out = keys.map(function (k) {
        var o = {}; outCols.forEach(function (c) { o[c] = c === "count" ? groups[k].length : groups[k][0][c]; }); return o;
      });
    } else if (hasCount) {
      outCols = q.cols.map(function (c) { return c.name; });
      var o = {}; outCols.forEach(function (c) { o[c] = c === "count" ? rows.length : (rows[0] ? rows[0][c] : null); });
      out = [o];
    } else {
      outCols = q.cols === "*" ? cols : q.cols.map(function (c) { return c.name; });
      out = rows;
    }

    if (q.order) {
      var key = q.order.col;
      var pool = out[0] ? Object.keys(out[0]) : outCols;
      if (pool.indexOf(key) === -1 && cols.indexOf(key) === -1) throw new SqlError("Can't order by '" + key + "'");
      out = out.slice().sort(function (a, b) {
        var r = cmp(a[key], b[key]);
        if (a[key] == null || b[key] == null) return r;  // nulls always last
        return q.order.desc ? -r : r;
      });
    }
    if (q.limit != null) out = out.slice(0, q.limit);

    return {
      table: q.table, columns: outCols,
      rows: out.map(function (r) { var o = {}; outCols.forEach(function (c) { o[c] = r[c]; }); o.__src = r; return o; }),
      ms: performance.now() - t0
    };
  }

  window.ZaidSQL = { run: run, db: DB };
})();
