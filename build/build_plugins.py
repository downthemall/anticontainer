from __future__ import print_function
import glob, os.path, sys
from mergeex import mergeex

try:
	import simplejson as json
except ImportError:
	import json

plugins = []
filters = []

for fileName in sorted(glob.glob('../plugins/*.json')):
	try:
		with open(fileName, 'rb') as f:
			content = f.read().decode('utf-8')
			plugin = json.loads(content)
			plugin['date'] = int(os.path.getmtime(fileName) * 1000)

			plugins.append(plugin)
			filters.append(plugin['match'])
	except IOError as e:
		print('Could not open file {0}: {1}'.format(fileName, e), file=sys.stderr)
	except ValueError as e:
		print('Could not load JSON from file {0}: {1}'.format(fileName, *e.args), file=sys.stderr)

with open('../modules/plugins.json', 'w') as f:
	json.dump(plugins, f)

# merge regular expressions
filters = mergeex(map(lambda x: x.replace('/', '\\/'), filters))

print('pref("extensions.dta.filters.deffilter-ac.label", "AntiContainer");')
print('pref("extensions.dta.filters.deffilter-ac.test", "/{0}/i");'.format(filters))
print('pref("extensions.dta.filters.deffilter-ac.active", true);')
print('pref("extensions.dta.filters.deffilter-ac.type", 1);')