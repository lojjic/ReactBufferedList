var ReactBufferedList = (function(React) {
    "use strict";

    var DOM = React.DOM,
        PropTypes = React.PropTypes;

    var List = React.createClass({
        displayName: 'List',

        propTypes: {
            data: PropTypes.array.isRequired,
            itemRenderer: PropTypes.func
        },

        getDefaultProps: function() {
            return {
                data: [],
                itemRenderer: function(itemData, index) {
                    return itemData;
                },
                maxNewItemsPerFrame: 20
            }
        },

        _scrollTop: 0,
        _metrics: null,

        getInitialState: function() {
            return {
                outerHeight: 0,
                innerHeight: 0,
                startItemIndex: 0,
                endItemIndex: 0
            }
        },

        render: function() {
            var props = this.props,
                state = this.state,
                data = props.data,
                itemRenderer = props.itemRenderer,
                metrics = this._metrics,
                startItem = state.startItemIndex,
                endItem = state.endItemIndex,
                renderedItems = data.slice(startItem, endItem + 1);

            return this.transferPropsTo(
                DOM.div(
                    {
                        ref: 'outer',
                        data: null,
                        className: 'react-list',
                        onScroll: this.onScroll
                    },
                    DOM.ul(
                        {
                            ref: 'inner',
                            'aria-setsize': data.length,
                            style: {
                                height: state.innerHeight
                            }
                        },
                        renderedItems.map(function(itemData, i) {
                            var index = i + startItem;
                            return DOM.li(
                                {
                                    key: i,
                                    'aria-posinset': index + 1,
                                    style: {
                                        top: (index in metrics) ? metrics[index].top : -999
                                    }
                                },
                                itemRenderer(itemData, index)
                            );
                        }, this)
                    )
                )
            );
        },

        componentWillMount: function() {
            this._metrics = {
                /*
                 0: {height: n, top: n},
                 1: ...,
                 */
                avgHeight: 0,
                avgCount: 0
            };
        },

        componentDidMount: function() {
            this.setState({
                outerHeight: this.refs.outer.getDOMNode().offsetHeight
            });
        },

        componentDidUpdate: function() {
            this.queueSync();
        },

        calcMetrics: function() {
            var state = this.state,
                metrics = this._metrics,
                start = state.startItemIndex,
                end = state.endItemIndex,
                liNodes = this.refs.inner.getDOMNode().childNodes,
                hasNewMetrics = false,
                uniform = false,
                firstCached, lastCached, height, undef, i;

            // Find the first and last with existing cached metrics, to use as the baselines
            // for positioning the uncached items before and after. We'll go ahead and fill
            // in the heights now.
            for (i = start; i <= end; i++) {
                if (i in metrics) {
                    firstCached = i;
                    break;
                } else {
                    // TODO is this optimization of any benefit?
                    if (uniform) {
                        height = metrics.fixedHeight;
                        if (!height) {
                            console.log('foo');
                            height = metrics.fixedHeight = liNodes[i - start].offsetHeight;
                        }
                    } else {
                        height = liNodes[i - start].offsetHeight;
                    }
                    metrics[i] = {height: height};
                    metrics.avgHeight = (metrics.avgHeight * metrics.avgCount + height) / (++metrics.avgCount);
                    hasNewMetrics = true;
                }
            }
            for (i = end; i >= start; i--) {
                if (i in metrics) {
                    lastCached = i;
                    break;
                } else {
                    // TODO is this optimization of any benefit?
                    if (uniform) {
                        height = metrics.fixedHeight;
                        if (!height) {
                            height = metrics.fixedHeight = liNodes[i - start].offsetHeight;
                        }
                    } else {
                        height = liNodes[i - start].offsetHeight;
                    }
                    metrics[i] = {height: height};
                    metrics.avgHeight = (metrics.avgHeight * metrics.avgCount + height) / (++metrics.avgCount);
                    hasNewMetrics = true;
                }
            }

            // If we have no baseline position, approximate one
            if (firstCached === undef) {
                firstCached = lastCached = start;
                metrics[start].top = Math.floor(state.innerHeight * start / this.props.data.length);
            }

            // Walk out from the baselines, calculating each item's relative position
            while (start < firstCached) {
                metrics[firstCached - 1].top = metrics[firstCached].top - metrics[firstCached - 1].height;
                firstCached--;
            }
            while (end > lastCached) {
                metrics[lastCached + 1].top = metrics[lastCached].top + metrics[lastCached].height;
                lastCached++;
            }

            if (hasNewMetrics) {
                this.forceUpdate();
            }
        },

        adjustScroll: function() {
            var state = this.state,
                metrics = this._metrics,
                avgHeight = metrics.avgHeight,
                innerHeight = this.props.data.length * avgHeight;

            if (innerHeight !== state.innerHeight) {
                this.setState({
                    innerHeight: innerHeight
                });
            }

            /* TODO since the position baseline is based off an estimated average height,
               it's easy for the items to be misaligned with the height of the scroll area
               when scrolling to the very bottom or top of the list. We need to adjust for
               this as we scroll, nudging the items and scrollTop up or down to make sure
               they line up at the ends...
            var start = state.startItemIndex,
                end = start.endItemIndex,
                i;
            var estimatedStartTop = start * avgHeight,
                actualStartTop = metrics[start].top,
                topDiff = estimatedStartTop - actualStartTop;
            if (topDiff !== 0) {
                for (i = start; i <= end; i++) {
                    metrics[i].top += topDiff;
                }
                this.refs.outer.getDOMNode().scrollTop += topDiff;
                //this.setState({
                //    scrollTop: state.actualScrollTop + topDiff
                //});
            }
            */
        },

        fillBuffer: function() {
            var props = this.props,
                state = this.state,
                start = state.startItemIndex,
                end = state.endItemIndex,
                origStart = start,
                origEnd = end,
                dataCount = props.data.length,
                metrics = this._metrics,
                scrollTop = this._scrollTop,
                avgHeight = metrics.avgHeight,
                outerHeight = state.outerHeight,
                maxNewItems = props.maxNewItemsPerFrame,
                newItemCount = 0,
                i, pos;

            // Trim extras off either end
            for (i = start; i <= end; i++) {
                if (metrics[i].top + metrics[i].height < scrollTop) {
                    delete metrics[i];
                    start++;
                }
            }
            for (i = end; i >= start; i--) {
                if (metrics[i].top > scrollTop + outerHeight) {
                    delete metrics[i];
                    end--;
                }
            }

            // All items were deleted; calculate a new baseline from the scroll position
            if (start > end) {
                start = Math.floor(dataCount * scrollTop / state.innerHeight);
                end = Math.min(start + maxNewItems - 1, dataCount - 1)
            }
            // Add items outward from the existing ones
            else {
                pos = metrics[start].top;
                while (start > 0 && newItemCount < maxNewItems && pos >= scrollTop) {
                    start--;
                    pos -= avgHeight;
                    newItemCount++;
                }
                pos = metrics[end].top + metrics[end].height;
                while (end < dataCount - 1 && newItemCount < maxNewItems && pos <= scrollTop + outerHeight) {
                    end++;
                    pos += avgHeight;
                    newItemCount++;
                }
            }

            if (start !== origStart || end !== origEnd) {
                this.setState({
                    startItemIndex: start,
                    endItemIndex: end
                });
            }
        },

        onScroll: function(e) {
            this._scrollTop = e.target.scrollTop;
            this.sync();
        },

        queueSync: function() {
            if (!this.syncAFID) {
                this.syncAFID = requestAnimationFrame(this._boundSync || (this._boundSync = this.sync.bind(this)));
            }
        },

        sync: function() {
            if (this.syncAFID) {
                cancelAnimationFrame(this.syncAFID);
                delete this.syncAFID;
            }
            this.calcMetrics();
            this.fillBuffer();
            this.adjustScroll();
        }
    });

    return List;
})(React);