/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DownThemAll! Anti-Container plugins module
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Nils Maier <MaierMan@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = [
	'pushPlugin', 'popPlugin',
	'nsJSON',
	'loadPluginFromStream', 'loadPluginFromFile',
	'enumerate',
	'installFromFile', 'installFromWeb', 'uninstallPlugin', 'createNewPlugin',
	'prettyJSON',
	'TOPIC_PLUGINSCHANGED', 'DEFAULT_NAMESPACE'
];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const module = Cu.import;
const log = Cu.reportError;
const Exception = Components.Exception;

const TOPIC_PLUGINSCHANGED = 'DTA:AC:pluginschanged';
const DEFAULT_NAMESPACE = 'nonymous';

const ConverterOutputStream = Components.Constructor('@mozilla.org/intl/converter-output-stream;1', 'nsIConverterOutputStream', 'init');
const FileInputStream = Components.Constructor('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init');
const FileOutputStream = Components.Constructor('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init');
const File = new Components.Constructor('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath');

if (!('XMLHttpRequest' in this)) {
	this.XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
}

module("resource://gre/modules/XPCOMUtils.jsm");

// lazy init some components we need
this.__defineGetter__('Prefs', function() {
	let p = Cc['@mozilla.org/preferences-service;1']
		.getService(Ci.nsIPrefService)
		.getBranch('extensions.dta.')
		.QueryInterface(Ci.nsIPrefBranch2);
	delete this.Prefs;
	return this.Prefs = p;
});

this.__defineGetter__('PD_DIR', function() {
	let pd = Cc['@mozilla.org/file/directory_service;1']
		.getService(Ci.nsIProperties)
		.get("ProfD", Ci.nsILocalFile);
	delete this.PD_DIR;
	return this.PD_DIR = pd;
});


this.__defineGetter__('USER_DIR', function() {
	let d = PD_DIR.clone();
	d.append('anticontainer_plugins');
	if (!d.exists()) {
		d.create(Ci.nsIFile.DIRECTORY_TYPE, 0774);
	}
	delete this.USER_DIR;
	return this.USER_DIR = d;
});

this.__defineGetter__('nsJSON', function() {
	delete this.nsJSON;
	return this.nsJSON = Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON);
});

this.__defineGetter__('UUID', function() {
	let ug = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
	delete this.UUID;
	return this.UUID = ug;
});
function newUUID() UUID.generateUUID().toString();

let __builtinPlugins__ = [];

function Observer() {
	Prefs.addObserver('anticontainer.disabled_plugins', this, true);
	Prefs.addObserver('filters.deffilter-ac', this, true);
}
Observer.prototype = {
	_os: Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService),
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference, Ci.nsIWeakReference]),
	QueryReferent: function(iid) this.QueryInterface(iid),
	GetWeakReference: function() this,
	
	observe: function() {
		this.notify();
	},
	notify: function() {
		this._os.notifyObservers(null, TOPIC_PLUGINSCHANGED, null);
	}
};
const observer = new Observer();

let lastFilters = 0;

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
			throw new Error("Failed to load plugin: sandboxed plugin doesn't implement anything!");
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
	
	o.source = nsJSON.encode(o);
	
	for each (let x in ['match', 'pattern', 'gone']) {
		if (x in o) {
			o['str' + x] = o[x];
			o[x] = new RegExp(o[x], 'im');
		}
	}
	if ('finder' in o) {
		let flags = 'im';
		if (o.type == 'expander') {
			flags += 'g'
		}
		o.strfinder = o.finder;
		o.finder = new RegExp(o.finder, flags);
	}
	for each (let c in o.cleaners) {
		for each (let x in ['pattern']) {
			if (x in c) {
				c['str' + x] = c[x];
				c[x] = new RegExp(c[x], 'i');
			}
		}
	}
	for each (let b in ['static', 'decode', 'static', 'omitReferrer', 'sendInitialReferrer', 'useServerName', 'useOriginName', 'noFilter']) {
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
		file = new File(file);
	}
	let fs = new FileInputStream(file, 0x01, 0, 1<<2);
	let o = loadPluginFromStream(fs, file.size);
	fs.close();
	o.file = file;
	o.date = file.lastModifiedTime;
	return o;
}
function idToFilename(id) id.replace(/[^\w\d\._@-]/gi, '-') + ".json";

/**
 * Enumerates plugins
 * @param all When true all plugins are enumerated, if false of missing then only active plugins
 * @return Generator over plugins
 */
function enumerate(all) {
	let disabled = !!all ? [] : nsJSON.decode(Prefs.getCharPref('anticontainer.disabled_plugins'));
	let i = 0;
	
	// load builtin plugins
	for each (let o in __builtinPlugins__) {
		++i;
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

				if (disabled.indexOf(o.id) != -1) {
					continue;
				}

				o.priority += 3;
				o.managed = false;
				
				++i;
				yield o;
			}
			catch (ex) {
				log("Failed to load " + f.leafName);
				log(ex);
			}
		}
	}
	if (lastFilters && i != lastFilters) {
		log('dtaac:plugins: notify because of new numPlugins');
		lastFilters = i;
		observer.notify();
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
	observer.notify();
	return p;
}

function installFromStringOrObject(str) {
	str = prettyJSON(str);
	let p = validatePlugin(nsJSON.decode(str));
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
	observer.notify();
	return {id: p.id, file: pf};
}	

/**
 * Installs a plugin as retrieved from the web
 * @param str String containing the source code of the plugin
 * @param updateURL [optional] The update URL of the plugin
 * @return The newly installed Plugin
 */
function installFromWeb(str, updateURL) {
	let p = nsJSON.decode(str);
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
	observer.notify();
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
					switch ($0) {case "\b": return "\\b"; case "\t": return "\\t"; case "\n": return "\\n"; case "\f": return "\\f"; case "\r": return "\\r"; case '"':	return '\\"'; case "\\": return "\\\\";}
					return "\\u" + ("0000" + $0.charCodeAt(0).toString(16)).slice(-4);
				});
				_p.push('"' + o + '"')
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
					arguments.callee(o[i], _l + 1);
					_p.push(",");
				}
				if (o.length > 0)
					_p.pop();
				_p.push("\n" + l(_l) + "]");
			}
			else if (typeof o == "object") {
				_p.push(l(_l));
				_p.push("{\n");
				for (var key in o) {
					_p.push(l(_l + 1));
					arguments.callee(key.toString());
					_p.push(": ");
					arguments.callee(o[key], _l + 1);
					_p.push(",\n");
				}
				if (_p[_p.length - 1] == ",\n")
					_p.pop();
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
		objectOrString = nsJSON.encode(objectOrString);
	}
	return prettyPrint(nsJSON.decode(objectOrString), initialIndent);
}

(function() {
	let req = new XMLHttpRequest();
	// don't try to parse as XML
	req.overrideMimeType('application/json');
	req.open('GET', 'resource://dtaac/plugins.json');
	req.onload = function() {
		__builtinPlugins__ = nsJSON.decode(req.responseText);
		for each (let o in __builtinPlugins__) {
			try {
				o = validatePlugin(o);
				o.file = null;
				o.priority += 1;
				o.managed = true;
			}
			catch (ex) {
				log("Failed to load builtin: " + o.toSource());
				log(ex);
			}
		}		
		observer.notify();
	};
	req.send(null);
})();