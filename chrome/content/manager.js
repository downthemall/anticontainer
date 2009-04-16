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

var acURLMaker =  {
	_io : Serv("@mozilla.org/network/io-service;1", 'nsIIOService'),
	_cleaner: /[^/]+$/,
	
	compose: function UM_compose(base, rel) {
		var baseURI = this._io.newURI(base, null, null);
		try {
			rel = rel.replace(/&amp;/, '&');
			rel = rel.replace(/&quot;/, '"');
			rel = rel.replace(/&nbsp;/, ' ');
		}
		catch (ex) { /* no-op */ }
		var realURI = this._io.newURI(
			baseURI.resolve(rel),
			null,
			null
		);
		var copy = realURI.clone().QueryInterface(Ci.nsIURL);
		copy.query = copy.ref = '';
		var newName = copy.path;
		var m = newName.match(this._cleaner);
		if (m && m.length == 1) {
			newName = m[0];
		}
		// do we really need this stuff?
		//newName = newName.replace(/\?.*$/, '');
		return {base: baseURI, url: realURI, name: newName.getUsableFileName()};
	}
};

// lazy getter for the sandbox utility scripts
this.__defineGetter__('acSandboxScripts', function() {
	let r = new XMLHttpRequest();
	// don't try to parse as XML
	r.overrideMimeType('text/javascript');
	r.open('GET', 'chrome://dtaac/content/sandboxscripts.js', false);
	r.send(null);
	delete this.acSandboxScripts;
	this.acSandboxScripts = r.responseText;
	return this.acSandboxScripts;
});

function acResolver() {}
acResolver.prototype = {
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

		// implemented to avoid infinite retrying
		if (this.download._acAttempt >= 3) {
			
			// get it right back into the chain...
			// we pass it back to dta then
			// or we retry
			// or we process using another resolver
			
			// we're not processing anymore
			delete this.download._acProcessing;
			delete this.download._acAttempt;
			
			this.download.pause();
			try {
				Dialog.markAutoRetry(this.download);
			}
			catch (ex) {
				// Work around bug in dTa
			}
			this.download.status = _('acGrabError');
			return;
		}

		// k. starting... set the params to indicate so
		this.download._acAttempt += 1;
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
		this.req.onload = function() {
			if (!!inst.req.responseText) {
				inst.responseText = inst.req.responseText;
			}
			inst.resolve();
		};
		this.req.onerror = this.req.onload;

		// do the request
		// this should result in onreadystate calling our resolve method
		this.req.open('GET', this.download.urlManager.url.spec, true);

		if ('sendInitialReferrer' in this && this.download.referrer) {
			this.req.setRequestHeader('Referer', this.download.referrer.spec);
		}
		this.req.send(null);
	},

	// common work, hence implemented here ;)
	// resets the url for our element
	setURL: function acR_setURL(url) {
		// store the old url in case we need to redownload.
		if (!this.download._acOriginal) {
			this.download._acOriginal = this.download.urlManager;
		}

		// first reparse what we grabbed before.
		var nu = acURLMaker.compose(
			this.req ? this.req.channel.URI.spec : this.download.urlManager.url.spec,
			this.decode ? decodeURIComponent(url) : url
		);
		// set full path
		url = nu.url;

		// replace
		this.download.urlManager = new UrlManager([new DTA_URL(url)]);

		// we might want to clean the name even more ;)
		var dn = this.defaultClean(nu.name);
		if (typeof this.postClean == 'function') {
			dn = this.postClean(dn);
		}
		
		let useServerName = this.useServerName;
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
		this.download.totalSize = 0;
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
		}
			
		// do the standard work (dTa implementation)
	},

	// finishing up
	// this function has to be called by resolve in any case (even on errors)
	// or the whole element will be lost!
	finish: function DR_finish() {
		// we're not processing anymore
		delete this.download._acProcessing;
		delete this.download.compression;

		// get it right back into the chain...
		// we pass it back to dta then
		// or we retry
		// or we process using another resolver
		if (this.download.is(RUNNING)) {
			this.download.resumeDownload();
		}
	},
	defaultClean: function acR_defaultClean(n) n.replace(/^([a-z\d]{3}[_\s]|[a-z\d]{5}[_\s])/, ''),
	
	createSandbox: function() {
		if (this._sb) {
			return this._sb;
		}
		this._sb = Components.utils.Sandbox(this.download.urlManager.url.spec);		
		let sb = this._sb;
		function alert(msg) {
			window.alert(XPCSafeJSObjectWrapper(msg));
		}
		function log(msg) {
			Debug.logString("AntiContainer sandbox (" + this.prefix + "): " + XPCSafeJSObjectWrapper(msg));
		}
		
		function implementProxy(name, ctor, getters, setters, props, callbacks, functions) {
			function proxyGetters(outerObj, innerObj, getters) {
				for each (let getter in getters) {
					let _getter = getter;
					outerObj['_get_' + _getter] = function() {
						return innerObj[_getter];
					};
				}				
			}
			function proxySetters(outerObj, innerObj, setters) {
				for each (let setter in setters) {
					let _setter = setter;
					outerObj['_set_' + _setter] = function(nv) {
						return innerObj[_setter] = XPCSafeJSObjectWrapper(nv);
					};
				}				
			}
			function proxyProps(outerObj, innerObj) {
				proxyGetters.apply(this, props);
				proxySetters.apply(this, props);
			}
			function proxyFunctions(outerObj, innerObj, functions) {
				for each (let func in functions) {
					let _func = func;
					outerObj[_func] = function() {
						let args = Array.map(arguments, function(e) XPCSafeJSObjectWrapper(e));
						if (args.some(function(e) typeof e == 'function')) {
							throw Error("Do not pass functions");
						}
						return innerObj[_func].apply(innerObj, args);
					};
				}
			}
			function proxyCallbacks(outerObj, innerObj, callbacks) {
				for each (let func in callbacks) {
					let fn = null;
					outerObj['_get_' + func] = function() {
						return fn;
					};
					outerObj['_set_' + func] = function(nv) {
						return fn = nv;
					};
					innerObj[func] = function() {
						let nv = XPCSafeJSObjectWrapper(fn);
						if (typeof nv == 'string') {
							nv = '(function() { ' + nv + ';})';
						}
						else if (typeof nv == 'function') {
							sb._cb = fn;
							nv = '(function() { return _cb(); })';
						}
						else {
							throw new Error('invalid callback for ' + func);
						}
						let script = nv + '.call();';
						Components.utils.evalInSandbox(script, sb);
						delete sb._cb;							
					};
				}
			}
			sb['_' + name] = function() {
				let _o = new ctor();
				proxyGetters(this, _o, getters);
				proxySetters(this, _o, setters);
				proxyProps(this, _o, props);
				proxyFunctions(this, _o, functions);
				proxyCallbacks(this, _o, callbacks);
			}		
			
			let script = 'function ' + name + '() { this._o = new _' + name + '(); }; ' + name + '.prototype = {\n';
			for each (let getter in getters.concat(props).concat(callbacks)) {
				script += 'get ' + getter + "() { return this._o['_get_" + getter + "'](); },\n";
			}
			for each (let setter in setters.concat(props).concat(callbacks)) {
				script += 'set ' + setter + "(nv) { return this._o['_set_" + setter + "'](nv); },\n";
			}
			for each (let func in functions) {
				script += func + ": function() { return this._o['" + func + "'].apply(this._o, arguments); },\n";
			}
			script += '_wrapped: true\n};';
			Components.utils.evalInSandbox(script, sb);
		}
		implementProxy(
			'Request',
			XMLHttpRequest,
			['responseText', 'status', 'statusText'],
			[],
			[],
			['onload', 'onerror'],
			['abort', 'getAllResponseHeaders', 'getResponseHeader', 'open', 'send', 'setRequestHeader']
		);
		
		try {
			Components.utils.evalInSandbox(acSandboxScripts, sb);
		}
		catch (ex) {
			Debug.log("failed to load sanbox scripts", ex);
		}		
		sb.importFunction(alert);
		sb.importFunction(log);
		for each (let x in ['prefix', 'sendInitialReferer', 'strmatch']) {
			sb[x] = this[x];
		}
		return sb;
	},
	generateResolve: function aCR_generateResolve(obj) {
		if (!obj.finder || !obj.builder) {
			return function() { throw new Error("incomplete resolve definition"); };
		}
		return function() {
			let m = obj.finder.exec(this.responseText);
			if (m) {
				try {
					function r(str) {
						let method = 'num';
						let args = str.substr(1, str.length - 2).replace(/^([\d\w]+):/, function(a, m) { method = m; return ''; }).split(',');
						switch (method) {
						case 'num': {
							args = args.map(function(n) parseInt(n));
							if (!args.every(function(n) isFinite(n) && (n in m))) {
								throw new Error("num: not all args are numerical or available");
							}
							let rv = '';
							for each (let i in args) {
								rv += !!m[i] ? m[i] : '';
							}
							if (!rv) {
								throw new Error("num: evalutes to empty");
							}
							return rv;
						}
						case 'or': {
							args = args.map(function(n) parseInt(n));
							if (!args.every(function(n) isFinite(n) && (n in m))) {
								throw new Error("or: not all args are numerical or available")
							}
							for each (let i in args) {
								if (m[i]) {
									return m[i];
								}
							}
							throw new Error("or: not matched");
						}
						case 'replace': {
							let [num, pattern, replacement] = args;
							num = parseInt(num);
							pattern = new RegExp(pattern, 'ig');
							replacement = !!replacement ? replacement : '';
							if (!isFinite(num) || !pattern || !(num in m) && !m[num]) {
								throw new Error("replace: invalid replacement");
							}
						
							let rv = m[num].replace(pattern, replacement);
							if (!rv) {
								throw new Error("replace: replacement evalutes to nothing");
							}
							return rv;
						}
						default:
							throw new Error("invalid method: " + method);
						}
						throw new Error("never get here!");
					}
					let u = obj.builder.replace(/\{.+?\}/, r);
					if (u) {
						this.setURL(u);
					}
				}
				catch (ex) {
					Debug.log("dtaac::builder.replace", ex);
				}
			}
			this.finish();
		};		
	},
	generateSandboxed: function aCR_generateSandboxed(fn) {
		return function() {
			let sb = this.createSandbox();
			let tp = this;
			function setURL(url) {
				tp.setURL(XPCSafeJSObjectWrapper(url));
			}
			function finish() {
				tp.finish();
			}
			function process() {
				tp.process();
			}
			function resolve() {
				tp.resolve();
			}
			function defaultResolve() {
				tp.defaultResolve();
			}
			function _get_responseText() {
				return tp.responseText;
			}
			function _set_responseText(nv) {
				return tp.responseText = XPCSafeJSObjectWrapper(nv).toString();
			}

			sb.importFunction(setURL);
			sb.importFunction(finish);
			sb.importFunction(process);
			sb.importFunction(resolve);
			sb.importFunction(defaultResolve);
			sb.importFunction(_get_responseText);
			sb.importFunction(_set_responseText);
			sb.baseURL = this.download.urlManager.url.spec;
			Components.utils.evalInSandbox(fn, sb);
		};
	}
};

function acFactory(obj) {
	if (!obj.type || !obj.match || !obj.prefix) {
		throw new Error("Incompatible/Incomplete plugin");
	}
	
	this.obj = function() {};
	for (x in acResolver.prototype) {
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
			this.setURL(this.download.urlManager.url.spec.replace(obj.pattern, obj.replacement));
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
	
	for each (let x in ['type', 'prefix', 'useServerName', 'generateName', 'sendInitialReferrer', 'decode', "omitReferrer"]) {
		this.obj.prototype[x] = obj[x];
	}
}

acFactory.prototype = {
	getInstance: function() new this.obj()
};

let acFactories = [];
let acPlugins = {};
Components.utils.import('resource://dtaac/plugins.jsm', acPlugins);
for (let obj in acPlugins.enumerate()) {
	acFactories.push(new acFactory(obj));
}
acFactories.sort(function(a, b) {
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
		
		for each (let factory in acFactories) {
			if (!factory.test(this)) {
				continue;
			}
			try {
				factory.getInstance().run(this);
			}
			catch (ex) {
				delete this._acProcessing;
				Debug.log('ac::QueueItem::resumeDownload', ex);

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
		Debug.log('ac::QueueItem::resumeDownload', ex);
	}
	// no resolver for this url...
	// pass back to dTa
	return this._acResumeDownload.apply(this, arguments);
};

QueueItem.prototype._acCancel = QueueItem.prototype.cancel;
QueueItem.prototype._acReset = function acQ_reset() {
	if (this._acOriginal) {
		this.urlManager = this._acOriginal;
		delete this._acOriginal;
	}
	delete this._acProcessing;
	delete this._acAttempt;		
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