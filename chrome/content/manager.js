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
		catch (ex) { alert(ex); /* no-op */ }
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

function acResolver() {}
acResolver.prototype = {
	run: function caR_run(download) {
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
			if (typeof inst.req.responseText != 'string')	{
				inst.req.responseText = '';
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
		this.download._acAttempt = 0;
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
	
	getSandbox: function aCR_getSandbox(fn) {
		return function() {
			let sb = Components.utils.Sandbox(this.download.urlManager.url.spec);
			let tp = this;
			function setURL(url) {
				tp.setURL(XPCSafeJSObjectWrapper(url));
			}
			function finish() {
				tp.finish();
			}
			function alert(msg) {
				window.alert(XPCSafeJSObjectWrapper(msg));
			}
			function log(msg) {
				Debug.logString("AntiContainer sandbox: " + XPCSafeJSObjectWrapper(msg));
			}
			sb.importFunction(setURL);
			sb.importFunction(finish);
			sb.importFunction(alert);
			sb.importFunction(log);
			sb.responseText = this.req ? this.req.responseText : null;
			sb.baseURL = this.download.urlManager.url.spec;
			sb.XMLHttpRequest = window.XMLHttpRequest;
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
	
	this.test = function(download) !!download.urlManager.url.spec.match(obj.match);
	this.type = obj.type;
	
	switch (this.type) {
	case 'resolver':
		this.obj.prototype.resolve = function() {
			let m = obj.finder.exec(this.req.responseText);
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
		break;
	case 'redirector':
		this.obj.prototype.process = function() {
			this.setURL(this.download.urlManager.url.spec.replace(obj.pattern, obj.replacement));
			this.finish();
		}
		break;
		
	case 'sandbox':
		if (obj.process) {
			this.obj.prototype.process = this.obj.prototype.getSandbox(obj.process);
		}
		if (obj.resolve) {
			this.obj.prototype.resolve = this.obj.prototype.getSandbox(obj.resolve);
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
	
	for each (let x in ['prefix', 'useServerName', 'generateName', 'sendInitialReferrer', 'decode', "omitReferrer"]) {
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
				alert(ex);

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
		alert(ex);
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