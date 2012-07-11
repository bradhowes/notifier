/**
 * @fileOverview Defines the APNs prototype and its methods.
 */
module.exports = APNs;

var config = require("./config");
var apn = require("apn");

/**
 * Initialize a new APNs instance. An APNs object sends JSON payloads to an APNs server for delivery to a specific
 * device. Relies on the node-apn module for connectivity to APNs server.
 *
 * @class
 */
function APNs() {

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
        console.log("APNs.errorCallback:", errNum, notification);
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
        console.log("APNs.socketDrained");
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
}

/** Prototype definition for APNs
 *
 * Defines the methods available for APNs instances.
 */
APNs.prototype = {

    /**
     * Send a notification payload to an APNs server.
     *
     * @param {String} token the device token that identifies the client to notify
     *
     * @param {String} content the payload to send
     *
     * @param {Function} callback the function to invoke when the notification has been sent and/or when there is an
     * error encountered.
     */
    sendNotification: function(token, content, callback) {
        content = JSON.parse(content);
        var notification = new apn.Notification();
        notification.callback = callback;
        notification.device = new apn.Device(new Buffer(token, 'base64'));
        notification.payload = content;
        console.log('payload:', content);
        this.connection.sendNotification(notification);
    }
};
