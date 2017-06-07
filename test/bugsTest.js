var assert = require('assert'),

    AsyncM = require('../asyncm'),
    testUtil = require('./util'),
    util = require('util');

describe('AsyncM', function() {
	describe('cancellation handling', function() {
		describe('skipAny pureM', function() {
			it('should handle cancellation', function(done) {
				var running = AsyncM.never().run();

				var skipM = AsyncM.never().cancel(function() {
					return AsyncM.result(42);
				});

				var skipPureM = AsyncM.pureM(function() {
					return skipM;
				});

				var running2 = running.cancel(1).skipAny(skipPureM).run();

				running2.cancel(2).run(function(result) {
					assert.equal(result, 42);

					done();
				}, function() {
					assert(false);
				});
			});

			it('should call cancel handler', function(done) {
				var running = AsyncM.never().run();

				var skipM = AsyncM.create(function() {
					return {
						cancel: function() {
							return AsyncM.result(42);
						}
					};
				});

				var running2 = running.cancel(1).skipAny(skipM).run();

				running2.cancel(2).run(function(result) {
					assert.equal(result, 42);

					done();
				}, function() {
					assert(false);
				});
			});
		});
	});
});
