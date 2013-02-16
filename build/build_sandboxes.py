from __future__ import print_function
import os.path
import re
import sys

from collections import OrderedDict
from glob import glob

try:
    import simplejson as json
except ImportError:
    import json

defaultOrder = ('type', 'ns', 'author', 'prefix', 'match', 'pattern',
                'replacement', 'finder', 'builder', 'generator', 'process',
                'resolve')
reIndent = re.compile('^(\t*) {4}', re.M)
reType = re.compile('(.*)\.(resolve|process)\.js$')


def build_sandboxes():
    plugins = {}
    base = os.path.split(__file__)[0]

    match = os.path.join(base, '../plugins/sandboxes/*.js')
    for fileName in sorted(glob(match)):
        name, t = reType.match(os.path.basename(fileName)).groups()
        if name not in plugins:
            p = os.path.join(base, '../plugins/{0}.json').format(name)
            plugins[name] = {'plugin': p}
        plugins[name][t] = fileName

    print('Updating {0} sandbox plugins.'.format(len(plugins)))
    for plugin in plugins.values():
        try:
            data = OrderedDict(zip(defaultOrder, [None] * len(defaultOrder)))
            with open(plugin['plugin'], "rb") as f:
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
                        msg = 'Could not open {0} file {1}: {2}'
                        print(msg.format(t, plugin[t], e), file=sys.stderr)

            # generate JSON
            jsonData = json.dumps(data, indent=4, separators=(',', ': '))
            count = 1
            while count > 0:
                jsonData, count = reIndent.subn('\\1\t', jsonData)

            # write plugin file
            with open(plugin['plugin'], 'wb') as f:
                f.truncate(0)
                f.seek(0)
                f.write(jsonData.encode('utf-8'))

        except IOError as e:
            msg = 'Could not open file {0}: {1}'
            print(msg.format(plugin['plugin'], e), file=sys.stderr)
            sys.exit(1)

        except ValueError as e:
            msg = 'Could not load JSON from file {0}: {1}'
            print(msg.format(plugin['plugin'], *e.args), file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    build_sandboxes()
    sys.exit(0)
