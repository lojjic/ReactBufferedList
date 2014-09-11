# Buffered List for React

This is a React component for displaying a very large number of data items in a
vertically scrollable list. Rendering is buffered/chunked so only the items
which are currently in the visible area of the scrolled list get rendered. The
goal is to achieve 60fps frame rate while scrolling, while minimizing flicker as
much as possible.

This is a work in progress. It's also my first React component so I'm still learning
best practices. I welcome suggestions for improvements.

## Usage:

    React.renderComponent(ReactBufferedList({
        /**
         * The array of data items to be rendered. By default this expects an array
         * of strings, but other item types like complex objects are also supported
         * if you supply a custom itemRenderer function.
         */
        data: [],

        /**
         * An optional function that transforms a single item's data into the desired
         * content for that item's row in the list. It should return a string, a React
         * component descriptor, or an array of either.
         */
        itemRenderer: function(itemData, itemIndex) {...}
    }), parentNode);

## TODOs:

- Currently it is assumed that the items are variable-height, so each one is
  measured after initial DOM insertion to calculate relative positions. An optional
  flag to indicate fixed-height items should be added which would remove the need
  to measure anything other than the first item, potentially improving performance
  significantly.
- Since the scroll height is based on an average item height, scrolling to the very
  end/start of the list sometimes doesn't line up. It needs to update the scroll
  metrics on the fly and nudge the scroll height/top and item positions as needed
  to get things to line up correctly.
- There's currently a hard limit on the number of DOM nodes that can be inserted
  per frame, to prevent exceeding the frame budget. This limit is arbitrary and
  really needs to be tuned to the current environment; this should be possible by
  tracking time between frames and adjusting the limit down if it's taking too long.
  Likewise, since a lower limit has more potential for flicker, it can be adjusted
  up if there's extra time per frame.
- Implement RequireJS/AMD style definition.