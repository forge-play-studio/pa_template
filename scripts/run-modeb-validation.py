#!/usr/bin/env python3
"""Mode B 语义回放端到端验证 runner(无 MCP,Playwright 直驱系统 Chrome)。

序列:加载 tape → reconstructTrail(精简循环) → extractSemantic(逐帧轨迹) →
semanticReplay(slack=15,实时可视) → verdict;ok 则再跑一遍验稳定。
产物:.verify-artifacts/ 下 script v2 + verdicts + 日志(stdout)。

模板默认只提供通用 SimplePlayer/provider 口径；真实项目可复制本脚本并替换
TAPE_FS_PATH、BASE_URL 和业务 probe，但不应在通用 runner 中写固定 scene node id。
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

WORKTREE = Path(__file__).resolve().parent.parent
TAPE_FS_PATH = WORKTREE / ".verify-artifacts" / "baseline-v1.tape.json"
OUT_DIR = WORKTREE / ".verify-artifacts"
BASE_URL = "http://localhost:3011"
SEED = 42


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def wait_ready(page, timeout_s=60):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        ok = page.evaluate(
            "() => !!(window.game && window.__rr && typeof window.__rr.reconstructTrail === 'function' && window.game.getFrameCount() === 0)"
        )
        if ok:
            return
        time.sleep(0.5)
    raise TimeoutError("game/__rr not ready at frame 0")


def poll_window_var(page, var: str, timeout_s: float, progress_expr: str | None = None, label: str = ""):
    deadline = time.time() + timeout_s
    last_progress = None
    while time.time() < deadline:
        done = page.evaluate(f"() => window.{var} ?? null")
        if done is not None:
            return done
        if progress_expr:
            progress = page.evaluate(progress_expr)
            if progress != last_progress:
                log(f"  {label} progress: {progress}")
                last_progress = progress
        time.sleep(3)
    raise TimeoutError(f"{var} not set within {timeout_s}s")


def main() -> int:
    tape_json = TAPE_FS_PATH.read_text()
    log(f"tape loaded from disk: {len(tape_json)} bytes")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=False)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE_URL}/?seed={SEED}&rrAutoReplay=1")
        wait_ready(page)
        log("step1 ✓ page ready at frame 0 (rrAutoReplay)")

        # step2: 注入 tape(分块避免单条 CDP 消息过大)
        page.evaluate("() => { window.__tapeChunks = []; }")
        chunk_size = 2_000_000
        for i in range(0, len(tape_json), chunk_size):
            page.evaluate("(chunk) => { window.__tapeChunks.push(chunk); }", tape_json[i : i + chunk_size])
        frames = page.evaluate(
            "() => { let t = JSON.parse(window.__tapeChunks.join('')); if (typeof t === 'string') t = JSON.parse(t);"
            " window.__tape = t; window.__tapeChunks = null; return window.__tape.frames.length; }"
        )
        log(f"step2 ✓ tape injected: {frames} frames")

        # step3: reconstructTrail(精简循环)
        page.evaluate(
            "() => { window.__trDone = null; window.__rr.reconstructTrail(window.__tape, { restart: false })"
            ".then((r) => { window.__trDone = { ok: r.ok, frames: r.frames, missing: r.missingPositions }; })"
            ".catch((e) => { window.__trDone = { error: String(e).slice(0, 400) }; }); }"
        )
        tr = poll_window_var(
            page, "__trDone", 600,
            "() => (window.__rr.getState().replayFrame ?? 'pending')", "reconstructTrail",
        )
        log(f"step3 result: {tr}")
        if not tr.get("ok"):
            log("FATAL: reconstructTrail failed")
            return 1

        # step4: extractSemantic(lastRecording 已带 trail)
        summary = page.evaluate(
            "() => { const ex = window.__rr.extractSemantic(); const script = ex.script ?? ex;"
            " window.__scriptV2 = script;"
            " return { waypoints: script.waypoints.length, inputSegments: script.inputSegments.length,"
            " milestones: script.milestones.length, durationSec: script.meta.durationSec }; }"
        )
        log(f"step4 ✓ extracted: {summary}")
        script_json = page.evaluate("() => JSON.stringify(window.__scriptV2)")
        (OUT_DIR / "baseline-v2-densetrail.semantic.json").write_text(script_json)
        log(f"  script saved ({len(script_json)} bytes)")

        # step5/6: semanticReplay ×2
        verdicts = []
        for run in (1, 2):
            log(f"step5 run{run}: semanticReplay starting (实时导航复演,可观看)…")
            page.evaluate(
                "() => { window.__svDone = null;"
                " window.__rr.semanticReplay(window.__scriptV2, { restart: true, skipFailedStage: false, milestoneSlackSec: 15 })"
                ".then((v) => { window.__svDone = v; })"
                ".catch((e) => { window.__svDone = { error: String(e).slice(0, 400) }; }); }"
            )
            probe_expr = (
                "() => { const s = window.__rr.getState();"
                " const inp = window.game?.getInputService?.()?.getInput?.() ?? null;"
                " const pos = window.game?.getPlayer?.()?.position ?? null;"
                " return `st=${s.status} in=${inp ? [inp.x.toFixed(2), inp.y.toFixed(2), inp.magnitude.toFixed(2), inp.isActive] : 'n/a'}"
                " pos=${pos ? [pos.x.toFixed(1), pos.z.toFixed(1)] : 'n/a'}`; }"
            )
            verdict = poll_window_var(
                page, "__svDone", 900,
                probe_expr,
                f"semanticReplay run{run}",
            )
            verdicts.append(verdict)
            (OUT_DIR / f"modeb-verdict-run{run}.json").write_text(json.dumps(verdict, ensure_ascii=False, indent=2))
            if "error" in verdict:
                log(f"run{run} ERROR: {verdict['error']}")
                break
            log(
                f"run{run} verdict: ok={verdict.get('ok')} quality={verdict.get('quality')} "
                f"milestones={verdict.get('milestones', {}).get('matched')}/{summary['milestones']} "
                f"waypoints={verdict.get('waypoints', {}).get('reached')}/{summary['waypoints']} "
                f"duration={verdict.get('durationSec')}s"
            )
            if not verdict.get("ok"):
                ff = verdict.get("stages") or verdict.get("milestones", {}).get("missing")
                log(f"  详情: stages={json.dumps(verdict.get('stages'), ensure_ascii=False)[:400]}")
                log(f"  stuck={json.dumps(verdict.get('stuckEvents'), ensure_ascii=False)[:400]}")
                break

        page.screenshot(path=str(OUT_DIR / "modeb-final-frame.png"))
        browser.close()

        all_ok = len(verdicts) == 2 and all(v.get("ok") for v in verdicts)
        log(f"=== FINAL: {'PASS(双跑全绿)' if all_ok else 'NOT PASSING'} ===")
        return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())
