module.exports = TemplateManager;

/**
 * TemplateManager constructor.
 */
function TemplateManager(templateStore) {
    this.templateStore = templateStore;
}

/**
 * TemplateManager prototype.
 *
 * Defines the methods available to a TemplateManager instance.
 */
TemplateManager.prototype = {

    addTemplate: function (req, res) {
        var body = req.body;

        var eventId = body.eventId;
        if (eventId === "") {
            res.send(null, null, 400);
            return;
        }

        var notificationId = body.notificationId;
        if (notificationId === "") {
            res.send(null, null, 400);
            return;
        }

        var routeName = body.routeName;
        if (routeName === "") {
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.templateVersion;
        if (templateVersion === "") {
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.templateLanguage;
        if (templateLanguage === "") {
            res.send(null, null, 400);
            return;
        }

        var contract = body.contract;
        if (contract === "") {
            res.send(null, null, 400);
            return;
        }

        var content = body.content;
        if (content === "") {
            res.send(null, null, 400);
            return;
        }

        var start = new Date();
        this.templateStore.addTemplate(eventId, notificationId, routeName, templateVersion, templateLanguage, contract,
                                       content, function (err, templateEntity)
        {
            if (err) {
                console.log('error:', err);
                res.send(null, null, 500);
            }
            else {
                var end = new Date();
                var duration = end.getTime() - start.getTime();
                var tmp = {
                    'templateEntity': templateEntity,
                    'tableStoreDuration': duration
                };
                res.json(tmp);
                console.log('addTemplate', duration);
            }
        });
    },

    getTemplates: function (req, res) {
        var body = req.body;

        var eventId = body.eventId;
        if (eventId === "") {
            res.send(null, null, 400);
            return;
        }

        var routeName = body.routeName;
        if (routeName === "") {
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.templateVersion;
        if (templateVersion === "") {
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.templateLanguage;
        if (templateLanguage === "") {
            res.send(null, null, 400);
            return;
        }

        var contract = body.contract;

        var reg = {
            'templateVersion': '' + templateVersion,
            'templateLanguage': templateLanguage,
            'contract': contract,
            'routes': [ {'name':routeName, 'path':''} ]
        };
        var start = new Date();
        this.templateStore.findTemplates(eventId, [reg], function (err, templates)
        {
            var end = new Date();
            var duration = end.getTime() - start.getTime();
            console.log('getTemplates duration:', duration);
            if (err) {
                console.log('error:', err);
                res.send(null, null, 500);
            }
            else if (templates.length == 0) {
                res.send(null, null, 404);
            }
            else {
                var tmp = {
                    'templates': templates,
                    'tableStoreDuration': duration
                };
                res.json(tmp);
            }
        });
    },

    deleteTemplate: function (req, res) {
        var body = req.body;

        var eventId = body.eventId;
        if (eventId === "") {
            res.send(null, null, 400);
            return;
        }

        var notificationId = body.notificationId;
        if (notificationId === "") {
            res.send(null, null, 400);
            return;
        }

        var routeName = body.routeName;
        if (routeName === "") {
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.templateVersion;
        if (templateVersion === "") {
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.templateLanguage;
        if (templateLanguage === "") {
            res.send(null, null, 400);
            return;
        }

        var contract = body.contract;
        if (contract === "") {
            res.send(null, null, 400);
            return;
        }

        this.templateStore.removeTemplate(eventId, notificationId, routeName, templateVersion, templateLanguage,
                                          contract, function (err, templateEntity)
        {
            if (err !== null) {
                res.send(null, null, 404);
            }
            else {
                res.send(null, null, 204);
            }
        });
    }
};
