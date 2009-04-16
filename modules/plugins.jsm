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
	'JSON',
	'loadPluginFromStream', 'loadPluginFromFile',
	'enumerate',
	'installFromFile', 'installFromWeb', 'uninstall',
	'TOPIC_PLUGINSCHANGED'
];

const Cc = Components.classes;
const Ci = Components.interfaces;
const log = Components.utils.reportError;

const TOPIC_PLUGINSCHANGED = 'DTA:AC:pluginschanged';
const DEFAULT_NAMESPACE = 'nonymous';

const Prefs = Cc['@mozilla.org/preferences-service;1']
	.getService(Ci.nsIPrefService)
	.getBranch('extensions.dta.')
	.QueryInterface(Ci.nsIPrefBranch2);

const EMDirectory = Cc['@mozilla.org/extensions/manager;1']
	.getService(Ci.nsIExtensionManager)
	.getInstallLocation('anticontainer@downthemall.net')
	.getItemFile('anticontainer@downthemall.net', 'plugins/');

const PDirectory = Cc['@mozilla.org/file/directory_service;1']
	.getService(Ci.nsIProperties)
	.get("ProfD", Ci.nsILocalFile);

const UDirectory = (function() {
	let d = PDirectory.clone();
	d.append('anticontainer_plugins');
	if (!d.exists()) {
		d.create(Ci.nsIFile.DIRECTORY_TYPE, 0664);
	}
	return d;
})();

const JSON = Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON);

const ConverterOutputStream = Components.Constructor('@mozilla.org/intl/converter-output-stream;1', 'nsIConverterOutputStream', 'init');
const FileInputStream = Components.Constructor('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init');
const FileOutputStream = Components.Constructor('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init');
const File = new Components.Constructor('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath');

const uuidgen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
newUUIDString = function() {
	return uuidgen.generateUUID().toString();
}

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

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
	if (['redirector', 'resolver', 'sandbox'].indexOf(o.type) == -1) {
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
	}
	
	if (!o.prefix || typeof o.prefix != 'string') {
		throw new Error("Failed to load plugin: prefix omitted");
	}
	
	o.source = JSON.encode(o);
	
	for each (let x in ['match', 'finder', 'pattern']) {
		if (x in o) {
			o['str' + x] = o[x];
			o[x] = new RegExp(o[x], 'im');
		}
	}
	for each (let c in o.cleaners) {
		for each (let x in ['pattern']) {
			if (x in c) {
				c['str' + x] = c[x];
				c[x] = new RegExp(c[x], 'i');
			}
		}
	}
	for each (let b in ['decode', 'static', 'omitReferrer', 'sendInitialReferrer', 'useServerName']) {
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

function loadPluginFromStream(stream, size) {
	return validatePlugin(JSON.decodeFromStream(stream, size));
}

function loadPluginFromFile(file) {
	let fs = new FileInputStream(file, 0x01, 0, 1<<2);
	let o = loadPluginFromStream(fs, file.size);
	fs.close();
	o.file = file;	
	return o;
}
function idToFilename(id) id.replace(/[^\w\d\._@-]/gi, '-') + ".json";

function _enumerate(enumerators, p) {
	let i = 0;
	for each (let [managed, prio, e] in enumerators) {
		while (e.hasMoreElements()) {
			let f = e.getNext().QueryInterface(Ci.nsIFile);
			if (f.leafName.search(/\.json$/i) != -1) {
				try {
					let o = loadPluginFromFile(f);

					if (p.indexOf(o.id) != -1) {
						continue;
					}

					o.priority += prio;
					o.managed = managed;
					
					++i;
					yield o;
				}
				catch (ex) {
					Components.utils.reportError("Failed to load " + f.leafName);
					Components.utils.reportError(ex);
				}
			}
		}
	}
	if (lastFilters && i != lastFilters) {
		log('dtaac:plugins: notify because of new numPlugins');
		lastFilters = i;
		observer.notify();
	}
}

function enumerate(all) {
	let enums = [[true, 1, EMDirectory.directoryEntries]];
	try {
		enums.push([false, 3, UDirectory.directoryEntries]);
	}
	catch (ex) {
		// no op
	}
	let g = _enumerate(enums, all ? [] : uneval(Prefs.getCharPref('anticontainer.disabled_plugins')));
	for (let e in g) {
		yield e;
	}
}

function installFromFile(file) {
	let p = loadPluginFromFile(file);
	let pd = UDirectory.clone();
	let nn = idToFilename(p.id);
	file.copyTo(pd, nn);
	pd.append(nn);
	p.file = pd;
	observer.notify();
	return p;
}

function installFromWeb(str, updateURL) {
	let p = JSON.decode(str);
	p.fromWeb = true;
	if (!p.updateURL && updateURL) {
		p.updateURL = updateURL;
	}
	str = JSON.encode(p);
	p = validatePlugin(p);
	
	let pf = UDirectory.clone();
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
}

function uninstall(id) {
	let pf = UDirectory.clone();
	pf.append(idToFilename(id));
	if (!pf.exists()) {
		throw new Error("Cannot find plugin for id: " + id + ", tried: " + pf.path);
	}
	pf.remove(false);
	observer.notify();
}

const _store = {};
function pushPlugin(id, plug) {
	_store[id] = plug;
}
function popPlugin(id) {
	if (!(id in _store)) {
		throw new Error("plugin not found!");
	}
	let rv = _store[id];
	delete _store[id];
	return rv;
}