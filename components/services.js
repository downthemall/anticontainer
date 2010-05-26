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
 * The Original Code is DownThemAll! Anti-Container Services.
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2010
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const module = Cu.import;
const log = Cu.reportError;
const Ctor = Components.Constructor;
const Exception = Components.Exception;

// Topic of dTaIFilterManager change notifications
const TOPIC_FILTERSCHANGED = 'DTA:filterschanged';

// Chrome URI for webinstall
const CHROME_URI = 'chrome://dtaac/content/webinstall.xhtml';

//Plugin maximum and download segment size
const MAX_SIZE = 1048576;
const SEG_SIZE = 16384;

const StorageStream = Ctor('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');
const BufferedOutputStream = Ctor('@mozilla.org/network/buffered-output-stream;1', 'nsIBufferedOutputStream', 'init');

module("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Utilities...
 * However these are currently not in use, as they produce wrong results
 */
String.prototype.count = function(s) {
	return Array.reduce(this, function(c, a) c + (s.indexOf(a) != -1 ? 1 : 0), 0);
}

function commonprefix(m) {
	let [s1, s2] = m; 
	let n = Math.min(s1.length, s2.length);
	for (let i = 0; i < n; ++i) {
		if (s1[i] != s2[i]) {
			return s1.slice(0, i);
		}
	}
	return s1.slice(0, n);
}

function icombine(arr) {
	for (let i = 0, e = arr.length; i < e - 1; ++i) {
		for (let j = i + 1; j < e; ++j) {
			yield [arr[i], arr[j]];
		}
	} 
}
function combine(arr) {
	return [a for (a in icombine(arr))];
}

function biggestgroup(slist, fngroup) {
	let d = {};
	for each (let x in combine(slist)) {
		let k = fngroup(x);
		if (!k || k.count('(') != k.count(')')) {
			continue;
		}
		if (!(k in d)) {
			d[k] = x;
		}
		else {
			k = d[k];
			x.forEach(function(e) k.push(e)); 
		}
	}
	let fix = null;
	let max = 0;
	for (let k in d) {
		let m = k.length;
		if (max < m) {
			max = m;
			fix = k;
		}
	}
	if (!fix) {
		return [null, null];
	}
	let rlist = [];
	for each (let i in d[fix]) {
		if (rlist.indexOf(i) == -1) {
			rlist.push(i);
		}
	}
	return [fix, rlist];
}

function merge(slist) {
	while (slist.length) {
		let [pre, prelist] = biggestgroup(slist, commonprefix);
		if (!pre) {
			break;
		}
		slist = slist.filter(function(e) prelist.indexOf(e) == -1);
		prelist = prelist.map(function(e) e.slice(pre.length));
		if (prelist.length > 1) {
			slist.push(pre + "(?:" + prelist.join("|") + ")");
		}
		else {
			slist.push(pre + prelist.join(""));
		}
	}
	return slist.join("|");
}

var _hasFilterManager = false;

/**
 * Autofilter watches for changes to AntiContainer plugins.
 * On application start and whenever changes with the plugins are observed
 * a updated DownThemAll! filter is generated and installed.
 */
function AutoFilter() {};
AutoFilter.prototype = {
	classDescription: "DownThemAll! AutoContainer automated filter creator",
	classID: Components.ID('a650c130-22ec-11de-8c30-0800200c9a66'),
	contractID: '@downthemall.net/anticontainer/autofilter;1',
	_xpcom_categories: [{category: 'app-startup'}],
	
	// implement weak so that we can install a weak observer and won't leak under any circumstances
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference, Ci.nsIWeakReference]),
	QueryReferent: function(iid) this.QueryInterface(iid),
	GetWeakReference: function() this,
	
	get _os() {
		return Cc['@mozilla.org/observer-service;1']
			.getService(Ci.nsIObserverService);
	},
	get _fm() {
		return Cc['@downthemall.net/filtermanager;2']
			.getService(Components.interfaces.dtaIFilterManager);
	},
	
	get plugins() {
		let plgs = {};
		Components.utils.import('resource://dtaac/plugins.jsm', plgs);
		delete AutoFilter.prototype.plugins;
		return this.plugins = AutoFilter.prototype.plugins = plgs;
	},
		
	get allPlugins() {
		return [p.strmatch for (p in this.plugins.enumerate()) if (!p.noFilter)];
	},
		
	init: function af_init() {
		// install required observers, so that we may process on shutdown
		this._os.addObserver(this, 'xpcom-shutdown', false);
		this._os.addObserver(this, this.plugins.TOPIC_PLUGINSCHANGED, false);
		this._os.addObserver(this, TOPIC_FILTERSCHANGED, false);
		
	},
	dispose: function af_dispose() {
		// remove observes again
		this._os.removeObserver(this, 'xpcom-shutdown');
		this._os.removeObserver(this, this.plugins.TOPIC_PLUGINSCHANGED);
		this._os.removeObserver(this, TOPIC_FILTERSCHANGED);
	},
	
	reload: function af_reload() {
		try {
			// generate the filter
			let merged = '/'
				+ this.allPlugins
					.map(function(r) '(?:' + r + ')')
					.join('|')
					.replace(/\//g, '\\/')
				+ '/i';
			// this doesn't work atm
			//let merged = '/' + merge(this._plugins).replace(/\//g, '\\/') + '/i';
			
			// try to get the filter incl. dta1.1 compat
			let f;
			try {
				f = this._fm.getFilter('deffilter-ac');
			}
			catch (ex) {
				log("dtaac: autofilter reload < 1.1.3 compat");
				// < 1.1.3 code
				try {
					f = this._fm.getFilter('extensions.dta.filters.deffilter-ac');
				}
				catch (ex) {
					log(ex);
					return;
				}
			}
			// safe the filter, but only if it changed.
			if (f.expression != merged) {
				f.expression = merged;
				f.save();
			}
		}
		catch (ex) {
			log(ex);
		}
	},
	
	observe: function af_observe(subject, topic, data) {
		switch (topic) {
		case 'xpcom-shutdown':
			// release all resources
			this.dispose();
			break;
			
		case 'app-startup':
			try {
				this._os.removeObserver(this, 'app-startup');
			}
			catch (ex) { /* no-op */ }
			
			// initialize
			this.init();
			break;
			
		case TOPIC_FILTERSCHANGED:
			_hasFilterManager = true;
			break;
		case this.plugins.TOPIC_PLUGINSCHANGED:
			if (_hasFilterManager) {
				this.reload();
			}
			break;
		}		
	}
};

/**
 * WebInstall implements a streamconverter that will care about application/x-anticontainer-plugin.
 * It will fetch the content and "redirect" to the chrome part, content/webinstall.xhtml, which
 * then handles the rest of the installation
 */
function WebInstallConverter() {};
WebInstallConverter.prototype = {
	classDescription: "DownThemAll! AutoContainer webinstall stream converter",
	classID: Components.ID('3d349f10-2a07-11de-8c30-0800200c9a66'),
	contractID: '@mozilla.org/streamconv;1?from=application/x-anticontainer-plugin&to=*/*',
	
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamConverter, Ci.nsIStreamListener, Ci.nsIRequestObserver]),
	
	// nsIRequestObserver
	onStartRequest: function(request, context) {
		try {
			// we only care about real channels
			// it it is not this throws
			let chan = request.QueryInterface(Ci.nsIChannel);
			
			// initialize the storage stream to keep the plugin
			this._storage = new StorageStream(SEG_SIZE, MAX_SIZE, null); 
			this._out = this._storage.getOutputStream(0);
			// storagestream does not support writeFrom :p
			this._bout = new BufferedOutputStream(this._out, SEG_SIZE);
		}
		catch (ex) {
			log(ex);
			throw ex;
		}
	},
	onStopRequest: function(request, context, status) {
		try {
			// load the plugins module
			let plugs = {};
			Components.utils.import('resource://dtaac/plugins.jsm', plugs);
			
			// close the storage stream output
			this._bout.flush();
			this._out.close();

			// try to validate and store the plugin
			let input = this._storage.newInputStream(0);
			let chan = request.QueryInterface(Ci.nsIChannel);
			try {
				let p = plugs.loadPluginFromStream(input);
				plugs.pushPlugin(chan.URI.spec, p);
			}
			catch (ex) {
				log(ex);
				plugs.pushPlugin(chan.URI.spec, ex.toString());
			}
			input.close();

			// "Redirect" to the chrome part of the installation
			let io = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
			let chrome = io.newChannel(CHROME_URI, null, null);
			chrome.originalURI = chan.URI;
			chrome.loadGroup = request.loadGroup;
			chrome.asyncOpen(this._listener, null);
		}
		catch (ex) {
			log(ex);
			throw ex;
		}
	},
	
	// nsIStreamListener
	onDataAvailable: function(request, context, input, offset, count) {
		try {
			this._bout.writeFrom(input, count);
		}
		catch (ex) {
			log(ex);
			throw ex;
		}
	},
	
	// nsIStreamConverter
	convert: function() {
		throw Cr.NS_ERROR_NOT_IMPLEMENTED
	},
	asyncConvertData: function(from, to, listener, context) {
		if (!_hasFilterManager) {
			throw Cr.NS_ERROR_NOT_IMPLEMENTED;
		}
		// need to store this so that we later can instruct our
		// chrome channel to push data over to it.
		this._listener = listener;
	}
};

function NSGetModule() XPCOMUtils.generateModule([AutoFilter, WebInstallConverter]);