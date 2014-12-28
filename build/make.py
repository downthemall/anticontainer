#!/usr/bin/env python
"""anticontainer make"""

import os
import sys

from optparse import OptionParser
from warnings import warn
from io import BytesIO
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
from glob import glob
from fnmatch import fnmatch
from functools import wraps

from build_sandboxes import build_sandboxes
from build_plugins import build_plugins

try:
    from xpisign.context import ZipFileMinorCompression as _Minor
    Minor = _Minor
except ImportError:
    warn("No optimal compression available")

    class Minor(object):
        """ Compatiblity stub"""

        def __init__(self, *args):
            pass

        def __enter__(self):
            pass

        def __exit__(self, *args):
            pass


class Reset(object):
    """
    Reset the tracked file-like object stream position when done
    """

    def __init__(self, filep):
        self.filep = filep
        self.pos = 0

    def __enter__(self):
        self.pos = self.filep.tell()

    def __exit__(self, *args):
        self.filep.seek(self.pos, 0)


class WorkingDirectory(object):
    """
    Change the working directory to make.py's op path and restore when done
    """

    def __init__(self):
        self.directory = None

    def __enter__(self):
        self.directory = os.getcwd()
        try:
            os.chdir(os.path.join(os.path.split(__file__)[0], ".."))
        except Exception:
            pass

    def __exit__(self, *args):
        os.chdir(self.directory)

    @staticmethod
    def change(func):
        """
        Decorator: Change the working directory before calling wrapped
        function.
        """

        @wraps(func)
        def wrapper(*args, **kw):
            """Execute in WorkingDirectory"""
            with WorkingDirectory():
                return func(*args, **kw)
        return wrapper


FILES = (
    "install.rdf",
    "icon*.png",
    "COPYING",
    "chrome.manifest",
    "components",
    "content",
    "defaults",
    "locale",
    "modules",
    "skin",
    )
EXCLUDED = ()
PLAIN = (
    "*.png",
    "*.jpg",
    "*.gif"
    )


def filesort(name):
    """Package file sort keys"""
    if name in ("install.rdf",):
        return 0, name
    if name in ("bootstrap.js", "chrome.manifest"):
        return 1, name
    if fnmatch(name, "icon*.png"):
        return 2, name
    if fnmatch(name, "components/*"):
        return 3, name
    if fnmatch(name, "modules/*"):
        return 4, name
    if name in ("COPYING",):
        return 1000, name
    return 500, name


def files(*args, **kw):
    """
    Generator over all file listing the given patterns.
    All arguments will be considered patterns.

    excluded keyword arg may specify a list of patterns that won't be returned
    """

    excluded = kw.pop("excluded", ())

    def items(name):
        """Enumerate file items for xpi"""
        if os.path.isdir(name):
            if not name.endswith("/"):
                name += "/"
            for i in files(name + "*"):
                yield i
        elif os.path.isfile(name) and \
                not any(fnmatch(name, x) for x in excluded):
            yield name

    for arg in args:
        globbed = glob(arg)
        if not globbed:
            raise ValueError("{} did not match anything!".format(arg))
        for name in globbed:
            for i in items(name):
                yield i


@WorkingDirectory.change
def pack(xpi, patterns, **kw):
    """Build the actual XPI"""

    packing = sorted(set(files(*patterns, excluded=EXCLUDED)),
                     key=filesort)
    with ZipFile(xpi, "w", ZIP_DEFLATED) as outp:
        def write(name, mode, modifier=None):
            """Write a file to the output xpi"""
            with open(name, "rb") as inp:
                if modifier:
                    with modifier(inp, **kw) as modified:
                        outp.writestr(name, modified.read(), mode)
                else:
                    outp.writestr(name, inp.read(), mode)

        with Minor(outp):
            for name in packing:
                if any(fnmatch(name, p) for p in PLAIN):
                    write(name, ZIP_STORED)
                else:
                    write(name, ZIP_DEFLATED)


def create(args):
    """Process arguments and create the XPI"""

    parser = OptionParser()
    parser.add_option("--force",
                      dest="force",
                      help="force overwrite output file if exists",
                      action="store_true",
                      default=False)
    opts, args = parser.parse_args(args)

    patterns = FILES

    if len(args) != 1:
        raise ValueError("No distinct XPI name provided")
    output = args[0]

    if not opts.force and os.path.exists(output):
        raise ValueError("Output file already exists")

    build_sandboxes()
    build_plugins()

    with BytesIO() as buf:
        with Reset(buf):
            pack(buf, patterns, **opts.__dict__)

        with open(output, "wb") as outp:
            outp.write(buf.read())

if __name__ == "__main__":
    try:
        create(sys.argv[1:])
    except Exception as ex:
        print >>sys.stderr, ex
        sys.exit(1)
