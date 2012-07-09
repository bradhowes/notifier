module.exports = APNs;

var config = require("./config");
var apns = require("apns");

/** Constructor for APNs objects.
 *
 */
function APNs() {

    function errorCallback(errNum, notification) {
        console.log("APNs.errorCallback:", errNum, notification);
    }

    this.connection = new apns.Connection(
        {"certFile": config.apns_client_certificate_file,
         "keyFile": config.apns_client_private_key_file,
         "gateway": config.apns_service_host,
         "port": config.apns_service_port,
         "enhanced": true,
         "errorCallback": errorCallback}
    );
}

/** Prototype definition for APNs
 *
 * Defines the methods available for APNs instances.
 */
APNs.prototype = {

    sendNotification: function(token, content, invalidRegistrationCallback) {
        content = JSON.parse(content);
        var notification = new apns.Notification();
        notification.device = new apns.Device(token);
        notification.payload = content.content;
        this.connection.sendNotification(notification);
    }
};
