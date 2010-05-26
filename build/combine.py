import os, sys, re
from simplejson import load as json
from simplejson import dumps as dump
from glob import glob

VERSION = 0.1

all = []
    
for p in glob("../plugins/*.json"):
    fp = open(p, "r")
    x = json(fp, "utf-8")
    x['date'] = int(os.path.getmtime(p) * 1000)
    fp.close()
    all += x,
    
fp = open("../modules/plugins.json", "w")
fp.write(dump(all))