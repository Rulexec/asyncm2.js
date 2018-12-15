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
		});
	});
});
