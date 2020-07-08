

import {ALLOC_STATIC} from './constants.js';
import utils 					from './utils.js';
import memory 				from './memory.js';


// Exposed to be set/updated in other modules.
const exposed = {
	// Set in 'setAsm' function in 'asm.js'.
	__get_daylight: null,
	__get_timezone: null,
	__get_tzname: 	null
};

const tmTimezone = memory.allocate(utils.intArrayFromString('GMT'), 'i8', ALLOC_STATIC);

const _gettimeofday = ptr => {
	const now = Date.now();

	memory.exposed.HEAP32[ptr >> 2] 		= now / 1e3 | 0;
	memory.exposed.HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;

	return 0;
};


const _gmtime_r = (time, tmPtr) => {
	const date = new Date(memory.exposed.HEAP32[time >> 2] * 1e3);

	memory.exposed.HEAP32[tmPtr >> 2] 		 = date.getUTCSeconds();
	memory.exposed.HEAP32[tmPtr + 4 >> 2]  = date.getUTCMinutes();
	memory.exposed.HEAP32[tmPtr + 8 >> 2]  = date.getUTCHours();
	memory.exposed.HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
	memory.exposed.HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
	memory.exposed.HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
	memory.exposed.HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
	memory.exposed.HEAP32[tmPtr + 36 >> 2] = 0;
	memory.exposed.HEAP32[tmPtr + 32 >> 2] = 0;

	const start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
	const yday 	= (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;

	memory.exposed.HEAP32[tmPtr + 28 >> 2] = yday;
	memory.exposed.HEAP32[tmPtr + 40 >> 2] = tmTimezone;

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

	memory.exposed.HEAP32[exposed.__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;

	const winter = new Date(2e3, 0, 1);
	const summer = new Date(2e3, 6, 1);

	memory.exposed.HEAP32[exposed.__get_daylight() >> 2] = Number(winter.getTimezoneOffset() !== summer.getTimezoneOffset());

	const ALLOC_NORMAL 	= 0;
	const winterName 		= extractZone(winter);
	const summerName 		= extractZone(summer);
	const winterNamePtr = memory.allocate(utils.intArrayFromString(winterName), 'i8', ALLOC_NORMAL);
	const summerNamePtr = memory.allocate(utils.intArrayFromString(summerName), 'i8', ALLOC_NORMAL);

	if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
		memory.exposed.HEAP32[exposed.__get_tzname() >> 2] 		 = winterNamePtr;
		memory.exposed.HEAP32[exposed.__get_tzname() + 4 >> 2] = summerNamePtr;
	}
	else {
		memory.exposed.HEAP32[exposed.__get_tzname() >> 2] 		 = summerNamePtr;
		memory.exposed.HEAP32[exposed.__get_tzname() + 4 >> 2] = winterNamePtr;
	}
};

const _localtime_r = (time, tmPtr) => {
	_tzset();

	const date = new Date(memory.exposed.HEAP32[time >> 2] * 1e3);

	memory.exposed.HEAP32[tmPtr >> 2] 		 = date.getSeconds();
	memory.exposed.HEAP32[tmPtr + 4 >> 2]  = date.getMinutes();
	memory.exposed.HEAP32[tmPtr + 8 >> 2]  = date.getHours();
	memory.exposed.HEAP32[tmPtr + 12 >> 2] = date.getDate();
	memory.exposed.HEAP32[tmPtr + 16 >> 2] = date.getMonth();
	memory.exposed.HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
	memory.exposed.HEAP32[tmPtr + 24 >> 2] = date.getDay();

	const start = new Date(date.getFullYear(), 0, 1);
	const yday 	= (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;

	memory.exposed.HEAP32[tmPtr + 28 >> 2] = yday;
	memory.exposed.HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);

	const summerOffset = (new Date(2e3, 6, 1)).getTimezoneOffset();
	const winterOffset = start.getTimezoneOffset();

	const dst = (
		summerOffset != winterOffset && 
		date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)
	) | 0;

	memory.exposed.HEAP32[tmPtr + 32 >> 2] = dst;

	const zonePtr = memory.exposed.HEAP32[exposed.__get_tzname() + (dst ? 4 : 0) >> 2];

	memory.exposed.HEAP32[tmPtr + 40 >> 2] = zonePtr;

	return tmPtr;
};

const _time = ptr => {
	const ret = Date.now() / 1e3 | 0;

	if (ptr) {
		memory.exposed.HEAP32[ptr >> 2] = ret;
	}

	return ret;
};

const _times = buffer => {
	if (buffer !== 0) {
		utils.exposed._memset(buffer, 0, 16);
	}

	return 0;
};


export default {
	_gmtime_r,
	_gettimeofday,
	_localtime_r,
	_time,
	_times,
	exposed
};
