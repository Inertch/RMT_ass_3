"""Analysis pipeline for the rendering benchmark.
Usage: python analysis/analyze.py results/main/raw_results.csv results/main/analysis
Reads raw_results.csv produced by bench/measure.js; writes tables (CSV) and a boxplot figure.
"""
import sys, os
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

CSV = sys.argv[1] if len(sys.argv) > 1 else "results/main/raw_results.csv"
OUT = sys.argv[2] if len(sys.argv) > 2 else "results/main/analysis"
os.makedirs(OUT, exist_ok=True)

STRATS = ["csr", "ssr", "ssg"]
PAGES = ["dashboard", "gradebook", "quiz", "forum"]
NETS = ["P1_fast", "P2_moderate", "P3_slow"]
DESC_METRICS = ["ttfb", "fcp", "lcp", "dcl", "load", "finish", "requests", "bytes"]
TEST_METRICS = ["finish", "fcp", "lcp", "dcl", "load"]
PAIRS = [("csr", "ssr"), ("csr", "ssg"), ("ssr", "ssg")]   # delta > 0  =>  first strategy is slower
ALPHA, B = 0.05, 5000
rng = np.random.default_rng(20261019)

df = pd.read_csv(CSV)
ok = df[df.status == "ok"].copy()
df[df.status != "ok"].to_csv(f"{OUT}/excluded_runs.csv", index=False)   # failures are reported, not hidden
print(f"loaded {len(df)} rows, {len(ok)} valid, {len(df) - len(ok)} excluded")

def boot_ci_median(x):
    x = np.asarray(x, float)
    idx = rng.integers(0, len(x), (B, len(x)))
    return np.percentile(np.median(x[idx], axis=1), [2.5, 97.5])

def holm(p):
    p = np.asarray(p, float); m = len(p); order = np.argsort(p); adj = np.empty(m); run = 0.0
    for rank, i in enumerate(order):
        run = max(run, (m - rank) * p[i]); adj[i] = min(1.0, run)
    return adj

def cliffs_delta(x, y):
    u = stats.mannwhitneyu(x, y, alternative="two-sided").statistic
    return 2 * u / (len(x) * len(y)) - 1

def grp(strat, page, net, metric):
    s = ok[(ok.strategy == strat) & (ok.page == page) & (ok.network == net)][metric].dropna()
    return s.to_numpy(float)

# ---- Objective 2: descriptive statistics --------------------------------------------------
rows = []
for s in STRATS:
    for p in PAGES:
        for n in NETS:
            for m in DESC_METRICS:
                x = grp(s, p, n, m)
                if len(x) < 2: continue
                lo, hi = boot_ci_median(x)
                rows.append(dict(strategy=s, page=p, network=n, metric=m, n=len(x), median=np.median(x),
                                 q1=np.percentile(x, 25), q3=np.percentile(x, 75), mean=x.mean(), sd=x.std(ddof=1),
                                 median_ci_low=lo, median_ci_high=hi))
desc = pd.DataFrame(rows); desc.to_csv(f"{OUT}/descriptives.csv", index=False)

# ---- Objective 2: inferential tests (Kruskal-Wallis + pairwise Mann-Whitney, Holm, Cliff's delta)
trows = []
for m in TEST_METRICS:
    for p in PAGES:
        for n in NETS:
            data = [grp(s, p, n, m) for s in STRATS]
            if any(len(d) < 2 for d in data): continue
            try: kw = stats.kruskal(*data).pvalue
            except ValueError: kw = np.nan
            for a, b in PAIRS:
                x, y = grp(a, p, n, m), grp(b, p, n, m)
                try: pv = stats.mannwhitneyu(x, y, alternative="two-sided").pvalue
                except ValueError: pv = np.nan
                trows.append(dict(metric=m, page=p, network=n, a=a, b=b, median_a=np.median(x), median_b=np.median(y),
                                  p=pv, cliffs_delta=cliffs_delta(x, y), kruskal_p=kw))
tests = pd.DataFrame(trows)
tests["p_holm"] = np.nan
for m in TEST_METRICS:                                   # Holm correction within each metric family
    idx = tests.index[(tests.metric == m) & tests.p.notna()]
    tests.loc[idx, "p_holm"] = holm(tests.loc[idx, "p"])
tests.to_csv(f"{OUT}/pairwise_tests.csv", index=False)

def faster(a, b, p, n, metric="finish", min_delta=0.33):
    """True if strategy a is significantly and meaningfully faster than b (Holm p < alpha, |delta| >= 0.33)."""
    t = tests[(tests.metric == metric) & (tests.page == p) & (tests.network == n)]
    r = t[(t.a == a) & (t.b == b)]
    if len(r): d = -r.iloc[0].cliffs_delta; ph = r.iloc[0].p_holm
    else:
        r = t[(t.a == b) & (t.b == a)]
        if not len(r): return False
        d = r.iloc[0].cliffs_delta; ph = r.iloc[0].p_holm
    return bool(ph < ALPHA and d >= min_delta)

# ---- H1: SSG has the lowest finish time on every page type ---------------------------------
h1 = []
for p in PAGES:
    for n in NETS:
        med = {s: np.median(grp(s, p, n, "finish")) for s in STRATS if len(grp(s, p, n, "finish"))}
        if len(med) < 3: continue
        h1.append(dict(page=p, network=n, lowest_median=min(med, key=med.get),
                       ssg_sig_faster_than_csr=faster("ssg", "csr", p, n), ssg_sig_faster_than_ssr=faster("ssg", "ssr", p, n)))
pd.DataFrame(h1).to_csv(f"{OUT}/h1_ssg_lowest_finish.csv", index=False)

# ---- H3: SSR has lower first contentful paint than CSR (one-sided, Holm over all page x network)
h3 = []
for p in PAGES:
    for n in NETS:
        csr, ssr = grp("csr", p, n, "fcp"), grp("ssr", p, n, "fcp")
        if len(csr) < 2 or len(ssr) < 2: continue
        h3.append(dict(page=p, network=n, median_csr=np.median(csr), median_ssr=np.median(ssr),
                       p=stats.mannwhitneyu(csr, ssr, alternative="greater").pvalue))
h3 = pd.DataFrame(h3)
if len(h3): h3["p_holm"] = holm(h3.p); h3["supported"] = h3.p_holm < ALPHA
h3.to_csv(f"{OUT}/h3_ssr_fcp_vs_csr.csv", index=False)

# ---- Objective 3 / H2: bandwidth sensitivity = median finish(P3) / median finish(P1) ---------
def boot_ratio(x3, x1):
    i3 = rng.integers(0, len(x3), (B, len(x3))); i1 = rng.integers(0, len(x1), (B, len(x1)))
    return np.median(x3[i3], axis=1) / np.median(x1[i1], axis=1)
rr, boots = [], {}
for p in PAGES:
    for s in STRATS:
        x1, x3 = grp(s, p, "P1_fast", "finish"), grp(s, p, "P3_slow", "finish")
        if len(x1) < 2 or len(x3) < 2: continue
        b = boot_ratio(x3, x1); boots[(s, p)] = b
        rr.append(dict(page=p, strategy=s, ratio=np.median(x3) / np.median(x1),
                       ci_low=np.percentile(b, 2.5), ci_high=np.percentile(b, 97.5)))
    for o in ["ssr", "ssg"]:
        if ("csr", p) in boots and (o, p) in boots:
            d = boots[("csr", p)] - boots[(o, p)]
            rr.append(dict(page=p, strategy=f"csr_minus_{o}", ratio=np.median(d),
                           ci_low=np.percentile(d, 2.5), ci_high=np.percentile(d, 97.5)))
pd.DataFrame(rr).to_csv(f"{OUT}/h2_bandwidth_ratio.csv", index=False)

# ---- Objective 4: ranking and recommendation per page type -----------------------------------
rk = []
for p in PAGES:
    for n in NETS:
        med = {s: np.median(grp(s, p, n, "finish")) for s in STRATS if len(grp(s, p, n, "finish"))}
        if len(med) < 3: continue
        best = min(med, key=med.get)
        others = [s for s in STRATS if s != best]
        clear = all(faster(best, o, p, n) for o in others)
        rk.append(dict(page=p, network=n, best_by_median=best, clear_winner=clear,
                       recommendation=best if clear else "no clear practical difference"))
pd.DataFrame(rk).to_csv(f"{OUT}/ranking.csv", index=False)

# ---- Figure: finish-time boxplots ---------------------------------------------------------------
fig, axes = plt.subplots(len(PAGES), len(NETS), figsize=(11, 11), sharex=True)
for i, p in enumerate(PAGES):
    for j, n in enumerate(NETS):
        ax = axes[i][j]
        ax.boxplot([grp(s, p, n, "finish") for s in STRATS])
        ax.set_xticks([1, 2, 3]); ax.set_xticklabels([s.upper() for s in STRATS])
        ax.set_title(f"{p} / {n}", fontsize=9)
        if j == 0: ax.set_ylabel("finish time (ms)")
fig.suptitle("Finish time by rendering strategy, page type and network profile")
fig.tight_layout(); fig.savefig(f"{OUT}/finish_time_boxplots.png", dpi=150)
print("analysis complete ->", OUT)
