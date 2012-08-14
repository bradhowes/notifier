'use strict';

/**
 * @fileOverview Defines the APNs prototype and its methods.
 */
module.exports = APNs;

var config = require('./config');
var apn = require('apn');
var NotificationRequestTracker = require('./notificationRequestTracker');

/**
 * APNs constructor.
 *
 * @class
 *
 * An APNs object sends JSON payloads to an APNs server for delivery to a specific iOS device.
 */
function APNs() {
    this.log = config.log('APNs');

    /**
     * Cache of the N most recently seen userId / device token pairs.
     */
    this.notificationRequestTracker = new NotificationRequestTracker(config.apns_device_cache_size);

    // Terrible attempt to support a callback when notification gets sent out.
    this.lastSentNotification = null;

    /**
     * Error callback invoked whenever an error response comes over the connection. If the notification object is
     * valid and has a callback associated with it, invoke the callback.
     *
     * @param {Number} errNum numeric response returned by APNs server before it closed the connection
     * @param {apn.Notification} notification the Notification instance that triggered he error
     */
    var errorCallback = function (errNum, notification) {
        this.log.debug("APNs.errorCallback:", errNum, notification);
        this.lastSentNotification = null;
        if (notification !== null && typeof notification.callback === "function") {
            notification.callback({"retry":false, "invalidToken":errNum === 8});
        }
    }.bind(this);

    /**
     * Connection to APNs server.
     * @type apn.Connection
     */
    this.connection = new apn.Connection(
        {
            "cert": config.apns_client_certificate_file,
            "key": config.apns_client_private_key_file,
            "gateway": config.apns_service_host,
            "port": config.apns_service_port,
            "enhanced": true,
            "errorCallback": errorCallback,
            "cacheLength": 100
        }
    );

    /**
    * Override the socketDrained method for the connection. If there was a notification that was just sent out, then
    * invoke its callback if possible. NOTE: this is incredibly bogus because an error could fire later on for the
    * same notification.
    * @type Function
    */
    this.connection.socketDrained = function () {
        this.log.debug("APNs.socketDrained");
        if (this.lastSentNotification !== null) {
            var notification = this.lastSentNotification;
            if (notification !== null) {
                this.lastSentNotification = null;
                if (typeof notification.callback === "function") {
                    notification.callback({"retry":false, "invalidToken":false});
                }
            }
        }
        apn.Connection.prototype.socketDrained.call(this.connection);
    }.bind(this);

    /**
     * Override the sendNotification method for the connection. Remember the notification being sent.
     * @type Function
     */
    this.connection.sendNotification = function (notification) {
        this.lastSentNotification = notification;
        apn.Connection.prototype.sendNotification.call(this.connection, notification);
    }.bind(this);

    if (typeof config.apns_feedback_interval !== 'undefined' && config.apns_feedback_interval > 0) {
        this.log.info('starting feedback service');
        this.feedback = new apn.Feedback(
            {
                "cert": config.apns_client_certificate_file,
                "key": config.apns_client_private_key_file,
                "address": config.apns_feedback_host,
                "port": config.apns_feedback_port,
                "enhanced": true,
                "errorCallback": errorCallback,
                "feedback": this.feedbackCallback.bind(this),
                "interval": 3600
            });
    }
}

/**
 * APNs prototype.
 *
 * Defines the methods available to an APNs instance.
 */
APNs.prototype = {

    /** Function invoked by the APNs feedback service when APNs detects a device is no longer valid for notifications.
     * Attempt to locate the original NotificationRequest object associated with the invalid device and ask it to
     * forget the registration associated with the device.
     *
     * @param {Time} timestamp the timestamp of the notice
     * @param {Device} device the unique identifier for the iOS device to expunge
     */
    feedbackCallback: function (timestamp, device) {
        var log = this.log.child('feedbackCallback');
        log.BEGIN(timestamp, device);
        var request = this.notificationRequestTracker.find(device.toString('base64'));
        if (request) {
            log.info('removing registration for user ', request.userId, ' and token ', request.token);
            request.forgetRoute();
        }
        log.END();
    },

    /**
     * Send a notification payload to an APNs server.
     *
     * @param {NotificationRequest} req attributes of the notification to send
     */
    sendNotification: function(req) {
        var log = this.log.child('sendNotification');
        log.BEGIN(req);
        var notification = new apn.Notification();
        notification.callback = function (state) {
            if (state.invalidToken) {
                req.forgetPath();
            }
        };

        notification.device = new apn.Device(new Buffer(req.token, 'base64'));
        this.notificationRequestTracker.add(req, req.token);

        try {
            notification.payload = JSON.parse(req.content);
            log.debug('payload:', notification.payload);
            this.connection.sendNotification(notification);
        }
        catch (err) {
            log.error('failed to parse APN payload:', req.content);
        }
        log.END();
    }
};
