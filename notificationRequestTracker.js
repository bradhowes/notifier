'use strict';

/**
 * @fileOverview Defines the NotificationRequestTracker prototype and its methods.
 */
module.exports = NotificationRequestTracker;

var Deque = require('./deque');
var config = require('./config');

/**
 * NotificationRequestTracker constructor
 *
 * @class
 *
 * A NotificationRequestTracker instance maintains a LIFO size-limited queue that contains Node instances that define a
 * relationship between a user ID and an APNs device token.
 */
function NotificationRequestTracker(maxSize) {
    this.log = config.log('NotificationRequestTracker');
    this.maxSize = maxSize;
    this.active = new Deque();
    this.mapping = {};
}

NotificationRequestTracker.prototype = {

    /**
     * Create a new Node instance and add to the LIFO size-limited queue.
     *
     * @param {NotificationRequest} request the request to remember
     */
    add: function (request) {
        var log = this.log.child('add');
        log.BEGIN(request);

        var node = this.mapping[request.token];
        if (typeof node !== 'undefined') {
            node.extricate();   // Unlink from the active queue
        }
        else {
            if (this.active.size() === this.maxSize) {
                node = this.active.popBack();
                delete this.mapping[node.data.token];
                node.data = request;
            }
            else {
                node = new Deque.Node(request);
            }
            this.mapping[request.token] = node;
        }

        this.active.pushFrontNode(node);
        log.END();
    },

    /**
     * Attempt to locate the user ID that belongs to a given iOS device token.
     *
     * @param {String} device the iOS device token to look for
     */
    find: function(token) {
        var log = this.log.child('find');
        log.BEGIN(token);
        var node = this.mapping[token];
        var request = node ? node.data: null;
        if (request) {
            this.active.remove(node);
            delete this.mapping[token];
        }

        log.END(request);
        return request;
    }
};
