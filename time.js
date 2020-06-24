

import {_memset} from './utils.js';

// Set after 'asm' in 'wasm-interface.js'.
let __get_daylight;
let __get_timezone;
let __get_tzname;


function _gettimeofday(ptr) {
	var now = Date.now();

	HEAP32[ptr >> 2] 		 = now / 1e3 | 0;
	HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;

	return 0;
}

var ___tm_timezone = allocate(intArrayFromString('GMT'), 'i8', ALLOC_STATIC);

function _gmtime_r(time, tmPtr) {
	var date = new Date(HEAP32[time >> 2] * 1e3);

	HEAP32[tmPtr >> 2] 			= date.getUTCSeconds();
	HEAP32[tmPtr + 4 >> 2] 	= date.getUTCMinutes();
	HEAP32[tmPtr + 8 >> 2] 	= date.getUTCHours();
	HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
	HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
	HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
	HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
	HEAP32[tmPtr + 36 >> 2] = 0;
	HEAP32[tmPtr + 32 >> 2] = 0;

	var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
	var yday 	= (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;

	HEAP32[tmPtr + 28 >> 2] = yday;
	HEAP32[tmPtr + 40 >> 2] = ___tm_timezone;

	return tmPtr;
}



function _tzset() {
	if (_tzset.called) { return; }

	_tzset.called = true;

	HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;

	var winter = new Date(2e3, 0, 1);
	var summer = new Date(2e3, 6, 1);

	HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());

	function extractZone(date) {
		var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);

		return match ? match[1] : 'GMT';
	}


	const ALLOC_NORMAL = 0;

	var winterName 		= extractZone(winter);
	var summerName 		= extractZone(summer);
	var winterNamePtr = allocate(intArrayFromString(winterName), 'i8', ALLOC_NORMAL);
	var summerNamePtr = allocate(intArrayFromString(summerName), 'i8', ALLOC_NORMAL);

	if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
		HEAP32[__get_tzname() >> 2] = winterNamePtr;
		HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr;
	}
	else {
		HEAP32[__get_tzname() >> 2] = summerNamePtr;
		HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr;
	}
}

function _localtime_r(time, tmPtr) {
	_tzset();

	var date = new Date(HEAP32[time >> 2] * 1e3);

	HEAP32[tmPtr >> 2] 			= date.getSeconds();
	HEAP32[tmPtr + 4 >> 2] 	= date.getMinutes();
	HEAP32[tmPtr + 8 >> 2] 	= date.getHours();
	HEAP32[tmPtr + 12 >> 2] = date.getDate();
	HEAP32[tmPtr + 16 >> 2] = date.getMonth();
	HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
	HEAP32[tmPtr + 24 >> 2] = date.getDay();

	var start = new Date(date.getFullYear(), 0, 1);
	var yday 	= (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;

	HEAP32[tmPtr + 28 >> 2] = yday;
	HEAP32[tmPtr + 36 >> 2] =- (date.getTimezoneOffset() * 60);

	var summerOffset = (new Date(2e3, 6, 1)).getTimezoneOffset();
	var winterOffset = start.getTimezoneOffset();

	var dst = (
		summerOffset != winterOffset && 
		date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)
	) | 0;

	HEAP32[tmPtr + 32 >> 2] = dst;

	var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];

	HEAP32[tmPtr + 40 >> 2] = zonePtr;

	return tmPtr;
}

function _time(ptr) {
	var ret = Date.now() / 1e3 | 0;

	if (ptr) {
		HEAP32[ptr >> 2] = ret;
	}

	return ret;
}

function _times(buffer) {
	if (buffer !== 0) {
		_memset(buffer, 0, 16);
	}

	return 0;
}


export {
	__get_daylight,
	__get_timezone,
	__get_tzname
};
