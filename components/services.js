/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const {
	classes: Cc,
	interfaces: Ci,
	results: Cr,
	utils: Cu,
	Constructor: ctor,
	Exception: Exception
} = Components;

// Topic of dTaIFilterManager change notifications
const TOPIC_FILTERSCHANGED = 'DTA:filterschanged';

// Chrome URI for webinstall
const CHROME_URI = 'chrome://dtaac/content/webinstall.xhtml';

//Plugin maximum and download segment size
const MAX_SIZE = 1048576;
const SEG_SIZE = 16384;

const StorageStream = ctor('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');
const BufferedOutputStream = ctor('@mozilla.org/network/buffered-output-stream;1', 'nsIBufferedOutputStream', 'init');
const Converter = ctor("@mozilla.org/intl/scriptableunicodeconverter", "nsIScriptableUnicodeConverter");
const CryptoHash = ctor("@mozilla.org/security/hash;1", "nsICryptoHash", "init");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

this.__defineGetter__("require", function() Cu.import("chrome://dta-modules/content/glue.jsm", {}).require);
this.__defineGetter__("FilterManager", function getFilterManager() {
	try {
		try {
			return require("support/filtermanager").FilterManager;
		}
		catch (ex) {
			return Cc['@downthemall.net/filtermanager;2']
				.getService(Ci.dtaIFilterManager);
		}
	}
	catch (ex) {
		_hasFilterManager = false;
	}
	throw new Error("no filter manager");
});
this.__defineGetter__("Prefs", function getPrefs() {
	try {
		return require("preferences");
	}
	catch (ex) {
		let Prefs = {};
		Cu.import("resource://dta/preferences.jsm", Prefs);
		return Prefs;
	}
	throw Error("no prefs");
});
this.__defineGetter__("mergeRegs", function getMerge() {
	try {
		try {
			return require("support/regexpmerger").merge;
		}
		catch (ex) {
			Cu.reportError(ex);
			return Cu.import("resource://dta/support/regexpmerger.jsm", {}).merge;
		}
	}
	catch (ex) {
		return function merge_naive(patterns) {
			return patterns
				.map(function(r) '(?:' + r + ')')
				.join('|')
				.replace(/\//g, '\\/');
		}
	}
});
function makeReg(patterns) (new RegExp(mergeRegs(patterns), "i")).toString();

var _hasFilterManager = false;
var _mustReloadOnFM = false;

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

	get plugins() {
		let plgs = {};
		Cu.import('chrome://dtaac-modules/content/plugins.jsm', plgs);
		delete AutoFilter.prototype.plugins;
		return this.plugins = AutoFilter.prototype.plugins = plgs;
	},

	init: function af_init() {
		// install required observers, so that we may process on shutdown
		Services.obs.addObserver(this, 'xpcom-shutdown', false);
		Services.obs.addObserver(this, this.plugins.TOPIC_PLUGINSCHANGED, false);
		Services.obs.addObserver(this, TOPIC_FILTERSCHANGED, false);
	},
	dispose: function af_dispose() {
		// remove observes again
		Services.obs.removeObserver(this, 'xpcom-shutdown');
		Services.obs.removeObserver(this, this.plugins.TOPIC_PLUGINSCHANGED);
		Services.obs.removeObserver(this, TOPIC_FILTERSCHANGED);
	},

	reload: function af_reload(force) {
		try {
			let prefs = Prefs;
			let f;
			try {
				f = prefs.getExt("anticontainer.filterid", "deffilter-ac");
				f = FilterManager.getFilter(f);
			}
			catch (iex) {
				_mustReloadOnFM = force = true;
				f = FilterManager.create("AntiContainer", "anticontainer", true, 1);
				prefs.setExt("anticontainer.filterid", f.id || f);
				try {
					f = FilterManager.getFilter(f);
				}
				catch (ex) {
					Cu.reportError("reload wait");
					return;
				}
			}
			force = force || f.expression == "anticontainer";
			// generate the filter
			let ids = [];
			for (let p in this.plugins.enumerate()) {
				if (p.noFilter) {
					continue;
				}
				ids.push(p.id + p.date);
			}
			ids.toString().replace(/@downthemall\.net/g, "");
			{
				let converter = new Converter();
				converter.charset = "UTF-8";
				let idsb = converter.convertToByteArray(ids, {});
				let hash = new CryptoHash(0x4);
				hash.update(idsb, idsb.length);
				ids = hash.finish(true);
			};

			if (!force && f.expression && prefs.getExt('anticontainer.mergeids', '') == ids) {
				return;
			}

			let merged = [];
			for (let p in this.plugins.enumerate()) {
				if (p.noFilter) {
					continue;
				}
				merged.push(p.strmatch);
			}
			merged = makeReg(merged);

			// safe the filter, but only if it changed.
			if (f.expression != merged) {
				f.expression = merged;
				f.save();
			}
			prefs.setExt('anticontainer.mergeids', ids);
		}
		catch (ex) {
			Cu.reportError(ex);
		}
	},

	observe: function af_observe(subject, topic, data) {
		switch (topic) {
		case 'xpcom-shutdown':
			// release all resources
			this.dispose();
			break;

		case 'app-startup':
		case 'profile-after-change':
			try {
				this._os.removeObserver(this, 'app-startup');
			}
			catch (ex) { /* no-op */ }

			// initialize
			this.init();
			break;

		case TOPIC_FILTERSCHANGED:
			_hasFilterManager = true;
			if (_mustReloadOnFM) {
				_mustReloadOnFM = false;
				this.reload();
			}
			break;
		case this.plugins.TOPIC_PLUGINSCHANGED:
			if (_hasFilterManager) {
				this.reload(data instanceof Ci.nsISupportsPRBool ? data.data : false);
			}
			else {
				_mustReloadOnFM = true;
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
			Cu.reportError(ex);
			throw ex;
		}
	},
	onStopRequest: function(request, context, status) {
		try {
			// load the plugins module
			let plugs = {};
			Cu.import('chrome://dtaac-modules/content/plugins.jsm', plugs);

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
				Cu.reportError(ex);
				plugs.pushPlugin(chan.URI.spec, ex.toString());
			}
			input.close();

			// "Redirect" to the chrome part of the installation
			let chrome;
			if (Services.io.newChannel2) {
				chrome = Services.io.newChannel2(
					CHROME_URI, null, null,
					null, null, null,
					Ci.nsILoadInfo.SEC_NORMAL, Ci.nsIContentPolicy.TYPE_OTHER);
			}
			else {
				chrome = Services.io.newChannel(CHROME_URI, null, null);
			}
			chrome.originalURI = chan.URI;
			chrome.loadGroup = request.loadGroup;
			chrome.asyncOpen(this._listener, null);
		}
		catch (ex) {
			Cu.reportError(ex);
			throw ex;
		}
	},

	// nsIStreamListener
	onDataAvailable: function(request, context, input, offset, count) {
		try {
			this._bout.writeFrom(input, count);
		}
		catch (ex) {
			Cu.reportError(ex);
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

if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([AutoFilter, WebInstallConverter]);
}
else {
	var NSGetModule = function() XPCOMUtils.generateModule([AutoFilter, WebInstallConverter]);
}
