# Ticket 275 experiments: build a variant of index.html, serve it, audit 4 pages
# on mobile (3 runs each, one Lighthouse at a time), restore index.html.
# Usage: bash exp.sh <variant>   (v0 | v1 | v2)
set -u
V=$1
S=/tmp/claude-1000/-home-mquesada-Documents-Projects-personal-portdle/fa4dc0ea-23fd-4430-aca4-7f66c5c816fc/scratchpad
W=/home/mquesada/orca/workspaces/portdle/t254-spec7-map
cd $W
U=$(gh api repos/mquesada02/portdle/actions/variables/SUPABASE_URL --jq .value)
K=$(gh api repos/mquesada02/portdle/actions/variables/SUPABASE_ANON_KEY --jq .value)
cp index.html $S/index.html.orig
PRE="<link rel=\"preconnect\" href=\"$U\" crossorigin />"
SHELL='<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e4e4e7;font-family:system-ui,sans-serif"><strong style="font-size:20px">Portdle</strong></header><main style="max-width:28rem;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif"><p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#71717a">Daily</p><h1 style="font-size:30px;font-weight:700">Which port is it?</h1><p style="color:#52525b">Guess the port number of the day in six tries. After each try, green means right digit in the right place.</p></main>'
case $V in
v0) ;;
v1) sed -i "s|</head>|    $PRE\n  </head>|" index.html ;;
v2|v3) sed -i "s|</head>|    $PRE\n  </head>|" index.html
    sed -i "s|<div id=\"root\"></div>|<div id=\"root\">$SHELL</div>|" index.html ;;
esac
VITE_SUPABASE_URL=$U VITE_SUPABASE_ANON_KEY=$K pnpm build >/dev/null 2>&1
if [ "$V" = v3 ]; then JS=$(grep -o "/portdle/assets/index-[^\"]*\.js" dist/index.html); sed -i "s|<script type=\"module\" crossorigin src=\"$JS\"></script>|<script>addEventListener(\"load\",function(){var s=document.createElement(\"script\");s.type=\"module\";s.src=\"$JS\";document.head.appendChild(s)})</script>|" dist/index.html; grep -c "addEventListener(\"load\"" dist/index.html; fi
cp $S/index.html.orig index.html
git diff --quiet index.html && echo "index.html restored"
pnpm exec vite preview --port 4317 --strictPort >/dev/null 2>&1 &
P=$!
curl -s -o /dev/null --retry 20 --retry-connrefused --retry-delay 1 http://localhost:4317/portdle/
for page in daily-mixed archive board history; do
  LH_ORIGIN=http://localhost:4317 LH_FF=mobile node $S/lhtool/run.mjs $S/lh275/$V 3 $page
done
kill $P
node $S/lhtool/summary.mjs $S/lh275/$V > $S/lh275-$V.md
