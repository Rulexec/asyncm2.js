/*
 * This is immutable tree of async control flow.
 *
 * It has a start node, that represent currently executing monad (or that will be executed),
 * and this node connected to 3 types of handlers: result, error, cancel.
 *
 * And then every handler can be connected to next layer of handlers.
 */

module.exports = ReversedFlowList;

function ReversedFlowList(options) {
	this._data = options && options.data;

	this._prev = null;

	this._result = null;
	this._error = null;
	this._cancel = null;

	this.addLayer = function(resultData, errorData, cancelData) {
		var list = new ReversedFlowList();

		list._prev = this;

		list._result = resultData;
		list._error = errorData;
		list._cancel = cancelData;

		return list;
	};

	this.toDirectList = function() {
		let lists = [];

		let direct = reversedToListAndData(this);

		let data = direct.data;

		lists.push(direct.list);

		function reversedToListAndData(reversedList) {
			let list = [];

			let node = reversedList;

			while (node._prev) {
				list.push({
					result: node._result,
					error: node._error,
					cancel: node._cancel
				});

				node = node._prev;
			}

			return {
				list: list,
				data: node._data
			};
		}

		return {
			prependReversedList: function(reversedList) {
				let direct = reversedToListAndData(reversedList);

				if (direct.list.length) {
					lists.unshift(direct.list);
				}

				return direct.data;
			},

			takeLayer: function() {
				while (lists.length) {
					let list = lists[0];

					if (list.length) {
						let item = list.pop();

						if (!list.length) {
							lists.shift();
						}

						return item;
					}

					lists.shift();
				}

				return null;
			},
			takeLayerWithCancelAndDropPrepended: function() {
				while (lists.length) {
					let list = lists[0];

					while (list.length) {
						let layer = list.pop();

						if (layer.cancel) {
							lists.shift();

							return layer;
						}
					}

					lists.shift();
				}

				return null;
			},

			getData: function() { return data; }
		};
	};
}