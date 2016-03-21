/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


(function () {
"use strict";

const Cu = Components.utils;
const oldDTA = !("require" in window);

const _ = Cu.import("chrome://dtaac-modules/content/l10n.jsm", {}).bundle("manager.properties");

if (!("log" in window)) {
	window.LOG_DEBUG = window.LOG_ERROR = window.LOG_INFO = 0;
	window.log = (function() {
		let Logger = DTA.Logger;
		if (!Logger) {
			Logger = DTA.Debug;
		}
		return function(ll, msg, ex) {
			if (ex) {
				Logger.log(msg, ex);
			}
			else {
				Logger.log(msg);
			}
		};
	})();
}
if (!("getUsableFileName" in Utils)) {
	if (!"".getUsableFileName) {
		Utils.extendString(String);
	}
	Utils.getUsableFileName = function(s) {
		return s.getUsableFileName();
	};
}
if (!("getUsableFileNameWithFlatten" in Utils)) {
	Utils.getUsableFileNameWithFlatten = function(s) {
		return Utils.getUsableFileName(s.replace(/[?\/\\]/g, "_"));
	};
}

const {decodeEntities} = Cu.import("chrome://dtaac-modules/content/entities.jsm", {});
const {privatizeXHR} = Cu.import("chrome://dtaac-modules/content/utils.jsm", {});

const makeFileName = function makeFileName(s) {
	// Decode any (HTML) entities.
	try {
		s = decodeEntities(s);
	}
	catch (ex) {}
	// Decode utf-8.
	try {
		s = decodeURIComponent(escape(s));
	}
	catch (ex) {}
	// Remove anything that could be considered a query-string.
	s = s.replace(/\?/g, "");
	// Final touch-up.
	return Utils.getUsableFileNameWithFlatten(s.trim());
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
Cu.import("chrome://dtaac-modules/content/sandboxfactories.jsm", _sandboxFactories);

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
			delete this.download;
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
			if (!!inst.req) {
				inst.req.removeEventListener("load", handle, false);
				inst.req.removeEventListener("error", handle, false);
				inst.req.removeEventListener("abort", handle, false);
				inst.req.removeEventListener("progress", handle, false);
			}
			if (!!inst.req && !!inst.req.responseText) {
				inst.status = inst.req.status;
				inst.statusText = inst.req.statusText;
				inst.responseText = inst.req.responseText;
			}
			if (inst.download) {
				inst.resolve();
			}
			if (!!inst.req) {
				try {
					inst.req.abort();
				} catch (ex) {}
			}
			delete inst.req;
			if (inst.timeout) {
				clearTimeout(inst.timeout);
				delete inst.timeout;
			}
		}
		this.req.addEventListener("load", handle, false);
		this.req.addEventListener("error", handle, false);
		this.req.addEventListener("abort", handle, false);
		this.timeout = setTimeout(() => handle(), 10000);

		let progress = function(e) {
			if (!inst || !inst.download) {
				try {
					this.removeEventListener("progress", progress);
				}
				catch (ex) {
					// ignore
				}
			}
			else if (('loaded' in e) && isFinite(e.loaded)) {
				inst.download.otherBytes += e.loaded - inst.lastProgress;
				inst.lastProgress = e.loaded;
			}
		};
		inst.lastProgress = 0;
		this.req.addEventListener("progress", progress);

		// do the request
		// this should result in onreadystate calling our resolve method
		let u = this.download.urlManager.url.clone();
		RequestManipulation.modifyURL(u);
		u = u.spec;
		this.req.open(this.method || 'GET', u, true);
		if (this.download.isPrivate) {
			privatizeXHR(this.req);
		}

		// We are not a third party, but this will give us cookies as a primary party
		if (this.req.channel && (this.req.channel instanceof Ci.nsIHttpChannelInternal)) {
			this.req.channel.forceAllowThirdPartyCookie = true;
		}

		if ('sendInitialReferrer' in this && this.download.referrer) {
			this.req.setRequestHeader('Referer', this.download.referrer.spec);
		}

		let pd = null;
		if (this.postdata) {
			if (typeof(this.postdata) == "string") {
				pd = this.postdata;
			}
			else {
				pd = new FormData();
				for (let x in this.postdata) {
					pd.append(x, this.postdata[x]);
				}
			}
		}
		this.req.send(pd);
	},

	// common work, hence implemented here ;)
	// resets the url for our element
	setURL: function acR_setURL(url, nameSuggestion) {
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
		let urld = url;
		if (this.decode) {
			try {
				urld = decodeURIComponent(urld);
			}
			catch (ex) {
				log(LOG_ERROR, "failed to decode url", ex);
			}
		}
		var nu = this.composeURL(
			this.req ? this.req.channel.URI.spec : this.download.urlManager.url.spec,
			urld
		);
		// set full path
		url = nu.url;

		// we might want to clean the name even more ;)
		let dn;
		try {
			dn = Utils.getUsableFileName(nu.name);
			if (!!nameSuggestion) {
				dn = makeFileName(nameSuggestion);
			}
			else if (this.useOriginName) {
				dn = Utils.getUsableFileName(this.download.urlManager.usable);
			}
		}
		catch (ex) {
			dn = Utils.getUsableFileName(nu.name);
			if (this.useOriginName) {
				dn = Utils.getUsableFileName(this.download.urlManager.usable);
			}
			log(LOG_DEBUG, "dn init", ex);
		}

		// replace
		this.download.urlManager = new UrlManager([new DTA.URL(url)]);
		log(LOG_DEBUG, "set url to " + url.spec);

		let useServerName = (this.useServerName && !this.useOriginName) || this.type == 'redirector';
		if (!dn) {
			dn = Utils.getUsableFileName(this.download.urlManager.usable);
			useServerName = true;
		}

		if (this.generateName) {
			dn = Utils.newUUIDString().replace(/\{|\}/g, '') + this.generateName;
			useServerName = false;
		}
		if (dn) {
			try {
				dn = decodeURIComponent(dn);
			}
			catch (ex) {
				log(LOG_ERROR, "failed to decode dn " + dn);
			}
		}
		if (this.useDefaultClean) {
			dn = this.defaultClean(dn);
		}
		if (typeof this.postClean == 'function') {
			dn = this.postClean(dn);
		}

		if (!useServerName && oldDTA) {
			this.download.destinationName = dn;
			log(LOG_DEBUG, "set dn to " + dn);
		}

		this._handleResuming();
		if (this.download.setUserFileName && !useServerName) {
			this.download.setUserFileName(dn);
		}
		else {
			this.download.fileName = dn;
		}

		// set the rest of this stuff.
		if (this.omitReferrer) {
			this.download.referrer = null;
		}
		else if (this.keepReferrer) {
			// no op
		}
		else {
			this.download.referrer = nu.base;
			log(LOG_DEBUG, "set ref to " + nu.base.spec);
		}
		this.download.isResumable = true;
		this.download.postData = null;
		if (!this.factory.test(this.download.urlManager.url.spec)) {
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
	queueDownload: function(url, nameSuggestion) {
		if (!this.addedDownloads) {
			this.addedDownloads = [];
		}
		if (url && this.addedDownloads.indexOf(url) == -1) {
			this.addedDownloads.push({url: url, nameSuggestion: nameSuggestion});
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
			if (this.addedDownloads.length == 0) {
				this.setURL(this.addedDownloads[0].url, this.addedDownloads[0].nameSuggestion);
			}
			else {
				log(LOG_DEBUG, "Generated " + this.addedDownloads.length);
				let spawningTag = Utils.newUUIDString();

				const series = {};
				XPCOMUtils.defineLazyGetter(series, "num", function() {
					let rv = DTA.currentSeries();
					DTA.incrementSeries();
					return rv;
				});
				const newNumForSpawned = Preferences.getExt("anticontainer.newnumforspawned", false);

				(function spawnCtor() {
					function SpawnedQueueItem(inst, item) {
						let nu = inst.composeURL(
							inst.req ? inst.req.channel.URI.spec : inst.download.urlManager.url.spec,
							inst.decode ? decodeURIComponent(item.url) : item.url
						);
						this.url = nu.url;
						if (!!item.nameSuggestion) {
							this.destinationName = this.fileName = makeFileName(item.nameSuggestion);
						}
					}
					SpawnedQueueItem.prototype = {
						title: this.download.title,
						description: this.download.description,
						referrer: this.download.referrer && this.download.referrer.spec,
						numIstance: newNumForSpawned ? series.num : (this.download.numInstance || this.download.bNum),
						mask: this.download.mask,
						dirSave: this.download.pathName,
						isPrivate: this.download.isPrivate,
						startDate: this.download.startDate
					};

					this.addedDownloads = this.addedDownloads.map(e => new SpawnedQueueItem(this, e));
				}).call(this);

				// add new downloads
				startDownloads(true /* since this download was running already */, this.addedDownloads, false);
				this.removeDownload = true;
			}
			delete this.addedDownloads;
		}

		// remove current download if desired
		if (!!this.removeDownload) {
			this.download.cancel();
			Tree.remove(this.download);
			log(LOG_DEBUG, "Removed");
		}

		// get it right back into the chain...
		// we pass it back to dta then
		// or we retry
		// or we process using another resolver
		else if (this.download.is(RUNNING)) {
			this.download.resumeDownload();
			log(LOG_DEBUG, "Resumed");
		}
		delete this.download;
	},
	defaultClean: function acR_defaultClean(n) {
		return n.replace(/^[a-z\d]{3}[_\s]|^[._-]+|[._-]+$/g, '');
	},

	createSandbox: function() {
		try {
			return this._sb || (this._sb = this._createSandboxInternal());
		}
		catch (ex) {
			log(LOG_ERROR, "Failed to create a sandbox", ex);
			throw ex;
		}
	},
	_createSandboxInternal: function acR_createSandboxInternal() {
		let tp = this;
		let sb = this._sb = Components.utils.Sandbox(this.download.urlManager.url.spec, {
			sandboxName: "DownThemAll! AntiContainer:" + tp.prefix
		});
		let _tokens = Object.create(null);

		sb._outer_getToken = function _outer_getToken(name) {
			name = name + "_WRAP";
			if (name in _sandboxFactories) {
				let token = Utils.newUUIDString();
				_tokens[token] = new _sandboxFactories[name](tp.download);
				return token;
			}
			throw new Error("No factory");
		}
		sb._outer_getProperty = function _outer_getProperty(token, name) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._properties.indexOf(name) == -1) {
				throw new Error("Access denied; you need the red key");
			}
			return obj[name];
		}
		sb._outer_setProperty = function _outer_setProperty(token, name, value) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._properties.indexOf(name) == -1) {
				throw new Error("Access denied; you need the red key");
			}
			obj[name] = value;
		}
		sb._outer_setCallback = function _outer_setCallback(token, name, callback) {
			if (!(token in _tokens)) {
				throw new Error("Not a valid token: " + token);
			}
			let obj = _tokens[token];
			if (obj._callbacks.indexOf(name) == -1) {
				throw new Error("Access denied; you need the blue key");
			}
			obj[name] = callback;
		}
		sb._outer_callFunction = function _outer_callFunction(token, name) {
			let args = Array.slice(arguments, 2);
			if (!(token in _tokens)) {
				throw new Error("Not a valid token");
			}

			let obj = _tokens[token];
			if (obj._functions.indexOf(name) == -1) {
				throw new Error("Access denied; you need the green key");
			}
			return obj[name].apply(obj, args);
		};
		sb._shutdown = function _shutdown() {
			for (let k in _tokens) {
				delete _tokens[k];
			}
		};

		try {
			// AMO-Editors: this is a local resource.
			// See: sandboxscripts.js
			Components.utils.evalInSandbox(this.getSandboxScripts(), sb, "latest", "chrome://dtaac/content/sandboxscripts.js", 1);
		}
		catch (ex) {
			log(LOG_ERROR, "failed to load sandbox scripts", ex);
		}
		sb.alert = function alert(msg) {
			window.alert(msg);
		};
		sb.log = function log(msg) {
			window.log(LOG_DEBUG, "AntiContainer sandbox (" + tp.prefix + "): " + msg);
		};
		sb.composeURL = function composeURL(base, rel) {
			try {
				return acResolver.prototype.composeURL(base, rel).url.spec;
			}
			catch (ex) {
				log(LOG_ERROR, "Failed to compose URL", ex);
				throw ex;
			}
		};

		for (let x of ['prefix', 'sendInitialReferer', 'strmatch']) {
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
					let name = null;
					let u = this.generateReplacement(obj.builder, m, this.download.urlManager.url.spec.match(obj.match));
					if ("namer" in obj) {
						name = this.generateReplacement(obj.namer, m, this.download.urlManager.url.spec.match(obj.match));
					}
					if (u) {
						this.setURL(u, name);
						this.finish();
						return;
					}
				}
				catch (ex) {
					log(LOG_ERROR, "dtaac::builder.replace", ex);
				}
			}
			if (obj.gone && this.responseText.match(obj.gone)) {
				this.markGone();
			}
			this.finish();
		};
	},
	generateSandboxed: function aCR_generateSandboxed(fn, fnname) {
		return function() {
			let sb = this.createSandbox();
			let tp = this;
			sb._setURL = function _setURL(url, nameSuggestion) {
				tp.setURL(url, nameSuggestion);
			};
			sb._queueDownload = function _queueDownload(url, nameSuggestion) {
				tp.queueDownload(url, nameSuggestion);
			};
			sb._markGone = function _markGone(code, status) {
				tp.markGone(code, status);
			};
			sb._finish = function _finish() {
				tp.finish();
				sb._shutdown();
			};
			sb._process = function _process() {
				tp.process();
			};
			sb._resolve = function _resolve() {
				tp.resolve();
			};
			sb._defaultResolve = function _defaultResolve() {
				tp.defaultResolve();
			};
			sb._get_responseText = function _get_responseText() {
				return tp.responseText;
			};
			sb._set_responseText = function _set_responseText(nv) {
				return tp.responseText = nv.toString();
			};

			try {
				sb.baseURL = this.download.urlManager.url.spec;

				// AMO-Editors: this executes a plugin script in the Sandbox.
				// This isn't new code, but around for years in AMO-approved versions of this
				// add-on.
				//
				// One one hand, such plugin scripts are pretty limited as the above functions
				// detail. One the other hand, they have powerful XHR (but sans cookie-reading
				// and direct DOM access; just "string" access).
				// All-in-all they might be (almost) as dangerous as Greasemonkey user-scripts.
				// As with GM user-scripts the user has to manually install new plugins.
				Components.utils.evalInSandbox(fn, sb, "latest", this.prefix + "-" + fnname, 1);
			}
			catch (ex) {
				log(LOG_ERROR, "Failed to create or execute sandboxed plugin " + this.prefix, ex);
				sb._finish();
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
			log(LOG_DEBUG, "found " + m);
			if (m) {
				let links = [];
				let urlMatch = this.download.urlManager.url.spec.match(obj.match);
				do {
					try {
						log(LOG_DEBUG, m + " " + urlMatch);
						let name = null;
						let url = this.generateReplacement(obj.generator, m, urlMatch);
						if ("namer" in obj) {
							name = this.generateReplacement(obj.namer, m, urlMatch);
						}
						this.queueDownload(url, name);
					}
					catch (ex) {
						log(LOG_ERROR, "dtaac::generator.replace", ex);
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
Cu.import('chrome://dtaac-modules/content/replacementgenerator.jsm', acResolver.prototype);
Cu.import('chrome://dtaac-modules/content/urlcomposer.jsm', acResolver.prototype);
Cu.import('chrome://dtaac-modules/content/sandboxscripts.jsm', acResolver.prototype);

function acFactory(obj) {
	if (!obj.type || !obj.match || !obj.prefix) {
		throw new Error("Incompatible/Incomplete plugin");
	}

	this.obj = function() {};
	for (let x in acResolver.prototype) {
		this.obj.prototype[x] = acResolver.prototype[x];
	}
	this.obj.prototype.factory = this;

	this.test = function(url) { return !!url.match(obj.match); };
	this.type = obj.type;
	this.prefix = obj.prefix;

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
			this.obj.prototype.process = acResolver.prototype.generateSandboxed(obj.process, "process");
		}
		this.obj.prototype.defaultResolve = acResolver.prototype.generateResolve(obj);
		if (obj.resolve) {
			this.obj.prototype.resolve = acResolver.prototype.generateSandboxed(obj.resolve, "resolve");
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
			for (let cleaner of obj.cleaners) {
				n = n.replace(cleaner.pattern, cleaner.replacement);
			}
			return n;
		}
	}

	for (let x of ['type', 'prefix', 'match', 'useServerName', 'useOriginName', 'generateName', 'sendInitialReferrer', 'decode', 'method', 'postdata', 'omitReferrer', 'static', 'useDefaultClean']) {
		// skip unset settings to allow default values in prototype
		if (x in obj) {
			this.obj.prototype[x] = obj[x];
		}
	}
}

acFactory.prototype = {
	getInstance: function() { return new this.obj(); },
	toString: function() { return "[" + this.prefix + "; " + this.type + "]"; }
};

let acPlugins = {};
Cu.import('chrome://dtaac-modules/content/plugins.jsm', acPlugins);

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
		for (let factory of this._factories) {
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
			log(LOG_DEBUG, "already");
			return false;
		}

		const spec = this.urlManager.url.spec;
		let factory = acFactories.find(spec);
		if (factory) {
			log(LOG_DEBUG, spec + ": found factory " + factory);
			try {
				factory.getInstance().run(this);
			}
			catch (ex) {
				delete this._acProcessing;
				log(LOG_ERROR, 'ac::QueueItem::resumeDownload', ex);

				// maybe our implementation threw...
				// in that case we might enter an infinite loop in this case
				// prevent this
				if (!('_acAttempt' in this)) {
					return this._acRealResumeDownload.apply(this, arguments);
				}
				return this.resumeDownload.apply(this, arguments);
			}
			log(LOG_DEBUG, spec + ": handled");
			return false;
		}
		else {
			log(LOG_DEBUG, spec + ": no factory");
		}
	}
	catch (ex) {
		log(LOG_ERROR, 'ac::QueueItem::resumeDownload', ex);
	}
	log(LOG_DEBUG, "reset + pass");
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

RequestManipulation.registerHttp(
	"anticontainer - imgur",
	/imgur/,
	function() {
		this.setRequestHeader(
			"Accept",
			"video/mp4;q=0.9,video/webm;q=0.8",
			true
			);
	}
);
RequestManipulation.registerURL(
	"anticontainer - imagefap full gallery",
	/^http:\/\/.*imagefap\.com\/(?:gallery|pictures)/,
	function() {
		if (this.spec.indexOf("view=2") < 0) {
			if (this.spec.indexOf("?") < 0) {
				this.spec = this.spec + "?view=2";
			}
			else {
				this.spec = this.spec + "&view=2";
			}
		}
	}
);

}).call(this);
