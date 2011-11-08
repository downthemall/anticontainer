import os, sys, re
try:
    from simplejson import load as json
    from simplejson import dumps as dump
except:
    from json import load as json
    from json import dumps as dump
try:
    from natsorted import natcasesorted as nsorted
except:
    nsorted = sorted
from glob import glob

VERSION = 0.1

all = []

for p in nsorted(glob("../plugins/*.json")):
    fp = open(p, "r")
    x = json(fp, "utf-8")
    x['date'] = int(os.path.getmtime(p) * 1000)
    fp.close()
    all += x,

fp = open("../modules/plugins.json", "w")
fp.write(dump(all))
