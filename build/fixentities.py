import os, sys, re
import codecs
from glob import glob

REPLACEMENTS = {
	u'amp': u'',
	u'lt': u'<',
	u'gt': u'>',
	u'apos': u"'",
	u'quot': u'"'
}
def replacer(m):
	if REPLACEMENTS.has_key(m.group(1)):
		return REPLACEMENTS[m.group(1)]
	return m.group(0)
	

def get_files():
	for x in ("../chrome/locale/**/*.dtd", "../chrome/locale/**/*.properties"):
		for f in glob(x):
			yield f

for locale in get_files():
	l = codecs.open(locale, 'r', 'utf-8')
	lines = l.read()
	l.close()
	nlines = re.sub(r'&(' + '|'.join(REPLACEMENTS.keys()) + ');', replacer, lines)
	if nlines != lines:
		print locale
		f = codecs.open(locale, 'w', 'utf-8')
		f.write(nlines)
		f.close()