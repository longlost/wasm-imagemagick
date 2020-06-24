


function __isLeapYear(year) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function __arraySum(array, index) {
	var sum = 0;

	for (var i = 0; i <= index; sum += array[i++]);

	return sum;
}

var __MONTH_DAYS_LEAP 	 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function __addDays(date, days) {
	var newDate = new Date(date.getTime());

	while (days > 0) {
		var leap 							 = __isLeapYear(newDate.getFullYear());
		var currentMonth 			 = newDate.getMonth();
		var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];

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
}

function _strftime(s, maxsize, format, tm) {
	var tm_zone = HEAP32[tm + 40 >> 2];

	var date = {
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

	var pattern = Pointer_stringify(format);

	var EXPANSION_RULES_1 = {
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

	for (var rule in EXPANSION_RULES_1) {
		pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
	}

	var WEEKDAYS = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday'
	];

	var MONTHS = [
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

	function leadingSomething(value, digits, character) {
		var str = typeof value === 'number' ? value.toString() : value || '';

		while (str.length < digits) {
			str = character[0] + str;
		}

		return str;
	}

	function leadingNulls(value, digits) {
		return leadingSomething(value, digits, '0');
	}

	function compareByDay(date1, date2) {
		function sgn(value) {
			return value < 0 ? -1 : value > 0 ? 1 : 0;
		}

		var compare;

		if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
			if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
				compare = sgn(date1.getDate() - date2.getDate());
			}
		}

		return compare;
	}

	function getFirstWeekStartDate(janFourth) {
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
	}

	function getWeekBasedYear(date) {
		var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
		var janFourthThisYear 		 = new Date(thisDate.getFullYear(), 0, 4);
		var janFourthNextYear 		 = new Date(thisDate.getFullYear() + 1, 0, 4);
		var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
		var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);

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
	}

	var EXPANSION_RULES_2 = {
		'%a': (function(date) {
			return WEEKDAYS[date.tm_wday].substring(0, 3);
		}),

		'%A': (function(date) {
			return WEEKDAYS[date.tm_wday];
		}),

		'%b': (function(date) {
			return MONTHS[date.tm_mon].substring(0, 3);
		}),

		'%B': (function(date) {
			return MONTHS[date.tm_mon];
		}),

		'%C': (function(date) {
			var year = date.tm_year + 1900;

			return leadingNulls(year / 100 | 0, 2);
		}),

		'%d': (function(date) {
			return leadingNulls(date.tm_mday, 2);
		}),

		'%e': (function(date) {
			return leadingSomething(date.tm_mday, 2, ' ');
		}),

		'%g': (function(date) {
			return getWeekBasedYear(date).toString().substring(2);
		}),
		'%G': (function(date) {
			return getWeekBasedYear(date);
		}),

		'%H': (function(date) {
			return leadingNulls(date.tm_hour, 2);
		}),

		'%I': (function(date) {
			var twelveHour = date.tm_hour;

			if (twelveHour == 0) {
				twelveHour = 12;
			}
			else if (twelveHour > 12) {
				twelveHour -= 12;
			}

			return leadingNulls(twelveHour, 2);
		}),

		'%j': (function(date) {
			return leadingNulls(
				date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 
				3
			);
		}),

		'%m': (function(date) {
			return leadingNulls(date.tm_mon + 1, 2);
		}),

		'%M': (function(date) {
			return leadingNulls(date.tm_min, 2);
		}),

		'%n': (function() {
			return '\n';
		}),

		'%p': (function(date) {
			if (date.tm_hour >= 0 && date.tm_hour < 12) {
				return 'AM';
			}
			else {
				return'PM';
			}
		}),

		'%S': (function(date) {
			return leadingNulls(date.tm_sec, 2);
		}),

		'%t': (function() {
			return '\t';
		}),

		'%u': (function(date) {
			var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);

			return day.getDay() || 7;
		}),

		'%U': (function(date) {
			var janFirst = new Date(date.tm_year + 1900, 0, 1);

			var firstSunday = janFirst.getDay() === 0 ? 
													janFirst : 
													__addDays(janFirst, 7 - janFirst.getDay());

			var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

			if (compareByDay(firstSunday, endDate) < 0) {

				var februaryFirstUntilEndMonth = __arraySum(
					__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, 
					endDate.getMonth() - 1
				) - 31;

				var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
				var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();

				return leadingNulls(Math.ceil(days / 7), 2);
			}

			return compareByDay(firstSunday, janFirst) === 0 ? '01' : '00';
		}),

		'%V': (function(date) {
			var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
			var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
			var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
			var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
			var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);

			if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
				return '53';
			}

			if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
				return '01';
			}

			var daysDifference;

			if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
				daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
			}
			else {
				daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
			}

			return leadingNulls(Math.ceil(daysDifference / 7), 2);
		}),

		'%w': (function(date) {
			var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);

			return day.getDay();
		}),

		'%W': (function(date) {
			var janFirst = new Date(date.tm_year, 0, 1);

			var firstMonday = janFirst.getDay() === 1 ? 
													janFirst : 
													__addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
			
			var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);

			if (compareByDay(firstMonday, endDate) < 0) {

				var februaryFirstUntilEndMonth = __arraySum(
					__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, 
					endDate.getMonth() - 1
				) - 31;

				var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
				var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();

				return leadingNulls(Math.ceil(days / 7), 2);
			}

			return compareByDay(firstMonday, janFirst) === 0 ? '01' : '00';
		}),

		'%y': (function(date) {
			return(date.tm_year + 1900).toString().substring(2);
		}),

		'%Y': (function(date) {
			return date.tm_year + 1900;
		}),

		'%z': (function(date) {
			var off 	= date.tm_gmtoff;
			var ahead = off >= 0;

			off = Math.abs(off) / 60;
			off = off / 60 * 100 + off % 60;

			return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
		}),

		'%Z': (function(date) {
			return date.tm_zone;
		}),

		'%%': (function() {
			return '%';
		})
	};

	for (var rule in EXPANSION_RULES_2) {
		if (pattern.indexOf(rule) >= 0) {
			pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
		}
	}

	var bytes = intArrayFromString(pattern, false);

	if (bytes.length > maxsize) {
		return 0;
	}

	writeArrayToMemory(bytes, s);

	return bytes.length - 1;
}

