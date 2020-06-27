
import {ALLOC_STATIC} 							 from './constants.js';
import {_memset, intArrayFromString} from './utils.js';
import {HEAP32, allocate}  					 from './memory.js';

// Set after 'asm' in 'wasm-interface.js'.
let __get_daylight;
let __get_timezone;
let __get_tzname;


const _gettimeofday = ptr => {
	const now = Date.now();

	HEAP32[ptr >> 2] 		 = now / 1e3 | 0;
	HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;

	return 0;
};

const ___tm_timezone = allocate(intArrayFromString('GMT'), 'i8', ALLOC_STATIC);

const _gmtime_r = (time, tmPtr) => {
	const date = new Date(HEAP32[time >> 2] * 1e3);

	HEAP32[tmPtr >> 2] 			= date.getUTCSeconds();
	HEAP32[tmPtr + 4 >> 2] 	= date.getUTCMinutes();
	HEAP32[tmPtr + 8 >> 2] 	= date.getUTCHours();
	HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
	HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
	HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
	HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
	HEAP32[tmPtr + 36 >> 2] = 0;
	HEAP32[tmPtr + 32 >> 2] = 0;

	const start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
	const yday 	= (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;

	HEAP32[tmPtr + 28 >> 2] = yday;
	HEAP32[tmPtr + 40 >> 2] = ___tm_timezone;

	return tmPtr;
};

const extractZone = date => {
	const match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);

	return match ? match[1] : 'GMT';
};

let _tzsetCalled = false;

const _tzset = () => {
	if (_tzsetCalled) { return; }

	_tzsetCalled = true;

	HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;

	const winter = new Date(2e3, 0, 1);
	const summer = new Date(2e3, 6, 1);

	HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() !== summer.getTimezoneOffset());

	const ALLOC_NORMAL 	= 0;
	const winterName 		= extractZone(winter);
	const summerName 		= extractZone(summer);
	const winterNamePtr = allocate(intArrayFromString(winterName), 'i8', ALLOC_NORMAL);
	const summerNamePtr = allocate(intArrayFromString(summerName), 'i8', ALLOC_NORMAL);

	if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
		HEAP32[__get_tzname() >> 2] 		= winterNamePtr;
		HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr;
	}
	else {
		HEAP32[__get_tzname() >> 2] 		= summerNamePtr;
		HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr;
	}
};

const _localtime_r = (time, tmPtr) => {
	_tzset();

	const date = new Date(HEAP32[time >> 2] * 1e3);

	HEAP32[tmPtr >> 2] 			= date.getSeconds();
	HEAP32[tmPtr + 4 >> 2] 	= date.getMinutes();
	HEAP32[tmPtr + 8 >> 2] 	= date.getHours();
	HEAP32[tmPtr + 12 >> 2] = date.getDate();
	HEAP32[tmPtr + 16 >> 2] = date.getMonth();
	HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
	HEAP32[tmPtr + 24 >> 2] = date.getDay();

	const start = new Date(date.getFullYear(), 0, 1);
	const yday 	= (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;

	HEAP32[tmPtr + 28 >> 2] = yday;
	HEAP32[tmPtr + 36 >> 2] =- (date.getTimezoneOffset() * 60);

	const summerOffset = (new Date(2e3, 6, 1)).getTimezoneOffset();
	const winterOffset = start.getTimezoneOffset();

	const dst = (
		summerOffset != winterOffset && 
		date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)
	) | 0;

	HEAP32[tmPtr + 32 >> 2] = dst;

	const zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];

	HEAP32[tmPtr + 40 >> 2] = zonePtr;

	return tmPtr;
};

const _time = ptr => {
	const ret = Date.now() / 1e3 | 0;

	if (ptr) {
		HEAP32[ptr >> 2] = ret;
	}

	return ret;
};

const _times = buffer => {
	if (buffer !== 0) {
		_memset(buffer, 0, 16);
	}

	return 0;
};


export {
	__get_daylight,
	__get_timezone,
	__get_tzname,
	_gmtime_r,
	_gettimeofday,
	_localtime_r,
	_time,
	_times
};
