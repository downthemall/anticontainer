from __future__ import print_function
import os.path
import sys

from glob import glob

try:
    import simplejson as json
except ImportError:
    import json


def build_plugins():
    plugins = []
    filters = []
    base = os.path.split(__file__)[0]

    for fileName in sorted(glob(os.path.join(base, '../plugins/*.json'))):
        try:
            with open(fileName, 'rb') as f:
                content = f.read().decode('utf-8')
                plugin = json.loads(content)
                plugin['date'] = int(os.path.getmtime(fileName) * 1000)

                plugins.append(plugin)
                filters.append(plugin['match'])
        except IOError as e:
            print('Could not open file {0}: {1}'.format(fileName, e),
                  file=sys.stderr)
            sys.exit(1)
        except ValueError as e:
            print('Could not load JSON from file {0}: {1}'.format(fileName,
                                                                  *e.args),
                  file=sys.stderr)
            sys.exit(1)

    print('Writing {} combined plugins.'.format(len(plugins)))
    with open(os.path.join(base, '../modules/plugins.json'), 'w') as f:
        json.dump(plugins, f)

if __name__ == "__main__":
    from build_sandboxes import build_sandboxes
    build_sandboxes()
    build_plugins()
    sys.exit(0)
