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
 * The Original Code is DownThemAll! Anti-Container web install stream converter.
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

/**
 * WebInstall implements a streamconverter that will care about application/x-anticontainer-plugin.
 * It will fetch the content and "redirect" to the chrome part, content/webinstall.xhtml, which
 * then handles the rest of the installation
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const log = Components.utils.reportError;

// URI to the chrome part
const CHROME_URI = 'chrome://dtaac/content/webinstall.xhtml';

// Plugin maximum and download segment size
const MAX_SIZE = 1048576;
const SEG_SIZE = 16384;
	
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const StorageStream = Components.Constructor('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');
const BufferedOutputStream = Components.Constructor('@mozilla.org/network/buffered-output-stream;1', 'nsIBufferedOutputStream', 'init');

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
	convert: function() Cr.NS_ERROR_NOT_IMPLEMENTED,
	asyncConvertData: function(from, to, listener, context) {
		// need to store this so that we later can instruct our
		// chrome channel to push data over to it.
		this._listener = listener;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return XPCOMUtils.generateModule([WebInstallConverter]);
}