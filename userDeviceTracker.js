'use strict';

/**
 * @fileOverview Defines the UserDeviceTracker prototype and its methods.
 */
module.exports = UserDeviceTracker;

var Deque = require('./deque');
var config = require('./config');

/**
 * UserDeviceTracker constructor
 *
 * @class
 *
 * A UserDeviceTracker instance maintains a LIFO size-limited queue that contains Node instances that define a
 * relationship between a user ID and an APNs device token.
 */
function UserDeviceTracker(maxSize) {
    this.log = config.log('UserDeviceTracker');
    this.maxSize = maxSize;
    this.active = new Deque();
    this.mapping = {};
}

/**
 * UserDeviceTracker.Node constructor
 *
 * @class
 *
 * A UserDeviceTracker.Node instance contains a user ID and a device token.
 */
UserDeviceTracker.Node = function(userId, device) {
    this.userId = userId;
    this.device = device;
};

UserDeviceTracker.prototype = {

    /**
     * Create a new Node instance and add to the LIFO size-limited queue.
     *
     * @param {String} userId the user identifier to remember
     *
     * @param {String} device the iOS device token to remember
     */
    add: function (userId, device) {
        var log = this.log.child('add');
        log.BEGIN(userId, device);

        var node = this.mapping[device];
        if (typeof node !== 'undefined') {
            node.extricate();   // Unlink from the active queue
        }
        else {
            if (this.active.size() === this.maxSize) {
                node = this.active.popBack();
                delete this.mapping[node.data.device];
                node.data.userId = userId;
                node.data.device = device;
            }
            else {
                node = new Deque.Node(new UserDeviceTracker.Node(userId, device));
            }
            this.mapping[device] = node;
        }

        this.active.pushFrontNode(node);
        log.END();
    },

    /**
     * Attempt to locate the user ID that belongs to a given iOS device token.
     *
     * @param {String} device the iOS device token to look for
     */
    find: function(device) {
        var log = this.log.child('find');
        log.BEGIN(device);
        var node = this.mapping[device];
        var value = node ? node.data.userId: null;
        if (value) {
            node.extricate();
            delete this.mapping[device];
        }
        log.END(value);
        return value;
    }
};
