#!/usr/bin/env python3
# DIAG #249 round 2, branch diag/249 only.
# usage: loop2-249.py N TAG [KEY=VAL ...]
# Runs the nav test in the 4 non-reduced WebKit projects N times in the pinned
# container. Prints failing frames per run. Failing runs copy test-results to
# OUT/TAG-i (OUT defaults to /tmp/claude-1000/fails2).
import subprocess, sys, re, os, shutil
N=int(sys.argv[1]); TAG=sys.argv[2]; env=sys.argv[3:]
GREP=os.environ.get("GREP","Nav changes screen")
PROJECTS=["webkit-375-light","webkit-375-dark","webkit-1024-light","webkit-1024-dark"]
OUT=os.environ.get("OUT","/tmp/claude-1000/fails2")
W="/home/mquesada/orca/workspaces/portdle/diag-249"
tot={}; runs_failed=0
# A variant changes the frames, so each variant first captures its own baseline
# with the burners stopped.
def docker_cmd(update,logtag):
    cmd=["docker","exec","-e","PATH=/work/node_modules/.bin:/usr/local/bin:/usr/bin:/bin","-e","DIAG_HIDE_NAV=0","-e","DIAG_LOG=1","-e",f"DIAG_TAG={logtag}"]
    for e in env: cmd+=["-e",e]
    pj=" ".join(f"--project {p}" for p in PROJECTS)
    cmd+=["diag249","sh","-c",f"cd /work && playwright test -c playwright.gate.config.ts --update-snapshots={update} --reporter=line {pj} -g '{GREP}' 2>&1"]
    return cmd
BURN="while :; do :; done"
subprocess.run(["pkill","-STOP","-f",BURN])
subprocess.run(docker_cmd("all",f"{TAG}-base"),capture_output=True,text=True)
subprocess.run(["pkill","-CONT","-f",BURN])
print("baseline captured",flush=True)
for i in range(1,N+1):
    cmd=docker_cmd("none",f"{TAG}-{i}")
    out=subprocess.run(cmd,capture_output=True,text=True).stdout
    fails=[]
    for blk in re.split(r"\n\s+\d+\) ",out)[1:]:
        proj=re.match(r"\[([^\]]+)\]",blk).group(1)
        snap=re.search(r"Snapshot: (\S+)",blk)
        px=re.search(r"(\d+) pixels",blk)
        if not snap: fails.append((proj,"ERR:"+blk[:120].replace("\n"," "),0)); continue
        fails.append((proj,snap.group(1).replace(".png",""),int(px.group(1)) if px else -1))
    if fails:
        runs_failed+=1
        shutil.copytree(f"{W}/test-results",f"{OUT}/{TAG}-{i}",dirs_exist_ok=True)
    m=re.search(r"(\d+) passed",out)
    print(f"run {i}: passed={m.group(1) if m else '?'} fails={len(fails)}",flush=True)
    for f in fails:
        print("   ",f,flush=True); tot[f[1]]=tot.get(f[1],0)+1
print(f"TOTAL {TAG}: runs={N} runs_with_failure={runs_failed} by frame:",tot,flush=True)
