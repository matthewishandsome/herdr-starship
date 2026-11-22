// glass: a clone of Herdr's `pane` mod 0.1.16 (Apache-2.0, see NOTICE), changed for Herdr Starship:
// the header's content sits 16px from the pane's rounded edge instead of 10px.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "herdr-starship-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, layout, readTextFile, watchFolder, checking } from "herdr";

// usage: Claude Code's statusLine (~/.claude/statusline-herdr.sh) writes one file per
// terminal with the model and the plan's 5-hour window; the header shows them.
const USAGE_DIR = () => `${home()}/.local/state/herdr-usage`;
const PROVIDERS = { claude: "Anthropic", "claude-code": "Anthropic" };

function left(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m >= 1440) return `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
  return `${m}m`;
}

function resetMs(v) {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") { const n = Date.parse(v); return Number.isNaN(n) ? null : n; }
  return null;
}

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init(_props, cx) {
    this.hovered = false;
    this.usage = null;
    if (checking()) return;
    this.loadUsage(cx);
    // The countdown moves once a minute; the file is re-read then too, in case a watch is missed.
    cx.timer.every(60000, (cx) => this.loadUsage(cx));
    cx.spawn(async (cx) => {
      try {
        for (;;) { await watchFolder(USAGE_DIR()); this.loadUsage(cx); }
      } catch {}
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  loadUsage(cx) {
    const terminal = props()?.terminal ?? this.me()?.terminal;
    if (!terminal || terminal.includes("/")) return;
    cx.spawn(async (cx) => {
      const read = async (name) => {
        try { return JSON.parse((await readTextFile(`${USAGE_DIR()}/${name}.json`)) ?? "null"); } catch { return null; }
      };
      const usage = await read(terminal);
      // usage: the limits are per account, so take the newest report from any pane.
      const account = usage ? await read("account") : null;
      if (usage && account && (account.at ?? 0) > (usage.at ?? 0)) {
        usage.five_hour = account.five_hour;
        usage.seven_day = account.seven_day;
      }
      this.usage = usage;
      cx.notify();
    });
  }

  usageChips(t, p) {
    const u = this.usage;
    const key = p.program?.key, provider = PROVIDERS[key] ?? PROVIDERS[p.app ?? ""];
    if (!u || !provider) return [];
    const now = Date.now();
    // One window: its label, a bar of what's left, the percent left, the time to its reset.
    const meter = (label, w) => {
      if (!w || typeof w.used_percentage !== "number") return null;
      const at = resetMs(w.resets_at);
      const reset = Boolean(at && at <= now);
      const rest = reset ? 100 : Math.max(0, Math.min(100, Math.round(100 - w.used_percentage)));
      const color = rest <= 10 ? t.blocked : rest <= 30 ? t.ansi3 : t.foreground;
      return h_flex().flex_none().gap(6).items_center()
        .child(div().text_color(t.dim).child(label))
        .child(div().w(36).h(4).rounded(2).bg(t.border)
          .child(div().h(4).rounded(2).w(Math.max(2, Math.round(36 * rest / 100))).bg(color)))
        .child(div().text_color(color).font_medium().child(`${rest}%`))
        .when(Boolean(at) && !reset, el => el.child(div().text_color(t.dim).child(left(at - now))));
    };
    const rule = () => div().flex_none().w(1).h(12).bg(t.border);
    const parts = [
      u.model ? div().flex_none().text_color(t.muted).child(u.model) : null,
      meter("5h", u.five_hour),
      meter("7d", u.seven_day),
    ].filter(Boolean);
    return parts.flatMap((el, i) => i ? [rule(), el] : [el]);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/herdr-starship-pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      // glass: 16px in, like the sidebar's labels and the terminal's text below it.
      .px(16)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .children(this.usageChips(t, p))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
