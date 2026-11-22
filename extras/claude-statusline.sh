#!/bin/sh
# Claude Code statusLine: hands this session's model and plan usage to Herdr.
# Writes ~/.local/state/herdr-usage/<terminal>.json for the herdr-starship-pane header.
# Prints nothing, so Claude Code's own screen is unchanged.
input=$(cat)
[ -n "$HC_TERMINAL_ID" ] || exit 0
dir="$HOME/.local/state/herdr-usage"
mkdir -p "$dir" || exit 0
tmp="$dir/.$HC_TERMINAL_ID.$$"
printf '%s' "$input" | jq -c --arg t "$HC_TERMINAL_ID" '{
  terminal: $t,
  at: (now | floor),
  model: (.model.display_name // null),
  five_hour: (.rate_limits.five_hour // null),
  seven_day: (.rate_limits.seven_day // null)
}' > "$tmp" 2>/dev/null || { rm -f "$tmp"; exit 0; }
# The limits are per account: the newest report also goes to account.json, so every
# pane shows the same, freshest numbers.
if [ "$(jq -r '.five_hour != null or .seven_day != null' "$tmp")" = true ]; then
  cp -f "$tmp" "$dir/.account.$$" && mv -f "$dir/.account.$$" "$dir/account.json"
fi
mv -f "$tmp" "$dir/$HC_TERMINAL_ID.json"
exit 0
