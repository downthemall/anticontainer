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
 * The Original Code is DownThemAll! Anti-Container auto filter creator.
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const log = Components.utils.reportError;

const TOPIC_FILTERSCHANGED = 'DTA:filterschanged';
const TOPIC_PLUGINSCHANGED = 'DTA:AC:pluginschanged';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

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

function AutoFilter() {};
AutoFilter.prototype = {
	classDescription: "DownThemAll! AutoContainer automated filter creator",
	classID: Components.ID('a650c130-22ec-11de-8c30-0800200c9a66'),
	contractID: '@downthemall.net/anticontainer/autofilter;1',
	_xpcom_categories: [{category: 'app-startup'}],
	
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference, Ci.nsIWeakReference]),
	QueryReferent: function(iid) this.QueryInterface(iid),
	GetWeakReference: function() this,
	
	get _os() {
		delete AutoFilter.prototype._os;
		return AutoFilter.prototype._os = Cc['@mozilla.org/observer-service;1']
			.getService(Ci.nsIObserverService);
	},
	get _fm() {
		delete AutoFilter.prototype._fm;
		return AutoFilter.prototype._fm = Cc['@downthemall.net/filtermanager;2']
			.getService(Components.interfaces.dtaIFilterManager);
	},
		
	get _plugins() {
		let plgs = {};
		Components.utils.import('resource://dtaac/plugins.jsm', plgs);
		return [p.strmatch for (p in plgs.enumerate())];
	},
		
	init: function af_init() {
		// install required observers, so that we may process on shutdown
		this._os.addObserver(this, 'xpcom-shutdown', false);
		this._os.addObserver(this, 'final-ui-startup', false);
		this._os.addObserver(this, TOPIC_PLUGINSCHANGED, false);
		this._os.addObserver(this, TOPIC_FILTERSCHANGED, false);
		
	},
	dispose: function af_dispose() {
		this._os.removeObserver(this, 'xpcom-shutdown');
		this._os.removeObserver(this, TOPIC_PLUGINSCHANGED);
		this._os.removeObserver(this, TOPIC_FILTERSCHANGED);
	},
	
	reload: function ad_reload() {
		log("dtaac: reload");
		let merged = '/' + merge(this._plugins).replace(/\//g, '\\/') + '/im';
		let f;
		try {
			f = this._fm.getFilter('deffilter-ac');
		}
		catch (ex) {
			// < 1.1.3 code
			try {
				f = this._fm.getFilter('extensions.dta.filters.deffilter-ac');
			}
			catch (ex) {
				log(ex);
				return;
			}
		}
		if (f.expression != merged) {
			f.expression = merged;
			f.save();
		}
	},
	
	observe: function af_observe(subject, topic, data) {
		log("dtaac:topic: " + topic);
		switch (topic) {
		case 'xpcom-shutdown':
			this.dispose();
			break;
		case 'app-startup':
			try {
				this._os.removeObserver(this, 'app-startup');
			}
			catch (ex) { /* no-op */ }
			this.init();
			break;
		case 'final-ui-startup':
			this._os.removeObserver(this, 'final-ui-startup');
			this._fm.reload();
			break;
		default:
			this.reload();
			break;
		}		
	}
};

function NSGetModule(compMgr, fileSpec) {
	return XPCOMUtils.generateModule([AutoFilter]);
}