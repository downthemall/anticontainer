/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ['generateReplacement'];

function num_replace(args, match) {
	args = args.map(function(n) parseInt(n));
	if (!args.every(function(n) isFinite(n) && (n in match))) {
		throw new Error("num: not all args are numerical or available");
	}
	let rv = '';
	for each (let i in args) {
		rv += match[i] || '';
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

function generateReplacement(builder, match, urlMatch) builder.replace(/\{.+?\}/g, function(str) _replace(str, match, urlMatch));
