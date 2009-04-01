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
			
			this.download.status = _('acGrabError');
			this.download.pause();
			Dialog.markAutoRetry(this.download);
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

		if ('sendReferer' in this && this.download.referrer) {
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
		if (!useServerName) {
			this.download.destinationName = dn;
		}
		this.download.totalSize = 0;
		this.download.fileName = dn;

		// set the rest of this stuff.
		this.download.referrer = nu.base;
		this.download.isResumable = true;
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
			sb.importFunction(setURL);
			sb.importFunction(finish);
			sb.importFunction(alert);
			sb.responseText = this.req.responseText;
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
				function r(str) {
					let num = parseInt(str.substr(1, str.length - 2));
					if (!isFinite(num) || !(num in m)) {
						return '';
					}
					return m[num];
				}
				this.setURL(obj.builder.replace(/\{\d+\}/, r));
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
	
	for each (let x in ['prefix', 'useServerName', 'sendReferrer', 'decode']) {
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