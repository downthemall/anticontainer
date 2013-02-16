#!/usr/bin/env python
import os
import sys
import re

from optparse import OptionParser
from warnings import warn
from io import BytesIO
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
from glob import glob
from fnmatch import fnmatch
from time import strftime
from xml.dom.minidom import parseString as XML
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

    def __init__(self, fp):
        self.fp = fp

    def __enter__(self):
        self.pos = self.fp.tell()

    def __exit__(self, *args):
        self.fp.seek(self.pos, 0)


class WorkingDirectory(object):
    """
    Change the working directory to make.py's op path and restore when done
    """

    def __enter__(self):
        self.wd = os.getcwd()
        try:
            os.chdir(os.path.join(os.path.split(__file__)[0], ".."))
        except:
            pass

    def __exit__(self, *args):
        os.chdir(self.wd)

    @staticmethod
    def change(f):
        """
        Decorator: Change the working directory before calling wrapped
        function.
        """

        @wraps(f)
        def wrapper(*args, **kw):
            with WorkingDirectory():
                return f(*args, **kw)
        return wrapper


FILES = ("install.rdf",
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
PLAIN = ("*.png",
         "*.jpg",
         "*.gif"
         )


def filesort(f):
    """
    Package file sort keys
    """

    if f in ("install.rdf",):
        return 0, f
    if f in ("bootstrap.js", "chrome.manifest"):
        return 1, f
    if fnmatch(f, "icon*.png"):
        return 2, f
    if fnmatch(f, "components/*"):
        return 3, f
    if fnmatch(f, "modules/*"):
        return 4, f
    if f in ("COPYING"):
        return 1000, f
    return 500, f


def files(*args, **kw):
    """
    Generator over all file listing the given patterns.
    All arguments will be considered patterns.

    excluded keyword arg may specify a list of patterns that won't be returned
    """

    excluded = kw.pop("excluded", ())

    def items(f):
        if os.path.isdir(f):
            if not f.endswith("/"):
                f += "/"
            for i in files(f + "*"):
                yield i
        elif os.path.isfile(f) and not any(fnmatch(f, x) for x in excluded):
            yield f

    for p in args:
        gg = glob(p)
        if not gg:
            raise ValueError("{} did not match anything!".format(p))
        for g in gg:
            for i in items(g):
                yield i


@WorkingDirectory.change
def pack(xpi, patterns, **kw):
    """ Build the actual XPI """

    packing = sorted(set(files(*patterns, excluded=EXCLUDED)),
                     key=filesort)
    with ZipFile(xpi, "w", ZIP_DEFLATED) as zp:
        def write(fn, mode, modifier=None):
            with open(fn, "rb") as fp:
                if modifier:
                    with modifier(fp, **kw) as mp:
                        zp.writestr(fn, mp.read(), mode)
                else:
                    zp.writestr(fn, fp.read(), mode)

        with Minor(zp):
            for f in packing:
                if any(fnmatch(f, p) for p in PLAIN):
                    write(f, ZIP_STORED)
                else:
                    write(f, ZIP_DEFLATED)


def create(args):
    """ Process arguments and create the XPI """

    parser = OptionParser()
    parser.add_option("--force",
                      dest="force",
                      help="force overwrite output file if exists",
                      action="store_true",
                      default=False
                      )
    opts, args = parser.parse_args(args)

    patterns = FILES

    if len(args) != 1:
        raise ValueError("No distinct XPI name provided")
    output = args[0]

    if not opts.force and os.path.exists(output):
        raise ValueError("Output file already exists")

    build_sandboxes()
    build_plugins()

    with BytesIO() as io:
        with Reset(io):
            pack(io, patterns, **opts.__dict__)

        with open(output, "wb") as op:
            op.write(io.read())

if __name__ == "__main__":
    create(sys.argv[1:])
