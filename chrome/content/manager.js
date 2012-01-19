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
 * The Original Code is DownThemAll! Anti-Container.
 *
 * The Initial Developer of the Original Code is Nils Maier
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Nils Maier <MaierMan@web.de>
 *   Patrick Westerhoff <PatrickWesterhoff@gmail.com>
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

(function () {
"use strict";

var Logger = DTA.Logger;
if (!Logger) {
	Logger = DTA.Debug;
}

if (!('URL' in DTA)) {
	DTA.URL = DTA_URL;
}

// there will be proxied into the sandbox.
// however, the arguments are already wrapped prior to calling
// only the defined (_properties, etc) names may be accessed from within
// the sandbox
// see the _outer_* functions
let _sandboxFactories = {};
Components.utils.import("resource://dtaac/sandboxfactories.jsm", _sandboxFactories);

function acResolver() {}
acResolver.prototype = {
	useDefaultClean: true,
	responseText: '',
	run: function acR_run(download) {
		if ('_acProcessing' in download) {
			// already running
			return;
		}

		// we're actually a c'tor
		// hence do the c'tor work
		this.download = download;
		this.download._acProcessing = true;
		if (!('_acAttempt' in this.download)) {
			this.download._acAttempt = 0;
		}
		if (!('_acGlobalAttempt' in this.download)) {
			this.download._acGlobalAttempt = 0;
		}


		// implemented to avoid infinite retrying
		if (this.download._acAttempt >= 3 || this.download._acGlobalAttempt >= 20) {

			// get it right back into the chain...
			// we pass it back to dta then
			// or we retry
			// or we process using another resolver
			try {
				if ('pauseAndRetry' in this.download) {
					this.download.pauseAndRetry();
				}
				else {
					this.download.pause();
					Dialog.markAutoRetry(this.download);
				}
			}
			catch (ex) {
				// Work around bug in dTa
			}
			this.download.status = _('acGrabError');
			return;
		}

		// k. starting... set the params to indicate so
		this.download._acAttempt += 1;
		this.download._acGlobalAttempt += 1;
		this.process();
	},

	process: function DR_process() {
		// update the marker
		this.download.status = _('acStatus', [this.prefix, this.download._acAttempt - 1]);

		// this because invalid (scopewise)...
		// doing like this gives us a valid object reference
		var inst = this;

		// init the request
		this.req = new XMLHttpRequest();
		this.req.overrideMimeType('text/plain');
		let handle = function () {
			if (!!inst.req && !!inst.req.responseText) {
				inst.status = inst.req.status;
				inst.statusText = inst.req.statusText;
				inst.responseText = inst.req.responseText;
			}
			inst.resolve();
			if (!!inst.req) {
				try { inst.req.abort(); } catch (ex) {}
				delete inst.req;
			}
			if (inst.timeout) {
				clearTimeout(inst.timeout);
				delete inst.timeout;
			}
		}
		this.req.addEventListener("load", handle, false);
		this.req.addEventListener("error", handle, false);
		this.timeout = setTimeout(handle, 10000);

		// do the request
		// this should result in onreadystate calling our resolve method
		this.req.open('GET', this.download.urlManager.url.spec, true);

		// We are not a third party, but this will give us cookies as a primary party
		if (this.req.channel && (this.req.channel instanceof Ci.nsIHttpChannelInternal)) {

			this.req.channel.forceAllowThirdPartyCookie = true;
		}

		if ('sendInitialReferrer' in this && this.download.referrer) {
			this.req.setRequestHeader('Referer', this.download.referrer.spec);
		}
		this.req.send(null);
	},

	// common work, hence implemented here ;)
	// resets the url for our element
	setURL: function acR_setURL(url) {
		// mark this download as to be removed on finish()
		if (url == null) {
			this.removeDownload = true;
			return;
		}
		this.removeDownload = false;

		// store the old url in case we need to redownload.
		if (!this.download._acOriginal && this.type != 'redirector' && !this.static) {
			this.download._acOriginal = this.download.urlManager;
		}

		// first reparse what we grabbed before.
		var nu = this.composeURL(
			this.req ? this.req.channel.URI.spec : this.download.urlManager.url.spec,
			this.decode ? decodeURIComponent(url) : url
		);
		// set full path
		url = nu.url;

		// we might want to clean the name even more ;)
		let dn = nu.name.getUsableFileName();
		if (this.useOriginName) {
			dn = this.download.urlManager.usable.getUsableFileName();
		}
		if (this.useDefaultClean) {
			dn = this.defaultClean(dn);
		}
		if (typeof this.postClean == 'function') {
			dn = this.postClean(dn);
		}

		// replace
		this.download.urlManager = new UrlManager([new DTA.URL(url)]);

		let useServerName = (this.useServerName && !this.useOriginName) || this.type == 'redirector';
		if (!dn) {
			dn = this.download.urlManager.usable.getUsableFileName();
			useServerName = true;
		}
		if (this.generateName) {
			dn = Utils.newUUIDString().replace(/\{|\}/g, '') + this.generateName;
			useServerName = false;
		}
		if (!useServerName) {
			this.download.destinationName = dn;
		}
		this._handleResuming();
		this.download.fileName = dn;

		// set the rest of this stuff.
		if (!this.omitReferrer) {
			this.download.referrer = nu.base;
		}
		else {
			this.download.referrer = null;
		}
		this.download.isResumable = true;
		this.download.postData = null;
		if (!this.factory.test(this.download)) {
			this.download._acAttempt = 0;
		}
		else if (this.type == 'redirector' || this.type == 'sandbox'){
			this.download._acAttempt += 0.2;
			this.download._acGlobalAttempt += 0.2;
		}

		// do the standard work (dTa implementation)
	},
	_handleResuming: (function() {
		if (QueueItem.prototype.hasOwnProperty('mustGetInfo')) {
			return function() {
				this.download.mustGetInfo = true;
			};
		}
		return function() {
			this.download.totalSize = 0;
		};
	})(),

	// adds a new download
	addDownload: function acR_addDownload(url) {
		if (!this.addedDownloads) {
			this.addedDownloads = [];
		}
		if (url && this.addedDownloads.indexOf(url) == -1) {
			this.addedDownloads.push(url);
		}
	},

	// marks an item as gone
	markGone: function acR_markGone(code, status) {
		code = code || 404;
		status = status || "Not found";
		let file = this.download.fileName.length > 50
			? this.download.fileName.substring(0, 50) + "..."
			: this.download.fileName;

		this.download.fail(
			_("error", [code]),
			_("failed", [file]) + " " + _("sra", [code]) + ": " + status,
			_("error", [code])
		);
	},

	// finishing up
	// this function has to be called by resolve in any case (even on errors)
	// or the whole element will be lost!
	finish: function acR_finish() {
		// we're not processing anymore
		delete this.download._acProcessing;
		delete this.download.compression;

		// check for any new downloads to spawn
		if (this.addedDownloads && this.addedDownloads.length > 0) {
			let spawningTag = Utils.newUUIDString();

			(function spawnCtor() {
				function SpawnedQueueItem(inst, url) {
					let nu = inst.composeURL(
						inst.req ? inst.req.channel.URI.spec : inst.download.urlManager.url.spec,
						inst.decode ? decodeURIComponent(url) : url
					);
					this.url = nu.url;
				}
				SpawnedQueueItem.prototype = {
					title: new String(this.download.title),
					description: this.download.description,
					referrer: this.download.referrer,
					numIstance: this.download.numInstance,
					mask: this.download.mask,
					dirSave: this.download.pathName
				};

				SpawnedQueueItem.prototype.title.spawningTag = Utils.newUUIDString();
				this.addedDownloads = this.addedDownloads.map(function(e) new SpawnedQueueItem(this, e), this);
			}).call(this);

			// add new downloads
			startDownloads(false, this.addedDownloads);

			// wait for new downloads to be added
			let ct = new CoThread(function() Tree._updating > 0, 1, this);
			ct['start' in ct ? 'start' : 'run'](function() {
				Tree.beginUpdate();
				try {
					let qis = [];

					// filter out related downloads
					Tree._downloads = Tree._downloads.filter(function(qi) {
						if (qi.title.spawningTag == spawningTag) {
							qis.unshift(qi);
							return false;
						}
						return true;
					});

					// position new downloads correctly below the current download
					let idx = this.download.position + 1;
					for (let i = 0; i < qis.length; ++i) {
						let qi = qis[i];
						Tree._downloads.splice(idx, 0, qi);
						qi.queue();
					}

					// remove current download if desired
					if (!!this.removeDownload) {
						this.download.cancel();
						Tree.remove(this.download);
					}
					else if (this.download.is(RUNNING)) {
						this.download.resumeDownload();
					}
				}
				finally {
					if ('doFilter' in Tree)
						Tree.doFilter();
					Tree.endUpdate();
					Tree.invalidate();
					delete this.addedDownloads;
					ct = null;
				}
			});
			return;
		}

		// remove current download if desired
		if (!!this.removeDownload) {
			this.download.cancel();
			Tree.remove(this.download);
		}

		// get it right back into the chain...
		// we pass it back to dta then
		// or we retry
		// or we process using another resolver
		else if (this.download.is(RUNNING)) {
			this.download.resumeDownload();
		}
	},
	defaultClean: function acR_defaultClean(n) n.replace(/^([a-z\d]{3}[_\s]|[a-z\d]{5}[_\s])/, ''),

	createSandbox: function() {
		try {
			return this._sb || (this._sb = this._createSandboxInternal());
		}
		catch (ex) {
			Logger.log("Failed to create Sandbox", ex);
			throw ex;
		}
	},
	_createSandboxInternal: function acR_createSandboxInternal() {
		function alert(msg) {
			window.alert(msg);
		}
		function log(msg) {
			(Logger.logString || Logger.log).call(Debug, "AntiContainer sandbox (" + tp.prefix + "): " + msg);
		}
		function composeURL(base, rel) {
			try {
				return this.composeURL(base, rel).url.spec;
			}
			catch (ex) {
				Logger.log("Failed to compose URL", ex);
			}
		}

		function _outer_getToken(name) {
			name = name + "_WRAP";
			if (name in _sandboxFactories) {
				let token = Utils.newUUIDString();
				_tokens[token] = new _sandboxFactories[name];
				return token;
			}
			throw new Error("No factory");
		}
		function _outer_getProperty(token, name) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._properties.indexOf(name) == -1) {
				throw new Error("Access denied; you need the red key");
			}
			return obj[name];
		}
		function _outer_setProperty(token, name, value) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._properties.indexOf(name) == -1) {
				throw new Error("Access denied; you need the red key");
			}
			obj[name] = value;
		}
		function _outer_setCallback(token, name, callback) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._callbacks.indexOf(name) == -1) {
				throw new Error("Access denied; you need the blue key");
			}
			obj[name] = callback;
		}
		function _outer_callFunction(token, name) {
			args.shift();
			args.shift();

			if (!(token in _tokens)) {
				throw new Error("Not a valid token");
			}

			let obj = _tokens[token];
			if (obj._functions.indexOf(name) == -1) {
				throw new Error("Access denied; you need the green key");
			}
			return obj[name].apply(obj, args);
		}
		function _shutdown() {
			for (let k in _tokens) {
				delete _tokens[k];
			}
		}

		this._sb = Components.utils.Sandbox(this.download.urlManager.url.spec, {
			sandboxName: "DownThemAll! AntiContainer:" + tp.prefix
		});
		let sb = this._sb;
		let tp = this;
		let _tokens = Object.create(null);

		sb.importFunction(_outer_getToken);
		sb.importFunction(_outer_getProperty);
		sb.importFunction(_outer_setProperty);
		sb.importFunction(_outer_setCallback);
		sb.importFunction(_outer_callFunction);
		sb.importFunction(_shutdown);

		try {
			Components.utils.evalInSandbox(this.SandboxScripts, sb);
		}
		catch (ex) {
			Logger.log("failed to load sandbox scripts", ex);
		}
		sb.importFunction(alert);
		sb.importFunction(log);
		sb.importFunction(composeURL);
		for each (let x in ['prefix', 'sendInitialReferer', 'strmatch']) {
			sb[x] = this[x];
		}
		return sb;
	},
	generateResolve: function aCR_generateResolve(obj) {
		if (!obj.finder || !obj.builder) {
			return function() { throw new Error("incomplete resolve definition"); };
		}
		// actual resolver
		return function() {
			if (this.status >= 400 && [401, 402, 407, 500, 502, 503, 504].indexOf(this.status) != -1) {
				this.markGone(this.status, this.statusText);
				this.finish();
				return;
			}

			let m = obj.finder.exec(this.responseText);
			if (obj.debug) {
				alert(obj.finder)
				alert(this.responseText);
				alert("m:" + m);
			}
			if (m) {
				try {
					let u = this.generateReplacement(obj.builder, m, this.download.urlManager.url.spec.match(obj.match));
					if (u) {
						this.setURL(u);
						this.finish();
						return;
					}
				}
				catch (ex) {
					Logger.log("dtaac::builder.replace", ex);
				}
			}
			if (obj.gone && this.responseText.match(obj.gone)) {
				this.markGone();
			}
			this.finish();
		};
	},
	generateSandboxed: function aCR_generateSandboxed(fn) {
		return function() {
			let sb = this.createSandbox();
			let tp = this;
			function _setURL(url) {
				tp.setURL(url);
			}
			function _addDownload(url) {
				tp.addDownload(url);
			}
			function _markGone(code, status) {
				tp.markGone(code, status);
			}
			function _finish() {
				tp.finish();
				sb._shutdown();
			}
			function _process() {
				tp.process();
			}
			function _resolve() {
				tp.resolve();
			}
			function _defaultResolve() {
				tp.defaultResolve();
			}
			function _get_responseText() {
				return tp.responseText;
			}
			function _set_responseText(nv) {
				return tp.responseText = nv.toString();
			}

			sb.importFunction(_setURL);
			sb.importFunction(_addDownload);
			sb.importFunction(_markGone);
			sb.importFunction(_finish);
			sb.importFunction(_process);
			sb.importFunction(_resolve);
			sb.importFunction(_defaultResolve);
			sb.importFunction(_get_responseText);
			sb.importFunction(_set_responseText);
			sb.baseURL = this.download.urlManager.url.spec;
			try {
				Components.utils.evalInSandbox(fn, sb);
			}
			catch (ex) {
				Logger.log("Failed to create sandboxed plugin " + this.prefix, ex);
				throw ex;
			}
		};
	},
	generateExpanded: function aCR_generateExpanded(obj) {
		if (!obj.finder || !obj.generator) {
			return function() { throw new Error("incomplete resolve definition"); };
		}
		// expand resolver
		return function() {
			if (this.status >= 400 && [401, 402, 407, 500, 502, 503, 504].indexOf(this.status) != -1) {
				this.markGone(this.status, this.statusText);
				this.finish();
				return;
			}

			let m = obj.finder.exec(this.responseText);
			if (m)
			{
				let links = [];
				let urlMatch = this.download.urlManager.url.spec.match(obj.match);
				do {
					try {
						this.addDownload(this.generateReplacement(obj.generator, m, urlMatch));
					}
					catch (ex) {
						Logger.log("dtaac::generator.replace", ex);
					}
				}
				while ((m = obj.finder.exec(this.responseText)) != null);

				// skip current download
				this.setURL(null);
			}

			if (obj.gone && this.responseText.match(obj.gone)) {
				this.markGone();
			}
			this.finish();
		};
	}
};
if (!('module' in this)) {
	this.module = Components.utils.import;
}
module('resource://dtaac/replacementgenerator.jsm', acResolver.prototype);
module('resource://dtaac/urlcomposer.jsm', acResolver.prototype);
acResolver.prototype.__defineGetter__('SandboxScripts', function() {
	delete acResolver.prototype.SandboxScripts;
	module('resource://dtaac/sandboxscripts.jsm', acResolver.prototype);
	return acResolver.prototype.SandboxScripts;
});

function acFactory(obj) {
	if (!obj.type || !obj.match || !obj.prefix) {
		throw new Error("Incompatible/Incomplete plugin");
	}

	this.obj = function() {};
	for (let x in acResolver.prototype) {
		this.obj.prototype[x] = acResolver.prototype[x];
	}
	this.obj.prototype.factory = this;

	this.test = function(download) !!download.urlManager.url.spec.match(obj.match);
	this.type = obj.type;

	switch (this.type) {
	case 'resolver':
		this.obj.prototype.resolve = acResolver.prototype.generateResolve(obj);
		break;

	case 'redirector':
		this.obj.prototype.process = function() {
			let nu = this.download.urlManager.url.spec.replace(obj.pattern, obj.replacement);
			this.setURL(nu);
			this.finish();
		}
		break;

	case 'sandbox':
		if (obj.process) {
			this.obj.prototype.process = acResolver.prototype.generateSandboxed(obj.process);
		}
		this.obj.prototype.defaultResolve = acResolver.prototype.generateResolve(obj);
		if (obj.resolve) {
			this.obj.prototype.resolve = acResolver.prototype.generateSandboxed(obj.resolve);
		}
		else {
			this.obj.prototype.resolve = this.obj.prototype.defaultResolve;
		}
		break;

	case 'expander':
		this.obj.prototype.resolve = acResolver.prototype.generateExpanded(obj);
		break;

	default:
		throw new Error("invalid plugin type");

	}

	if (obj.cleaners) {
		this.obj.prototype.postClean = function(n) {
			for each (let cleaner in obj.cleaners) {
				n = n.replace(cleaner.pattern, cleaner.replacement);
			}
			return n;
		}
	}

	for each (let x in ['type', 'prefix', 'match', 'useServerName', 'useOriginName', 'generateName', 'sendInitialReferrer', 'decode', 'omitReferrer', 'static', 'useDefaultClean']) {
		// skip unset settings to allow default values in prototype
		if (x in obj) {
			this.obj.prototype[x] = obj[x];
		}
	}
}

acFactory.prototype = {
	getInstance: function() new this.obj()
};

let acPlugins = {};
Components.utils.import('resource://dtaac/plugins.jsm', acPlugins);

function acFactoryManager() {
	this._init();
	this._reload();
}
acFactoryManager.prototype = {
	_init: function() {
		Preferences.makeObserver(this);
		Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService).addObserver(this, acPlugins.TOPIC_PLUGINSCHANGED, true);
	},
	observe: function() {
		this._reload();
	},
	_reload: function() {
		this._factories = [];
		for (let obj in acPlugins.enumerate()) {
			this._factories.push(new acFactory(obj));
		}
		this._factories.sort(function(a, b) {
			let i = a.priority - b.priority;
			if (i) {
				return i;
			}
			i = a.type < b.type ? -1 : (a.type > b.type ? 1 : 0);
			if (i) {
				return i;
			}
			return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
		});
	},
	find: function(d) {
		for each (let factory in this._factories) {
			if (factory.test(d)) {
				return factory;
			}
		}
		return null;
	}
};
let acFactories = new acFactoryManager();

// function, that restores some changed we might did to the element
// the redirect to original dta implementation
QueueItem.prototype._acRealResumeDownload = function() {
	delete this._acProcessing;
	return this._acResumeDownload.apply(this, arguments);
}

// ok... now we 'overwrite' the dta implementation

QueueItem.prototype._acResumeDownload = QueueItem.prototype.resumeDownload;
QueueItem.prototype._acOriginal = null;
QueueItem.prototype.resumeDownload = function acQ_resumeDownload() {
	try {
		// already processing
		if ('_acProcessing' in this) {
			return false;
		}

		let factory = acFactories.find(this);
		if (factory) {
			try {
				factory.getInstance().run(this);
			}
			catch (ex) {
				delete this._acProcessing;
				Logger.log('ac::QueueItem::resumeDownload', ex);

				// maybe our implementation threw...
				// in that case we might enter an infinite loop in this case
				// prevent this
				if (!('_acAttempt' in this)) {
					return this._acRealResumeDownload.apply(this, arguments);
				}
				return this.resumeDownload.apply(this, arguments);
			}
			return false;
		}
	}
	catch (ex) {
		Logger.log('ac::QueueItem::resumeDownload', ex);
	}
	// no resolver for this url...
	// pass back to dTa
	this._acReset(true);
	return this._acResumeDownload.apply(this, arguments);
};

QueueItem.prototype._acCancel = QueueItem.prototype.cancel;
QueueItem.prototype._acReset = function acQ_reset(justBookKeeping) {
	// always reset
	delete this._acProcessing;
	delete this._acAttempt;
	delete this._acGlobalAttempt;

	if (justBookKeeping) {
		return;
	}

	// non bookkeeping stuff
	if (this._acOriginal) {
		this.urlManager = this._acOriginal;
		delete this._acOriginal;
	}
}
QueueItem.prototype.cancel = function acQ_acncel() {
	this._acReset();
	return this._acCancel.apply(this, arguments);
}
QueueItem.prototype._acPause = QueueItem.prototype.pause;
QueueItem.prototype.pause = function acQ_pause() {
	this._acReset();
	return this._acPause.apply(this, arguments);
}

}).call(this);
