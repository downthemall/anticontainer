from __future__ import print_function
import collections, glob, os.path, re, sys

try:
	import simplejson as json
except ImportError:
	import json

defaultOrder = ('type', 'ns', 'author', 'prefix', 'match', 'pattern', 'replacement', 'finder', 'builder',
	'generator', 'process', 'resolve' )
reIndent = re.compile('^(\t*) {4}', re.M)
plugins = {}

for fileName in sorted(glob.glob('../plugins/sandboxes/*.js')):
	name, t = re.match('(.*)\.(resolve|process)\.js$', os.path.basename(fileName)).groups()
	if name not in plugins:
		plugins[name] = { 'plugin': '../plugins/{0}.json'.format(name) }
	plugins[name][t] = fileName

for plugin in plugins.values():
	try:
		with open(plugin['plugin'], 'rb+') as f:
			data = collections.OrderedDict(zip(defaultOrder, [None] * len(defaultOrder)))
			data.update(json.loads(f.read().decode('utf-8')))
			
			# remove unset values
			for key, value in data.items():
				if value is None:
					del data[key]
			
			# import scripts
			for t in ('process', 'resolve'):
				if t in plugin:
					try:
						with open(plugin[t]) as sourceFile:
							data[t] = sourceFile.read()
					except IOError as e:
						print('Could not open {0} file {1}: {2}'.fomat(t, plugin[t], e), file=sys.stderr)
			
			# generate JSON
			jsonData, count = json.dumps(data, indent=4, separators=(',', ': ')), 1
			while count > 0:
				jsonData, count = reIndent.subn('\\1\t', jsonData)
			
			# write plugin file
			f.truncate(0)
			f.seek(0)
			f.write(jsonData.encode('utf-8'))
	except IOError as e:
		print('Could not open file {0}: {1}'.format(plugin['plugin'], e), file=sys.stderr)
	except ValueError as e:
		print('Could not load JSON from file {0}: {1}'.format(plugin['plugin'], *e.args), file=sys.stderr)