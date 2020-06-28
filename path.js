

// A custom shim for the node 'path' library.

import path from 'path';


const basename 	= path.basename;
const dirname 	= path.dirname;
const extname 	= path.extname;
const join 			= path.join;
const normalize = path.normalize;
const resolve 	= path.resolve;
const relative 	= path.relative;


const join2 = (l, r) => normalize(l + '/' + r);


const normalizeArray = (parts, allowAboveRoot) => {
	let up = 0;

	for(let i = parts.length - 1; i >= 0; i--) {
		const last = parts[i];

		if (last === '.') {
			parts.splice(i, 1);
		}
		else if (last === '..') {
			parts.splice(i, 1);
			up++;
		}
		else if (up) {
			parts.splice(i, 1);
			up--;
		}
	}

	if (allowAboveRoot) {
		for(; up; up--) {
			parts.unshift('..');
		}
	}

	return parts;
};


export default {
	basename,
	dirname,
	extname,
	join,
	join2,
	normalize,
	normalizeArray,
	resolve,
	relative
};
