"""Build sandboxes"""

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

DEFAULT_ORDER = (
    'type',
    'ns',
    'author',
    'prefix',
    'match',
    'pattern',
    'replacement',
    'useServerName',
    'keepReferrer',
    'finder',
    'namer',
    'builder',
    'generator',
    'process',
    'resolve')
RE_INDENT = re.compile('^(\t*) {4}', re.M)
RE_TYPE = re.compile(r'(.*)\.(resolve|process)\.js$')


def write_plugin(plugin):
    """Write a plugin"""
    data = OrderedDict(zip(DEFAULT_ORDER, [None] * len(DEFAULT_ORDER)))
    with open(plugin['plugin'], "rb") as inp:
        data.update(json.loads(inp.read().decode('utf-8')))

    # remove unset values
    for key, value in list(data.items()):
        if value is None:
            del data[key]

    # import scripts
    for fun in ('process', 'resolve'):
        if fun not in plugin:
            continue
        try:
            with open(plugin[fun]) as src:
                data[fun] = src.read()
        except IOError as ex:
            print("Could not open {0} file {1}: {2}".
                  format(fun, plugin[fun], ex),
                  file=sys.stderr)

    # generate JSON
    data = json.dumps(data, indent=4, separators=(',', ': '))
    count = 1
    while count > 0:
        data, count = RE_INDENT.subn('\\1\t', data)

    # write plugin file
    with open(plugin['plugin'], 'wb') as outp:
        outp.write(data.encode('utf-8'))


def build_sandboxes():
    """ Build plugins/ sandboxes"""
    plugins = {}
    base = os.path.split(__file__)[0]

    match = os.path.join(base, '../plugins/sandboxes/*.js')
    for plugin in sorted(glob(match)):
        name, fun = RE_TYPE.match(os.path.basename(plugin)).groups()
        if name not in plugins:
            path = os.path.join(base, '../plugins/{0}.json').format(name)
            plugins[name] = {'plugin': path}
        plugins[name][fun] = plugin

    print('Updating {0} sandbox plugins.'.format(len(plugins)))
    for plugin in plugins.values():
        try:
            write_plugin(plugin)
        except IOError as ex:
            print('Could not open file {0}: {1}'.
                  format(plugin['plugin'], ex),
                  file=sys.stderr)
            sys.exit(1)

        except ValueError as ex:
            print('Could not load JSON from file {0}: {1}'.
                  format(plugin['plugin'], *ex.args),
                  file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    build_sandboxes()
    sys.exit(0)
