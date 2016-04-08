"""Plugin builder"""

from __future__ import print_function
import os.path
import sys

from glob import glob
from copy import deepcopy

try:
    import simplejson as json
except ImportError:
    import json


def build_plugins():
    """Build plugins.json"""
    plugins = []
    filters = []
    base, _ = os.path.split(__file__)

    for name in sorted(glob(os.path.join(base, '../plugins/*.json'))):
        try:
            with open(name, 'rb') as inp:
                content = inp.read().decode('utf-8')
            plugin = json.loads(content)
            plugin['date'] = int(os.path.getmtime(name) * 1000)

            if 'hosters' in plugin:
                hosters = plugin["hosters"]
                del plugin["hosters"]
                for h in hosters:
                    p = deepcopy(plugin)
                    for prop in h:
                        p[prop] = h[prop]
                    plugins.append(p)
                    filters.append(p['match'])
            else:
                plugins.append(plugin)
                filters.append(plugin['match'])
        except IOError as ex:
            print('Could not open file {0}: {1}'.format(name, ex),
                  file=sys.stderr)
            sys.exit(1)
        except ValueError as ex:
            print('Could not load JSON from file {0}: {1}'.
                  format(name, *ex.args),
                  file=sys.stderr)
            sys.exit(1)

    print('Writing {} combined plugins.'.format(len(plugins)))
    with open(os.path.join(base, '../modules/plugins.json'), 'w') as outp:
        json.dump(plugins, outp)

if __name__ == "__main__":
    from build_sandboxes import build_sandboxes
    build_sandboxes()
    build_plugins()
    sys.exit(0)
