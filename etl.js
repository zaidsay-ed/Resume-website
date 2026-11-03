/* Live demo: a browser re-creation of my job market ETL pipeline.
   Sample postings are made up for the demo; the cleaning rules mirror the real project. */
(function () {
  "use strict";
  var root = document.getElementById("etl");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // [title, company, location, salary, description]
  var RAW = [
    ["Data Engineer Intern", "Northwind Analytics", "vancouver, bc", "$85k - $95k", "Build pipelines in Python and SQL on AWS; Airflow a plus"],
    ["data engineer intern", "Northwind Analytics", "Vancouver BC", "85,000-95,000", "Build pipelines in Python and SQL on AWS; Airflow a plus"],
    ["Software Engineer Intern", "Lumen Labs", "Toronto, ON", "$42/hr", "Java, Spring, Docker and some React"],
    ["ML Engineer Intern", "Kestrel AI", "Remote - Canada", "110000", "Python, PyTorch, SQL, model deployment on AWS"],
    ["Data Analyst Co-op", "Harbour Bank", "Vancouver", "", "SQL, Tableau and Excel reporting"],
    ["Backend Developer Intern", "Fjord Systems", "seattle, wa", "$48 / hour", "Go or Java, Kafka, Kubernetes, Docker"],
    ["Data Engineer", "Granite Health", "Calgary AB", "95k-120k CAD", "Spark, Airflow, dbt, Snowflake and Python"],
    ["Analytics Engineer Intern", "Polar Retail", "Toronto", "$70,000", "dbt, SQL, Snowflake, Looker"],
    ["Software Developer Co-op", "Maple Cloud", "Montreal, QC", "35/hr", "TypeScript, React, Node, PostgreSQL"],
    ["Data Scientist Intern", "Orbit Insurance", "remote", "$90K", "Python, pandas, scikit-learn, SQL, A/B testing"],
    ["", "Ghost Corp", "Vancouver", "$60k", "Python"],
    ["Data Engineering Intern", "Cascade Energy", "Vancouver, B.C.", "$38-$44/hr", "Python, SQL, Spark, AWS Glue and Lambda"],
    ["ML Engineer Intern", "Kestrel AI", "Remote - Canada", "110000", "Python, PyTorch, SQL, model deployment on AWS"],
    ["Platform Engineer Intern", "Tidewater", "Seattle", "$52/hr", "Kubernetes, Terraform, Go, AWS"],
    ["Data Analyst", "Sable Media", "toronto, on", "60000-70000", "SQL, Power BI, Excel, Python"],
    ["Software Engineer Intern", "Quill", "Vancouver", "$45/hr", "Python, Django, PostgreSQL, Docker"],
    ["Data Engineer Co-op", "Aurora Freight", "Remote (Canada)", "$40/hr", "Kafka, Spark, Python, SQL, Airflow"],
    ["BI Developer", "Westshore Foods", "Calgary", "$80k", "SQL, Power BI, dbt"],
    ["Machine Learning Intern", "Nimbus Robotics", "Montreal", "$41/hr", "Python, TensorFlow, Docker"],
    ["Data Engineer Intern", "Pinecrest Pay", "Toronto ON", "$43/hr", "Python, SQL, Snowflake, Airflow, AWS"],
    ["Full Stack Intern", "Bramble", "vancouver", "$36/hr", "React, TypeScript, Node, AWS"],
    ["Data Platform Intern", "Coastline Telecom", "Vancouver, BC", "$46/hr", "Spark, Kafka, Python, Kubernetes"],
    ["Data Scientist Intern", "Orbit Insurance", "remote", "$90K", "Python, pandas, scikit-learn, SQL, A/B testing"],
    ["Software Engineer Intern", "Lumen Labs", "Toronto, ON", "", "Java, Spring, Docker and some React"],
    ["Data Engineer Intern", "Summit Logistics", "Seattle, WA", "$50/hr", "Python, SQL, dbt, Snowflake, Airflow"],
    ["Analytics Intern", "Ridgeway Sports", "Vancouver BC", "$32/hr", "SQL, Tableau, Python, pandas"],
    ["Cloud Data Engineer", "Halcyon", "remote - canada", "$115k", "AWS Lambda, Glue, Python, SQL, Terraform"],
    ["Data Engineer Intern", "Larch Insights", "", "$40/hr", "Python, SQL, Airflow"]
  ];

  var SKILLS = ["python", "sql", "aws", "airflow", "spark", "dbt", "snowflake", "kafka", "docker", "kubernetes", "react", "typescript", "java", "pandas", "tableau", "power bi", "terraform", "lambda", "scikit-learn", "pytorch", "tensorflow", "go"];
  var CITY = [[/vancouver/i, "Vancouver"], [/toronto/i, "Toronto"], [/montreal/i, "Montreal"], [/calgary/i, "Calgary"], [/seattle/i, "Seattle"], [/remote/i, "Remote"]];

  function normSalary(s) {
    if (!s) return null;
    var hourly = /hr|hour/i.test(s);
    var nums = (s.replace(/,/g, "").match(/\d+(\.\d+)?k?/gi) || []).map(function (n) {
      var v = parseFloat(n); if (/k$/i.test(n)) v *= 1000; return v;
    });
    if (!nums.length) return null;
    var mid = nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
    if (hourly) mid *= 2080;
    return Math.round(mid / 1000) * 1000;
  }
  function normCity(s) { for (var i = 0; i < CITY.length; i++) if (CITY[i][0].test(s)) return CITY[i][1]; return null; }
  function skillsOf(d) {
    var low = d.toLowerCase();
    return SKILLS.filter(function (k) { return new RegExp("(^|[^a-z])" + k.replace(/ /g, "\\s") + "([^a-z]|$)").test(low); });
  }
  function titleCase(s) { return s.replace(/\w\S*/g, function (w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); }).replace(/\bMl\b/, "ML").replace(/\bBi\b/, "BI"); }

  var $ = function (s) { return root.querySelector(s); };
  var logEl = $("#etlLog"), tableEl = $("#etlTable"), runBtn = $("#etlRun"), steps = root.querySelectorAll(".etl-step");
  var skillsEl = $("#etlSkills"), payEl = $("#etlPay"), viewBtns = root.querySelectorAll(".etl-view");
  var state = { clean: null, view: "raw", running: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cell(v, cls) { return v === "" || v == null ? '<td class="etl-miss">missing</td>' : '<td' + (cls ? ' class="' + cls + '"' : "") + ">" + esc(v) + "</td>"; }

  function renderTable() {
    var html;
    if (state.view === "raw" || !state.clean) {
      html = "<thead><tr><th>title</th><th>company</th><th>location</th><th>salary</th></tr></thead><tbody>" +
        RAW.slice(0, 9).map(function (r) { return "<tr>" + cell(r[0]) + cell(r[1]) + cell(r[2]) + cell(r[3]) + "</tr>"; }).join("") + "</tbody>";
    } else {
      html = "<thead><tr><th>title</th><th>city</th><th>salary_cad</th><th>skills</th></tr></thead><tbody>" +
        state.clean.slice(0, 9).map(function (r) {
          return "<tr>" + cell(r.title) + cell(r.city, "ok") + (r.salary == null ? '<td class="etl-miss">null</td>' : '<td class="ok">' + r.salary.toLocaleString("en-CA") + "</td>") + '<td class="etl-skills">' + esc(r.skills.join(", ")) + "</td></tr>";
        }).join("") + "</tbody>";
    }
    tableEl.innerHTML = html;
    viewBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === state.view)); b.disabled = b.dataset.view === "clean" && !state.clean; });
  }
  viewBtns.forEach(function (b) { b.addEventListener("click", function () { state.view = b.dataset.view; renderTable(); }); });

  function log(msg, cls) {
    var p = document.createElement("p");
    var t = new Date();
    p.innerHTML = '<span class="t">' + String(t.getMinutes()).padStart(2, "0") + ":" + String(t.getSeconds()).padStart(2, "0") + "." + String(t.getMilliseconds()).padStart(3, "0").slice(0, 2) + "</span> " + msg;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function setStep(i, count) {
    steps.forEach(function (s, k) {
      s.classList.toggle("on", k === i);
      s.classList.toggle("done", k < i || i === 4);
    });
    if (count != null) steps[Math.min(i, 3)].querySelector(".n").textContent = count;
  }

  function bars(el, data, fmt) {
    var max = Math.max.apply(null, data.map(function (d) { return d[1]; }));
    el.innerHTML = data.map(function (d) {
      return '<div class="bar"><span class="bl">' + esc(d[0]) + '</span><span class="bt"><i style="--w:' + (d[1] / max * 100).toFixed(1) + '%"></i></span><span class="bv">' + fmt(d[1]) + "</span></div>";
    }).join("");
    requestAnimationFrame(function () { el.classList.add("grow"); });
  }

  function run() {
    if (state.running) return;
    state.running = true; runBtn.disabled = true; runBtn.textContent = "Running…";
    logEl.innerHTML = ""; skillsEl.innerHTML = ""; payEl.innerHTML = ""; skillsEl.classList.remove("grow"); payEl.classList.remove("grow");
    steps.forEach(function (s) { s.classList.remove("on", "done"); s.querySelector(".n").textContent = "–"; });
    state.clean = null; state.view = "raw"; renderTable();

    var t0 = performance.now();
    var seen = {}, dupes = 0, dropped = 0, kept = [];
    RAW.forEach(function (r) {
      if (!r[0] || !r[1]) { dropped++; return; }
      var key = (r[0] + "|" + r[1] + "|" + (normCity(r[2]) || "")).toLowerCase();
      if (seen[key]) { dupes++; return; }
      seen[key] = 1; kept.push(r);
    });
    var clean = kept.map(function (r) { return { title: titleCase(r[0]), company: r[1], city: normCity(r[2]), salary: normSalary(r[3]), skills: skillsOf(r[4]) }; });
    var noCity = clean.filter(function (r) { return !r.city; }).length;
    var noPay = clean.filter(function (r) { return r.salary == null; }).length;
    var counts = {};
    clean.forEach(function (r) { r.skills.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); });
    var top = Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 7);
    var byCity = {};
    clean.forEach(function (r) { if (r.city && r.salary) (byCity[r.city] = byCity[r.city] || []).push(r.salary); });
    var pay = Object.keys(byCity).map(function (c) {
      var v = byCity[c].sort(function (a, b) { return a - b; }), m = v.length >> 1;
      return [c, v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2];
    }).sort(function (a, b) { return b[1] - a[1]; });
    var ms = (performance.now() - t0).toFixed(2);

    var d = reduce ? 0 : 1;
    var seq = [
      [0, function () { setStep(0, RAW.length); log("extract: read <b>" + RAW.length + "</b> raw postings"); }],
      [650, function () { setStep(1, kept.length); log("validate: dropped <b>" + dupes + "</b> duplicates, <b>" + dropped + "</b> " + (dropped === 1 ? "row" : "rows") + " missing a title", "warn"); }],
      [650, function () { log("transform: normalised " + (clean.length - noPay) + " salaries to annual CAD (hourly × 2080)"); }],
      [450, function () { setStep(2, clean.length); log("transform: standardised " + (clean.length - noCity) + " locations, extracted skills from free text"); state.clean = clean; state.view = "clean"; renderTable(); }],
      [650, function () { setStep(3, clean.length); log("load: wrote <b>" + clean.length + "</b> rows to <code>jobs</code>, " + noPay + " with null salary"); }],
      [450, function () { setStep(4); log("done in " + ms + " ms of compute. Charts below are SQL over <code>jobs</code>.", "ok"); bars(skillsEl, top, function (v) { return v; }); bars(payEl, pay, function (v) { return "$" + Math.round(v / 1000) + "k"; }); }]
    ];
    var acc = 0;
    seq.forEach(function (s) { acc += s[0] * d; setTimeout(s[1], acc); });
    setTimeout(function () { state.running = false; runBtn.disabled = false; runBtn.textContent = "Run again"; }, acc + 50);
  }

  runBtn.addEventListener("click", run);
  renderTable();
  log("ready: " + RAW.length + " raw postings waiting. Press Run pipeline.", "dim");
})();
