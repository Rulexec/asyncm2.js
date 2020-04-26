const assert = require('assert');
const AsyncM = require('../asyncm');

describe('AsyncM', function() {
	describe('.parallel', function() {
		describe('limit', function() {
			it('should execute only single task', function(done) {
				let tasks = [1, 2, 3, 4, 5];

				let sum = 0;

				let executingCount = 0;

				AsyncM.parallel(tasks, {
					limit: 1,
					drop: true,
					f: function(x) {
						return AsyncM.sleep(0).result(() => {
							assert.equal(executingCount, 0);

							executingCount++;

							sum += x;

							return AsyncM.sleep(0);
						}).result(() => {
							assert.equal(executingCount, 1);

							executingCount--;

							return AsyncM.result(sum);
						});
					}
				}).run(function() {
					assert.equal(sum, 15);

					done();
				}, function() {
					assert(false);
				});
			});

			it('should limit `count`', done => {
				let tasks = [1, 2, 3, 4, 5];

				let sum = 0;

				let executingCount = 0;

				AsyncM.parallel({
					count: 5,
					limit: 1,
					drop: true,
					f: function(i) {
						return AsyncM.sleep(0).result(() => {
							assert.equal(executingCount, 0);

							executingCount++;

							sum += tasks[i];

							return AsyncM.sleep(0);
						}).result(() => {
							assert.equal(executingCount, 1);

							executingCount--;

							return AsyncM.result(sum);
						});
					}
				}).run(function() {
					assert.equal(sum, 15);

					done();
				}, function() {
					assert(false);
				});
			});
		});

		describe('count', function() {
			it('should not stack overflow with limit', done => {
				let executedTimes = 0;

				AsyncM.parallel({
					count: 100000,
					limit: 1,
					drop: true,
					f: function() {
						executedTimes++;

						return AsyncM.result();
					}
				}).run(function() {
					assert.equal(executedTimes, 100000);

					done();
				}, function() {
					assert(false);
				});
			});

			it('should not stack overflow without limit', done => {
				let executedTimes = 0;

				AsyncM.parallel({
					count: 100000,
					drop: true,
					f: function() {
						executedTimes++;

						return AsyncM.result();
					}
				}).run(function() {
					assert.equal(executedTimes, 100000);

					done();
				}, function() {
					assert(false);
				});
			});
		});

		describe('cancel', () => {
			it('should cancel', function(done) {
				let cancelsCount = 0;

				let running = AsyncM.parallel([
					AsyncM.never().cancel(() => {
						cancelsCount++;
					}),
					AsyncM.sleep(500).cancel(() => {
						cancelsCount++;
					}),
				]).run();

				setTimeout(() => {
					running.cancel().run(() => {
						assert.equal(cancelsCount, 2);

						done();
					}, error => done(error || 'error'));
				}, 10);
			});
		});
	});
});
