

import {intArrayFromString} 			 										 from './utils.js';
import {HEAP32, Pointer_stringify, writeArrayToMemory} from './memory.js';

const MONTH_DAYS_LEAP 	 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const EXPANSION_RULES_1 = {
	'%c': '%a %b %d %H:%M:%S %Y',
	'%D': '%m/%d/%y',
	'%F': '%Y-%m-%d',
	'%h': '%b',
	'%r': '%I:%M:%S %p',
	'%R': '%H:%M',
	'%T': '%H:%M:%S',
	'%x': '%m/%d/%y',
	'%X': '%H:%M:%S'
};

const WEEKDAYS = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];


const leadingSomething = (value, digits, character) => {
	let str = typeof value === 'number' ? value.toString() : value || '';

	while (str.length < digits) {
		str = character[0] + str;
	}

	return str;
};

const leadingNulls = (value, digits) => leadingSomething(value, digits, '0');

const isLeapYear = year => 
	year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const addDays = (date, days) => {
	const newDate = new Date(date.getTime());

	while (days > 0) {
		const leap 							 = isLeapYear(newDate.getFullYear());
		const currentMonth 			 = newDate.getMonth();
		const daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[currentMonth];

		if (days > daysInCurrentMonth - newDate.getDate()) {
			days -= daysInCurrentMonth - newDate.getDate() + 1;
			newDate.setDate(1);

			if (currentMonth < 11) {
				newDate.setMonth(currentMonth + 1);
			}
			else {
				newDate.setMonth(0);
				newDate.setFullYear(newDate.getFullYear() + 1);
			}
		}
		else {
			newDate.setDate(newDate.getDate() + days);

			return newDate;
		}
	}

	return newDate;
};

const sgn = value => value < 0 ? -1 : value > 0 ? 1 : 0;

const compareByDay = (date1, date2) => {
	let compare;

	// TODO:
	//
	// Rewrite this.
	// This is such bad practice to have assignments in an if statement!
	if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
		if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
			compare = sgn(date1.getDate() - date2.getDate());
		}
	}

	return compare;
};

const getFirstWeekStartDate = janFourth => {
	switch(janFourth.getDay()) {
		case 0:
			return new Date(janFourth.getFullYear() - 1, 11, 29);
		case 1:
			return janFourth;
		case 2:
			return new Date(janFourth.getFullYear(), 0, 3);
		case 3:
			return new Date(janFourth.getFullYear(), 0, 2);
		case 4:
			return new Date(janFourth.getFullYear(), 0, 1);
		case 5:
			return new Date(janFourth.getFullYear() - 1, 11, 31);
		case 6:
			return new Date(janFourth.getFullYear() - 1, 11, 30);
	}
};

const getWeekBasedYear = date => {
	const thisDate 							 = addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
	const janFourthThisYear 		 = new Date(thisDate.getFullYear(), 0, 4);
	const janFourthNextYear 		 = new Date(thisDate.getFullYear() + 1, 0, 4);
	const firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
	const firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);

	if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
		if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
			return thisDate.getFullYear() + 1;
		}
		else {
			return thisDate.getFullYear();
		}
	}
	else {
		return thisDate.getFullYear() - 1;
	}
};

const arraySum = (array, index) => {
	let sum = 0;

	for (let i = 0; i <= index; sum += array[i++]);

	return sum;
};


const EXPANSION_RULES_2 = {
	'%a': date => WEEKDAYS[date.tm_wday].substring(0, 3),

	'%A': date => WEEKDAYS[date.tm_wday],

	'%b': date => MONTHS[date.tm_mon].substring(0, 3),

	'%B': date => MONTHS[date.tm_mon],

	'%C': date => {
		const year = date.tm_year + 1900;

		return leadingNulls(year / 100 | 0, 2);
	},

	'%d': date => leadingNulls(date.tm_mday, 2),

	'%e': date => leadingSomething(date.tm_mday, 2, ' '),

	'%g': date => getWeekBasedYear(date).toString().substring(2),

	'%G': date => getWeekBasedYear(date),

	'%H': date => leadingNulls(date.tm_hour, 2),

	'%I': date => {
		let twelveHour = date.tm_hour;

		if (twelveHour == 0) {
			twelveHour = 12;
		}
		else if (twelveHour > 12) {
			twelveHour -= 12;
		}

		return leadingNulls(twelveHour, 2);
	},

	'%j': date => leadingNulls(
		date.tm_mday + arraySum(isLeapYear(date.tm_year + 1900) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, date.tm_mon - 1), 
		3
	),

	'%m': date => leadingNulls(date.tm_mon + 1, 2),

	'%M': date => leadingNulls(date.tm_min, 2),

	'%n': () => '\n',

	'%p': date => {
		if (date.tm_hour >= 0 && date.tm_hour < 12) {
			return 'AM';
		}
		else {
			return'PM';
		}
	},

	'%S': date => leadingNulls(date.tm_sec, 2),

	'%t': () => '\t',

	'%u': date => {
		const day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);

		return day.getDay() || 7;
	},

	'%U': date => {
		const janFirst = new Date(date.tm_year + 1900, 0, 1);

		const firstSunday = janFirst.getDay() === 0 ? 
													janFirst : 
													addDays(janFirst, 7 - janFirst.getDay());

		const endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

		if (compareByDay(firstSunday, endDate) < 0) {

			const februaryFirstUntilEndMonth = arraySum(
				isLeapYear(endDate.getFullYear()) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, 
				endDate.getMonth() - 1
			) - 31;

			const firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
			const days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();

			return leadingNulls(Math.ceil(days / 7), 2);
		}

		return compareByDay(firstSunday, janFirst) === 0 ? '01' : '00';
	},

	'%V': date => {
		const janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
		const janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
		const firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
		const firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
		const endDate = addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);

		if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
			return '53';
		}

		if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
			return '01';
		}

		let daysDifference;

		if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
			daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
		}
		else {
			daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
		}

		return leadingNulls(Math.ceil(daysDifference / 7), 2);
	},

	'%w': date => {
		const day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);

		return day.getDay();
	},

	'%W': date => {
		const janFirst = new Date(date.tm_year, 0, 1);

		const firstMonday = janFirst.getDay() === 1 ? 
													janFirst : 
													addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
		
		const endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

		if (compareByDay(firstMonday, endDate) < 0) {

			const februaryFirstUntilEndMonth = arraySum(
				isLeapYear(endDate.getFullYear()) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, 
				endDate.getMonth() - 1
			) - 31;

			const firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
			const days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();

			return leadingNulls(Math.ceil(days / 7), 2);
		}

		return compareByDay(firstMonday, janFirst) === 0 ? '01' : '00';
	},

	'%y': date => (date.tm_year + 1900).toString().substring(2),

	'%Y': date => date.tm_year + 1900,

	'%z': date => {
		let off 		= date.tm_gmtoff;
		const ahead = off >= 0;

		off = Math.abs(off) / 60;
		off = off / 60 * 100 + off % 60;

		return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
	},

	'%Z': date => date.tm_zone,

	'%%': () => '%'
};


const _strftime = (s, maxsize, format, tm) => {
	const tm_zone = HEAP32[tm + 40 >> 2];

	const date = {
		tm_sec: 	 HEAP32[tm >> 2], 
		tm_min: 	 HEAP32[tm + 4 >> 2],
		tm_hour: 	 HEAP32[tm + 8 >> 2],
		tm_mday: 	 HEAP32[tm + 12 >> 2],
		tm_mon: 	 HEAP32[tm + 16 >> 2],
		tm_year: 	 HEAP32[tm + 20 >> 2],
		tm_wday: 	 HEAP32[tm + 24 >> 2],
		tm_yday: 	 HEAP32[tm + 28 >> 2],
		tm_isdst:  HEAP32[tm + 32 >> 2],
		tm_gmtoff: HEAP32[tm + 36 >> 2],
		tm_zone: 	 tm_zone ? Pointer_stringify(tm_zone) : ''
	};

	let pattern = Pointer_stringify(format);	

	for (const rule in EXPANSION_RULES_1) {
		pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
	}		

	for (const rule in EXPANSION_RULES_2) {
		if (pattern.indexOf(rule) >= 0) {
			pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
		}
	}

	const bytes = intArrayFromString(pattern, false);

	if (bytes.length > maxsize) {
		return 0;
	}

	writeArrayToMemory(bytes, s);

	return bytes.length - 1;
};


export {
	_strftime
};
