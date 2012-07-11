/**
 * @fileOverview Defines the Registrar prototype and its methods.
 */
module.exports = Registrar;

/**
 * Registrar constructor.
 *
 * @class Registrar
 * 
 * A registrar allows for querying, updating, and deleting of registrations for
 * a given user ID.
 */
function Registrar(registrationStore) {
    this.registrationStore = registrationStore;
}

/**
 * Registrar prototype.
 *
 * Defines the methods available to a Registrar instance.
 */
Registrar.prototype = {

    /**
     * Obtain the current registrations for a given user.
     *
     * @param req
     *   Contents of the incoming request
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    getRegistrations: function (req, res) {
        var userId = req.params.userId;
        if (userId === '') {
            res.send(null, null, 400);
            return;
        }

        var start = new Date();
        this.registrationStore.getRegistrations(userId, function (err, regs) {
            var end = new Date();
            var duration = end.getTime() - start.getTime();
            if (err !== null || typeof(regs) === "undefined" || regs.length === 0) {
                console.log('error:', err);
                res.send(null, null, 404);
            }
            else {
                var tmp = {
                    "registrations": regs,
                    "tableStoreDuration": duration
                };
                res.json(tmp);
                console.log('getRegistrations', userId, duration);
            }
        });
    },

    /**
     * Add or update a registration for a given user.
     *
     * @param req
     *   Contents of the incoming request. Expects a body in JSON format.
     *   - req.params.userId: the user to look for
     *   - req.body.registrationId: the registration to add/update.
     *   - req.body.templateVersion: the template version for this registration.
     *   - req.body.templateLanguage: the template language for this registration.
     *   - req.body.service: the notification service for this registration.
     *   - req.body.routes: array of one or more route dicts with keys:
     *     - name: the unique name of the route for this registration.
     *     - token: service-specific way to reach the user for notifications.
     *     - secondsToLive: the number of seconds into the future the token is valid.
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    addRegistration: function (req, res) {
        var self = this;
        var body = req.body;
        var userId = req.params.userId;
        function isUndefined(value) {
            return typeof(value) === "undefined" || value === "";
        }

        if (userId === "") {
            res.send(null, null, 400);
            return;
        }

        var registrationId = body.registrationId;
        if (isUndefined(registrationId)) {
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.templateVersion;
        if (isUndefined(templateVersion)) {
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.templateLanguage;
        if (isUndefined(templateLanguage)) {
            res.send(null, null, 400);
            return;
        }

        var service = body.service;
        if (isUndefined(service)) {
            res.send(null, null, 400);
            return;
        }

        var routes = body.routes;
        if (typeof(routes) === "undefined" || routes.length === 0) {
            res.send(null, null, 400);
            return;
        }

        var start = new Date();
        this.registrationStore.updateRegistrationEntity(userId, registrationId, templateVersion,
                                                        templateLanguage, service, routes,
                                                        function (err, registrationEntity)
        {
            if (err) {
                console.log('error:', err);
                res.send(null, null, 404);
            }
            else {
                var end = new Date();
                var duration = end.getTime() - start.getTime();
                var tmp = self.registrationStore.getRegistration(registrationEntity);
                tmp.tableStoreDuration = duration;
                res.json(tmp);
                console.log('addRegistration', userId, duration);
            }
        });
    },

    /**
     * Delete a registration or all registrations for a given user. If a JSON
     * payload exits with a registrationId attribute, only delete the one entity
     * matching the registrationId value. Otherwise, delete all registrations for the
     * user.
     *
     * @param req
     *   Contents of the incoming request.
     *   - req.params.userId: the user to look for
     *   - req.body.registrationId (optional): the registration to delete
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    deleteRegistration: function (req, res) {
        var userId = req.params.userId;
        if (userId === "") {
            res.send(null, null, 400);
            return;
        }

        function callback(err) {
            if (err) {
                res.send(null, null, 404);
            }
            else {
                res.send(null, null, 204);
            }
        }

        var registrationId = req.body.registrationId;
        if (registrationId === undefined) {
            this.registrationStore.deleteAllRegistrationEntities(userId, callback);
        }
        else {
            this.registrationStore.deleteRegistrationEntity(userId, registrationId, callback);
        }
    }
};
