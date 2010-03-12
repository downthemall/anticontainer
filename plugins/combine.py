import os, sys, re
from simplejson import load as json
from simplejson import dumps as dump
from glob import glob

VERSION = 0.1

all = []
    
for x in glob("*.json"):
    fp = open(x, "r")
    x = json(fp, "utf-8")
    fp.close()
    all += x,
    
fp = open("../plugins.json", "w")
fp.write(dump(all))