'use strict';

/**
 * @fileOverview Defines the PostTracker prototype and its methods.
 */
module.exports = PostTracker;

var Deque = require('./deque');
var config = require('./config');

/**
 * PostTracker constructor
 *
 * @class
 *
 * A PostTracker instance maintains a LIFO size-limited queue that contains Node instances that describe when a
 * notification request was received for processing. New Node instances are added using the 'add' method. The 'track'
 * method looks for cached Node instances and if found logs the duration in seconds between the receipt time of the
 * notification and the initiation time stored in the Node instance.
 */
function PostTracker(maxSize) {
    this.log = config.log('PostTracker');
    this.maxSize = maxSize;
    this.active = new Deque();
    this.mapping = {};
}

/**
 * PostTracker.Node constructor
 *
 * @class
 *
 * A PostTracker.Node instance contains attributes associated with a post notification request. In particular, it
 * tracks the unique sequence ID for the request, and the time when the request was made.
 */
PostTracker.Node = function(sequenceId, when) {
    this.sequence = sequenceId;
    this.when = when;
};

PostTracker.prototype = {

    /**
     * Create a new Node instance and add to the LIFO size-limited queue.
     *
     * @param {Integer} sequenceId the unique identifier associated with a notification request
     *
     * @param {Date} when a Javascript Date instance the describes when the request was received
     */
    add: function (sequenceId, when) {
        var log = this.log.child('add');
        log.BEGIN(sequenceId, when);

        var node;
        if (this.active.size() === this.maxSize) {
            node = this.active.popBack();
            delete this.mapping[node.data.sequence];
            node.data = {sequenceId: sequenceId, when: when};
        }
        else {
            node = new Deque.Node({sequenceId: sequenceId, when: when});
        }

        this.mapping[sequenceId] = this.active.pushFrontNode(node);
        log.END();
    },

    /**
     * Log the end-to-end time taken to process a notification requested and receive it at a client.
     *
     * @param {Integer} sequenceId the unique identifier associated with a notification request
     *
     * @param {Date} when a Javascript Date instance the describes when the notification was received at the client.
     */
    track: function(sequenceId, when) {
        var log = this.log.child('track');
        log.BEGIN(sequenceId, when);

        var node = this.mapping[sequenceId];
        if (node) {
            var duration = when - node.data.when;
            log.debug('when.getTime:', when);
            log.info(sequenceId, ' receipt - duration:', duration, 'msecs');
        }

        log.END();
    }
};
