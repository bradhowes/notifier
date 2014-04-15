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
            "cacheLength": 100
        }
    );

    if (typeof config.apns_feedback_interval !== 'undefined' && config.apns_feedback_interval > 0) {
        this.log.info('starting feedback service');
        this.feedback = new apn.Feedback(
            {
                "cert": config.apns_client_certificate_file,
                "key": config.apns_client_private_key_file,
                "address": config.apns_feedback_host,
                "port": config.apns_feedback_port,
                "enhanced": true,
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
            notification.payload = JSON.parse(req.payload);
            log.debug('payload:', notification.payload);
            this.connection.sendNotification(notification);
        }
        catch (err) {
            log.error('failed to parse APN payload:', req.content);
        }
        log.END();
    },

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
    }
};
