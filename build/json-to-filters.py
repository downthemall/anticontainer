import os, re, sys
import fileinput
from mergeex import mergeex
import simplejson as json
from glob import glob

filters = ()
for js in glob("../plugins/*.json"):
        f = open(js, 'r')
        js = json.load(f, "utf-8")
        filters += js['match'],
        f.close()

filters = mergeex(map(lambda x: re.sub(r'/', '\\/', x), filters))

print r'pref("extensions.dta.filters.deffilter-ac.label", "AntiContainer");'
print r'pref("extensions.dta.filters.deffilter-ac.test", "/' +  filters + '/i");'
print r'pref("extensions.dta.filters.deffilter-ac.active", true);'
print r'pref("extensions.dta.filters.deffilter-ac.type", 1);'