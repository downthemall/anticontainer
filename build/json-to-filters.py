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

print r'pref("extensions.dta.filters.deffilter-ca.label", "AntiContainer");'
print r'pref("extensions.dta.filters.deffilter-ca.test", "/' +  filters + '/i");'
print r'pref("extensions.dta.filters.deffilter-ca.active", true);'
print r'pref("extensions.dta.filters.deffilter-ca.type", 1);'