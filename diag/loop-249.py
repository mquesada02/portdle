#!/usr/bin/env python3
# usage: loop.py N GREP PROJECT [KEY=VAL ...]  ; prints per-run failures (project, frame, pixels)
import subprocess, sys, re, json, os
N=int(sys.argv[1]); G=sys.argv[2]; P=sys.argv[3]; env=sys.argv[4:]
tot={}
for i in range(1,N+1):
    cmd=["docker","exec","-e","PATH=/work/node_modules/.bin:/usr/local/bin:/usr/bin:/bin"]
    for e in env: cmd+=["-e",e]
    cmd+=["diag249","sh","-c",f"cd /work && playwright test -c playwright.gate.config.ts --update-snapshots=none --reporter=line --project '{P}' -g '{G}' 2>&1"]
    out=subprocess.run(cmd,capture_output=True,text=True).stdout
    fails=[]
    for blk in re.split(r"\n\s+\d+\) ",out)[1:]:
        proj=re.match(r"\[([^\]]+)\]",blk).group(1)
        snap=re.search(r"Snapshot: (\S+)",blk)
        px=re.search(r"(\d+) pixels",blk)
        if not snap: fails.append((proj,"ERR:"+blk[:120].replace("\n"," "),0)); continue
        fails.append((proj,snap.group(1).replace(".png",""),int(px.group(1)) if px else -1))
    if fails:
        import shutil; dst=f'/tmp/claude-1000/fails/{os.environ.get("TAG","x")}-{i}'; shutil.copytree('/home/mquesada/orca/workspaces/portdle/diag-249/test-results',dst,dirs_exist_ok=True)
    m=re.search(r"(\d+) passed",out)
    print(f"run {i}: passed={m.group(1) if m else '?'} fails={len(fails)}",flush=True)
    for f in fails:
        print("   ",f, flush=True); tot[f[1]]=tot.get(f[1],0)+1
print("TOTAL runs",N,"by frame:",tot)
