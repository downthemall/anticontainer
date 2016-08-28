'use strict';
let urlMatch = baseURL.match(/(?:photo\.php\?fbid=|[^\/]+\/photos\/[a-z]+\.[-.\d]+\/)(\d+).*$/);
if (urlMatch) {
	const url = 'https://www.facebook.com/ajax/pagelet/generic.php/PhotoViewerInitPagelet?__a=1&data={%22fbid%22:%22' + urlMatch[1] + '%22}';
	req(url, 'get').then(response => {
		let m = response.match(/"image":\{"\d+":\{"url":"([^"]+)"/);
		if (m) {
			return m[1].replace(/\\\//g, '/');
		}
		throw new Error('No photo URL found');
	})
	.then(url => setURL(url), error => markGone())
	.then(() => finish());
}

function req (url, method) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();
		xhr.onload = () => resolve(xhr.responseText);
		xhr.onerror = () => reject(xhr);
		xhr.open(method, url);
		xhr.send();
	});
}
