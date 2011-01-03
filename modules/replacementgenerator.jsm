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
 * The Original Code is DownThemAll! Anti-Container replacement generator module
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

const EXPORTED_SYMBOLS = ['generateReplacement'];

function num_replace(args, match) {
	args = args.map(function(n) parseInt(n));
	if (!args.every(function(n) isFinite(n) && (n in match))) {
		throw new Error("num: not all args are numerical or available");
	}
	let rv = '';
	for each (let i in args) {
		rv += match[i] || '';
	}
	if (!rv) {
		throw new Error("num: evalutes to empty");
	}
	return rv;	
}

function or_replace(args, match) {
	args = args.map(function(n) parseInt(n));
	if (!args.every(function(n) isFinite(n) && (n in match))) {
		throw new Error("or: not all args are numerical or available")
	}
	for each (let i in args) {
		if (match[i]) {
			return match[i];
		}
	}
	throw new Error("or: not matched");	
}

function rep_replace(args, match) {
	let [num, pattern, replacement] = args;
	num = parseInt(num);
	pattern = new RegExp(pattern, 'ig');
	replacement = replacement || '';
	if (!isFinite(num) || !pattern || !(num in match) && !match[num]) {
		throw new Error("replace: invalid replacement");
	}

	let rv = match[num].replace(pattern, replacement);
	if (!rv) {
		throw new Error("replace: replacement evalutes to nothing");
	}
	return rv;
}

function url_replace(args, match, urlMatch) {
	if (!urlMatch) {
		throw new Error("url: url match is not available");
	}
	args = args.map(function(n) parseInt(n));
	if (!args.every(function(n) isFinite(n) && (n in urlMatch))) {
		throw new Error("url: not all args are numerical or available");
	}
	let rv = '';
	for each (let i in args) {
		rv += urlMatch[i] || '';
	}
	return rv;
}

const replacements = {
	'num': num_replace,
	'or': or_replace,
	'replace': rep_replace,
	'url': url_replace
};

function _replace(str, match, urlMatch) {
	let method = 'num';
	let args = str.substr(1, str.length - 2)
		.replace(/^([\d\w]+):/, function(a, m) { method = m; return ''; })
		.split(',');
	if (!(method in replacements)) {
		throw new Error("invalid method: " + method);
	}
	return replacements[method](args, match, urlMatch);
}

function generateReplacement(builder, match){
	let inst = this;
	return builder.replace(/\{.+?\}/g, function(str) _replace(str, match, inst.match));
}