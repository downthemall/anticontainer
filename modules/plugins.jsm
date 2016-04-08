/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = [
  'pushPlugin', 'popPlugin',
  'loadPluginFromStream', 'loadPluginFromFile',
  'enumerate',
  'installFromFile', 'installFromWeb', 'uninstallPlugin', 'createNewPlugin',
  'prettyJSON',
  'TOPIC_PLUGINSCHANGED', 'DEFAULT_NAMESPACE'
];

const boolAttrs = [
  'decode',
  'static',
  'omitReferrer',
  'keepReferrer',
  'sendInitialReferrer',
  'useServerName',
  'useOriginName',
  'noFilter',
  "cleanRequest"
  ];

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  Constructor: ctor,
} = Components;

var TOPIC_PLUGINSCHANGED = 'DTA:AC:pluginschanged';
var DEFAULT_NAMESPACE = 'nonymous';

var ConverterOutputStream = ctor(
  '@mozilla.org/intl/converter-output-stream;1',
  'nsIConverterOutputStream',
  'init');
var FileInputStream = ctor(
  '@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init');
var FileOutputStream = ctor(
  '@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init');
var LocalFile = new ctor(
  '@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath');

if (!('XMLHttpRequest' in this)) {
  this.XMLHttpRequest = ctor(
    "@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
}

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

// lazy init some components we need
XPCOMUtils.defineLazyGetter(
  this,
  'Prefs', /* globals Prefs */
  () => Services.prefs.
    getBranch('extensions.dta.').
    QueryInterface(Ci.nsIPrefBranch2)
);
XPCOMUtils.defineLazyGetter(
  this,
  'PD_DIR', /* globals PD_DIR */
  () => Cc['@mozilla.org/file/directory_service;1'].
    getService(Ci.nsIProperties).
    get("ProfD", Ci.nsILocalFile)
);
XPCOMUtils.defineLazyGetter(
  this,
  'USER_DIR', /* globals USER_DIR */
  function() {
    let d = PD_DIR.clone();
    d.append('anticontainer_plugins');
    if (!d.exists()) {
      d.create(Ci.nsIFile.DIRECTORY_TYPE, 484 /* 0774 */);
    }
    return d;
  });
XPCOMUtils.defineLazyGetter(
  this,
  'nsJSON', /* globals nsJSON */
  () => Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON)
);
XPCOMUtils.defineLazyServiceGetter(
  this,
  'UUID', /* globals UUID */
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

function newUUID() {
  return UUID.generateUUID().toString();
}

let __builtinPlugins__ = [];

var Observer = function Observer() {
  Services.obs.addObserver(this, "xpcom-shutdown", false);
  Prefs.addObserver("anticontainer.disabled_plugins", this, false);
};
Observer.prototype = {
  observe: function(s,t,d) {
    d = d || null; // unused
    if (t == "xpcom-shutdown") {
      Services.obs.removeObserver(this, "xpcom-shutdown");
      Prefs.removeObserver("anticontainer.disabled_plugins", this);
      return;
    }

    this.notify();
  },
  notify: function(force) {
    let data = null;
    if (force) {
      data = Cc["@mozilla.org/supports-PRBool;1"].
             createInstance(Ci.nsISupportsPRBool);
      data.data = force;
      Cu.reportError("forcing");
    }
    Services.obs.notifyObservers(null, TOPIC_PLUGINSCHANGED, data);
  }
};
Observer = new Observer();

let lastModified = 0;

function validatePlugin(o) {
  if (['redirector', 'resolver', 'sandbox', 'expander'].indexOf(o.type) == -1) {
    throw new Error("Failed to load plugin: invalid type");
  }

  switch (o.type) {
  case 'resolver':
    if (!o.finder || !o.builder) {
      throw new Error("Failed to load plugin: incomplete resolver!");
    }
    break;
  case 'redirector':
    if (!o.pattern || !o.match) {
      throw new Error("Failed to load plugin: incomplete redirector!");
    }
    break;
  case 'sandbox':
    if (!o.process && !o.resolve) {
      throw new Error(
        "Failed to load plugin: sandboxed plugin doesn't implement anything!");
    }
    break;
  case 'expander':
    if (!o.finder || !o.generator) {
      throw new Error("Failed to load plugin: incomplete expander!");
    }
    break;
  }

  if (!o.prefix || typeof o.prefix != 'string') {
    throw new Error("Failed to load plugin: prefix omitted");
  }

  o.source = JSON.stringify(o, null, "  ");

  for (let x of ['match', 'pattern', 'gone']) {
    if (x in o) {
      o['str' + x] = o[x];
      o[x] = new RegExp(o[x], 'im');
    }
  }
  if ('finder' in o) {
    let flags = 'im';
    if (o.type == 'expander') {
      flags += 'g';
    }
    o.strfinder = o.finder;
    o.finder = new RegExp(o.finder, flags);
  }
  if (o.cleaners) {
    for (let c of o.cleaners) {
      for (let x of ['pattern']) {
        if (x in c) {
          c['str' + x] = c[x];
          c[x] = new RegExp(c[x], 'ig');
        }
      }
    }
  }
  for (let b of boolAttrs) {
    o[b] = !!o[b];
  }

  if (!o.priority || typeof o.priority != 'number') {
    o.priority = 0;
  }
  o.priority = Math.round(o.priority);

  if (!o.ns) {
    o.ns = DEFAULT_NAMESPACE;
  }
  o.ns = o.ns.toString();

  o.id = o.prefix + '@' + o.ns;
  return o;
}

/**
 * Loads a plugin directly from a nsIInputStream
 * @param stream Stream to load from
 * @param size Size to read from the Stream
 * @return Loaded plugin
 */
function loadPluginFromStream(stream, size) {
  return validatePlugin(nsJSON.decodeFromStream(stream, size));
}

/**
 * Loads a plugin from a file
 * @param file File to load the plugin from (either as String or nsIFile)
 * @return Loaded Plugin
 */
function loadPluginFromFile(file) {
  if (!(file instanceof Ci.nsIFile)) {
    file = new LocalFile(file);
  }
  let fs = new FileInputStream(file, 0x01, 0, 1<<2);
  let o = loadPluginFromStream(fs, file.size);
  fs.close();
  o.file = file;
  o.date = file.lastModifiedTime;
  return o;
}

function idToFilename(id) {
  return id.replace(/[^\w\d\._@-]/gi, '-') + ".json";
}

/**
 * Enumerates plugins
 * @param all When true all plugins are enumerated, if false only active
 * @return Generator over plugins
 */
function* enumerate(all) {
  let disabled = !!all ?
    [] :
    JSON.parse(Prefs.getCharPref('anticontainer.disabled_plugins'));
  let lm = 0;

  // load builtin plugins
  for (let o of __builtinPlugins__) {
    if (disabled.indexOf(o.id) != -1) {
      continue;
    }
    yield o;
  }

  // load user plugins
  let e = USER_DIR.directoryEntries;
  while (e.hasMoreElements()) {
    let f = e.getNext().QueryInterface(Ci.nsIFile);
    if (f.leafName.search(/\.json$/i) != -1) {
      try {
        let o = loadPluginFromFile(f);
        lm = Math.max(lm, o.date);

        if (disabled.indexOf(o.id) != -1) {
          continue;
        }

        o.priority += 3;
        o.managed = false;
        yield o;
      }
      catch (ex) {
        Cu.reportError("Failed to load " + f.leafName);
        Cu.reportError(ex);
      }
    }
  }
  if (lastModified && lm != lastModified) {
    Cu.reportError('dtaac:plugins: notify because of new numPlugins');
    lastModified = lm;
    Observer.notify(true);
  }
}

/**
 * Installs a new Plugin from file
 * @param file File to load the new Plugin from, either String or nsIFile
 * @return The newly installed Plugin
 */
function installFromFile(file) {
  let p = loadPluginFromFile(file);
  let pd = USER_DIR.clone();
  let nn = idToFilename(p.id);
  file.copyTo(pd, nn);
  pd.append(nn);
  p.file = pd;
  Observer.notify(true);
  return p;
}

function installFromStringOrObject(str) {
  str = prettyJSON(str);
  let p = validatePlugin(JSON.parse(str));
  let pf = USER_DIR.clone();
  pf.append(idToFilename(p.id));

  let cs = ConverterOutputStream(
    new FileOutputStream(pf, 0x02 | 0x08 | 0x20, -1, 0),
    null,
    0,
    null
  );
  cs.writeString(str);
  cs.close();
  Observer.notify(true);
  return {id: p.id, file: pf};
}

/**
 * Installs a plugin as retrieved from the web
 * @param str String containing the source code of the plugin
 * @param updateURL [optional] The update URL of the plugin
 * @return The newly installed Plugin
 */
function installFromWeb(str, updateURL) {
  let p = JSON.parse(str);
  p.fromWeb = true;
  if (!p.updateURL && updateURL) {
    p.updateURL = updateURL;
  }
  return installFromStringOrObject(p);
}

/**
 * Uninstalls a Plugin for a given id
 * @param id Id of the Plugin to uninstall
 * @return void
 */
function uninstallPlugin(id) {
  let pf = USER_DIR.clone();
  pf.append(idToFilename(id));
  if (!pf.exists()) {
    throw new Error("Cannot find plugin for id: " + id + ", tried: " + pf.path);
  }
  pf.remove(false);
  Observer.notify(true);
}

function createNewPlugin(plugin) {
  switch (plugin.type) {
  case 'redirector':
    plugin.pattern = "<fill>";
    plugin.replacement = "<fill>";
    break;
  case 'resolver':
    plugin.finder = "<fill regexp>";
    plugin.builder = "<fill builder>";
    break;
  case 'sandbox':
    plugin.process = 'makeRequest(baseURL, resolve, resolve);';
    plugin.resolve = 'defaultResolve();';
    break;
  case 'expander':
    plugin.finder = "<fill regexp>";
    plugin.generator = "<fill generator>";
    break;
  }
  return installFromStringOrObject(plugin);
}

const _store = {};

/**
 * Helper for webinstall: temp store a Plugin under a given id
 * @param id Id to store the Plugin under
 * @param plug Plugin to store (actually can be any object)
 * @return void
 */
function pushPlugin(id, plug) {
  _store[id] = plug;
}

/**
 * Helper for webinstall: get a temp stored Plugin again
 * @param id Id the Plugin is stored under
 * @return Stored Plugin
 */
function popPlugin(id) {
  if (!(id in _store)) {
    throw new Error("plugin not found!");
  }
  let rv = _store[id];
  delete _store[id];
  return rv;
}

/**
 * Produce valid json, but "pretty"
 * @param objectOrString To encode
 * @param initialIndent Initial number of idents (one ident is one tab spaces)
 * @return String containing the pretty version
 */
function prettyJSON(objectOrString, initialIndent) {
  // borrowed from json.jsm
  // and modified to do some pretty printing
  function prettyPrint(_oo, _l) {
    let _p = [];

    function l(n) {
      let rv = '';
      while(--n >= 0) {
        rv += '\t';
      }
      return rv;
    }
    function p(o, _l) {
      if (typeof o == "string") {
        o = o.replace(/[\\"\x00-\x1F\u0080-\uFFFF]/g, function($0) {
          switch ($0) {
            case "\b": return "\\b";
            case "\t": return "\\t";
            case "\n": return "\\n";
            case "\f": return "\\f";
            case "\r": return "\\r";
            case '"': return '\\"';
            case "\\": return "\\\\";
          }
          return "\\u" + ("0000" + $0.charCodeAt(0).toString(16)).slice(-4);
        });
        _p.push('"' + o + '"');
      }
      else if (typeof o == "boolean") {
        _p.push(o ? "true" : "false");
      }
      else if (typeof o == "number" && isFinite(o)) {
        _p.push(o.toString());
      }
      else if (o === null) {
        _p.push("null");
      }
      else if (
        o instanceof Array ||
        typeof o == "object" && "length" in o &&
        (o.length === 0 || o[o.length - 1] !== undefined)
      ) {
        _p.push("[\n");
        for (var i = 0; i < o.length; i++) {
          p(o[i], _l + 1);
          _p.push(",");
        }
        if (o.length > 0) {
          _p.pop();
        }
        _p.push("\n" + l(_l) + "]");
      }
      else if (typeof o == "object") {
        _p.push(l(_l));
        _p.push("{\n");
        for (var key in o) {
          _p.push(l(_l + 1));
          p(key.toString());
          _p.push(": ");
          p(o[key], _l + 1);
          _p.push(",\n");
        }
        if (_p[_p.length - 1] == ",\n") {
          _p.pop();
        }
        _p.push("\n" + l(_l) + "}");
      }
      else {
        throw new TypeError("No JSON representation for this object!");
      }
    }
    p(_oo, _l ? _l : 0);

    return _p.join("");
  }
  if (typeof objectOrString != 'string') {
    objectOrString = JSON.stringify(objectOrString);
  }
  return prettyPrint(JSON.parse(objectOrString), initialIndent);
}

(function() {
  let req = new XMLHttpRequest();
  // don't try to parse as XML
  req.overrideMimeType('application/json');
  req.open('GET', 'chrome://dtaac-modules/content/plugins.json');
  req.addEventListener("load", function() {
    __builtinPlugins__ = [];
    let decoded = JSON.parse(req.responseText);
    for (let o of decoded) {
      try {
        o = validatePlugin(o);
        o.file = null;
        o.priority += 1;
        o.managed = true;
        __builtinPlugins__.push(o);
      }
      catch (ex) {
        Cu.reportError("Failed to load builtin: " + o.toSource());
        Cu.reportError(ex);
      }
    }
    Observer.notify();
  }, false);
  req.send(null);
})();
