

import {ERRNO_CODES, ERRNO_MESSAGES} from './constants.js';

// Set after 'asm' in 'wasm-interface.js'.
let _free;	 // Used in 'syscall.js' and 'environment.js' files.
let _memset; // Used in 'syscall.js' and 'time.js' files.


const ErrnoError = function(errno, node) {
	this.node = node;

	this.setErrno = function(errno) {
		this.errno = errno;

		for (const key in ERRNO_CODES) {
			if (ERRNO_CODES[key] === errno) {

				this.code = key;

				break;
			}
		}
	};

	this.setErrno(errno);
	this.message = ERRNO_MESSAGES[errno];

	if (this.stack) {
		Object.defineProperty(this, 'stack', {
			value: 	 (new Error).stack, 
			writable: true
		});
	}
};

ErrnoError.prototype = new Error;
ErrnoError.prototype.constructor = ErrnoError;


const out = console.log.bind(console);

const err = console.warn.bind(console);


let ABORT 		 = false;
let EXITSTATUS = 0;

const abort = what => {

	if (what !== undefined) {
		out(what);
		err(what);

		what = JSON.stringify(what);
	}
	else {
		what = '';
	}

	ABORT 		 = true;
	EXITSTATUS = 1;

	throw `abort(${what}). Build with -s ASSERTIONS=1 for more info.`;
};

const assert = (condition, text) => {
	if (!condition) {
		abort(`Assertion failed: ${text}`);
	}
};


const devices = {};

const getDevice = dev => devices[dev];

const registerDevice = (dev, ops) => {
	devices[dev] = {stream_ops: ops};
};

const alignUp = (x, multiple) => {
	if (x % multiple > 0) {
		return x + (multiple - x % multiple);
	}

	return x;
};

const lengthBytesUTF8 = str => {
	let len = 0;

	for (let i = 0; i < str.length; ++i) {
		let u = str.charCodeAt(i);

		if ( u >= 55296 && u <= 57343) {
			u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
		}

		if (u <= 127) {
			++len;
		}
		else if (u <= 2047) {
			len += 2;
		}
		else if ( u<= 65535) {
			len += 3;
		}
		else if ( u <= 2097151) {
			len += 4;
		}
		else if (u <= 67108863) {
			len += 5;
		}
		else{
			len += 6;
		}
	}

	return len;
};


const stringToUTF8Array = (str, outU8Array, outIdx, maxBytesToWrite) => {
	if (!(maxBytesToWrite > 0)) { return 0; }

	const startIdx = outIdx;
	const endIdx 	 = outIdx + maxBytesToWrite - 1;

	for (let i = 0; i < str.length; ++i) {
		let u = str.charCodeAt(i);

		if (u >= 55296 && u <= 57343) {
			const u1 = str.charCodeAt(++i);

			u = 65536 + ((u & 1023) << 10) | u1 & 1023;
		}

		if (u <= 127) {
			if (outIdx >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = u;
		}
		else if (u <= 2047) {
			if (outIdx + 1 >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = 192 | u >> 6;
			outU8Array[outIdx++] = 128 | u & 63;
		}
		else if (u <= 65535) {
			if (outIdx + 2 >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = 224 | u >> 12;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63;
		}
		else if (u <= 2097151) {
			if (outIdx + 3 >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = 240 | u >> 18;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63;
		}
		else if (u <= 67108863) {
			if (outIdx + 4 >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = 248 | u >> 24;
			outU8Array[outIdx++] = 128 | u >> 18 & 63;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63;
		}
		else {
			if (outIdx + 5 >= endIdx) {
				break;
			}

			outU8Array[outIdx++] = 252 | u >> 30;
			outU8Array[outIdx++] = 128 | u >> 24 & 63;
			outU8Array[outIdx++] = 128 | u >> 18 & 63;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63;
		}
	}

	outU8Array[outIdx] = 0;

	return outIdx - startIdx;
};


const intArrayFromString = (stringy, dontAddNull, length) => {
	const len 						= length > 0 ? length : lengthBytesUTF8(stringy) + 1;
	const u8array 				= new Array(len);
	const numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);

	if (dontAddNull) {
		u8array.length = numBytesWritten;
	}

	return u8array;
};


const UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

const UTF8ArrayToString = (u8Array, idx) => {
	let endPtr = idx;

	while (u8Array[endPtr]) {
		++endPtr;
	}

	if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
		return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
	}
	else {
		let u0, u1, u2, u3, u4, u5;
		let str = '';

		while (1) {
			u0 = u8Array[idx++];

			if (!u0) { 
				return str;
			}

			if (!(u0 & 128)) {
				str += String.fromCharCode(u0);
				continue;
			}

			u1 = u8Array[idx++] & 63;

			if ((u0 & 224) == 192) {
				str += String.fromCharCode((u0 & 31) << 6 | u1);
				continue;
			}

			u2 = u8Array[idx++] & 63;

			if ((u0 & 240) == 224) {
				u0 = (u0 & 15) << 12 | u1 << 6 | u2;
			}
			else {
				u3 = u8Array[idx++] & 63;

				if ((u0 & 248) == 240) {
					u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3;
				}
				else {
					u4 = u8Array[idx++] & 63;

					if ((u0 & 252) == 248) {
						u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 <<6 | u4;
					}
					else {
						u5 = u8Array[idx++] & 63;
						u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5;
					}
				}
			}

			if (u0 < 65536) {
				str += String.fromCharCode(u0);
			}
			else {
				const ch = u0 - 65536;

				str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
			}
		}
	}
};


export {
	_free,
	_memset,
	ABORT,
	EXITSTATUS,
	ErrnoError,
	abort,
	alignUp,
	assert,
	err,
	getDevice,
	intArrayFromString,
	lengthBytesUTF8,
	out,
	registerDevice,
	stringToUTF8Array,
	UTF8ArrayToString
};
